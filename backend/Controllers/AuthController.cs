using System.Security.Cryptography;
using System.Text;
using EliteApp.API.Data;
using EliteApp.API.Models;
using EliteApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace EliteApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly AppDbContext _context;
    private readonly ILogger<AuthController> _logger;
    private readonly EliteApp.API.Services.Security.ITokenHasher _tokenHasher;
    private readonly EliteApp.API.Services.Email.IEmailQueue _emailQueue;
    private readonly IConfiguration _configuration;

    public AuthController(IAuthService authService, AppDbContext context, ILogger<AuthController> logger, EliteApp.API.Services.Security.ITokenHasher tokenHasher, EliteApp.API.Services.Email.IEmailQueue emailQueue, IConfiguration configuration)
    {
        _authService = authService;
        _context = context;
        _logger = logger;
        _tokenHasher = tokenHasher;
        _emailQueue = emailQueue;
        _configuration = configuration;
    }

    [EnableRateLimiting("auth-login")]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // #29 Server-side validation (EF entity annotations don't run on save).
        if (string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Name, email, and password are required." });

        var email = request.Email.Trim().ToLowerInvariant(); // #22 normalize on write
        if (!new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email))
            return BadRequest(new { message = "Please enter a valid email address." });
        if (request.Password.Length < 8)
            return BadRequest(new { message = "Password must be at least 8 characters." });

        // #28 Public registration may only create Customer or Vendor accounts — never Admin
        // or arbitrary role strings (over-posting guard).
        var role = request.Role?.Trim() ?? string.Empty;
        if (role != UserRole.Customer.ToString() && role != UserRole.Vendor.ToString())
            return BadRequest(new { message = "Invalid account type." });

        // Same length limits UsersController.UpdateProfile enforces — [StringLength] annotations
        // do not run on SaveChanges, so registration would otherwise accept oversized values.
        var name = request.Name.Trim();
        if (name.Length > 255)
            return BadRequest(new { message = "Name must be 1–255 characters." });
        var address = request.Address?.Trim();
        if (address is { Length: > 500 })
            return BadRequest(new { message = "Address must be 500 characters or fewer." });
        var phone = request.Phone?.Trim();
        if (phone is { Length: > 30 })
            return BadRequest(new { message = "Phone must be 30 characters or fewer." });

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            Name = name,
            Role = role,
            Address = address,
            Phone = phone,
            PhoneNormalized = PhoneNormalizer.ForStorage(phone),
            IsApproved = role != UserRole.Vendor.ToString() // Authors approve non-vendors
        };

        var (newUser, error) = await _authService.RegisterAsync(user, request.Password);

        if (newUser == null)
        {
            return BadRequest(new { message = error });
        }

        // Best-effort admin notification when a vendor registers (pending approval).
        // Queued: never let mail delivery slow down or break a successful registration.
        if (role == UserRole.Vendor.ToString())
        {
            var to = _configuration["Email:AdminNotify"];
            if (!string.IsNullOrWhiteSpace(to))
            {
                _emailQueue.TryEnqueue(new EliteApp.API.Services.Email.OutgoingEmail(
                    to,
                    "New vendor registered — pending approval",
                    $"A new vendor registered and is awaiting approval.\n\n" +
                    $"Name: {newUser.Name}\n" +
                    $"Email: {newUser.Email}\n" +
                    $"Phone: {newUser.Phone}\n" +
                    $"Address: {newUser.Address}"));
            }
        }

        return Ok(new { message = "Registration successful" });
    }

    [EnableRateLimiting("auth-login")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var (token, user, error) = await _authService.LoginAsync(request.Email, request.Password, request.Role);

        if (token == null || user == null)
        {
            return Unauthorized(new { message = error });
        }

        var u = user!;
        return Ok(new
        {
            token,
            user = new
            {
                u.Id,
                u.Name,
                u.Email,
                u.Role,
                u.Address,
                u.Phone,
                u.IsApproved,
                u.CreatedAt
            }
        });
    }

    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    [HttpPost("forgot-password-eligibility")]
    public async Task<IActionResult> ForgotPasswordEligibility([FromBody] ForgotPasswordEligibilityRequest body)
    {
        var can = await _authService.CanShowForgotPasswordAsync(body.Email ?? string.Empty, body.Role ?? string.Empty);
        return Ok(new { canShowForgotPassword = can });
    }

    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest body)
    {
        var result = await _authService.RequestPasswordResetAsync(
            body.Email ?? string.Empty,
            body.Role ?? string.Empty,
            body.DeliveryMethod ?? "Email",
            body.Phone);

        if (result.Status == ForgotPasswordRequestStatus.InvalidInput)
            return BadRequest(new { message = result.Message });

        if (result.Status == ForgotPasswordRequestStatus.EmailDeliveryFailed)
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = result.Message });

        return Ok(new { message = result.Message });
    }

    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordWithTokenRequest body)
    {
        var (ok, error) = await _authService.ResetPasswordAsync(
            body.Email ?? string.Empty,
            body.Token ?? string.Empty,
            body.NewPassword ?? string.Empty,
            body.Phone);

        if (!ok)
            return BadRequest(new { message = error });

        return Ok(new { message = "Password updated. You can sign in." });
    }

    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    [HttpPost("verify-reset-code")]
    public async Task<IActionResult> VerifyResetCode([FromBody] VerifyResetCodeRequest body)
    {
        var (ok, error) = await _authService.VerifyResetCodeAsync(
            body.Email ?? string.Empty,
            body.Token ?? string.Empty,
            body.Phone);

        if (!ok)
            return BadRequest(new { message = error });

        return Ok(new { message = "Code verified." });
    }

    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    [HttpPost("admin-register")]
    public async Task<IActionResult> AdminRegister([FromBody] AdminRegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "All fields are required." });

        var email = request.Email.Trim().ToLowerInvariant();
        var tokenHash = _tokenHasher.HashRaw(request.Token.Trim());

        var invite = await _context.AdminInvites
            .FirstOrDefaultAsync(i =>
                i.TokenHash == tokenHash &&
                !i.Used &&
                i.ExpiresAt > DateTime.UtcNow);

        if (invite == null)
            return BadRequest(new { message = "Invalid or expired invite link." });

        if (!string.Equals(invite.Email, email, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Invalid or expired invite link." });

        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email))
            return Conflict(new { message = "An account with this email already exists." });

        var minLen = 8;
        if (request.Password.Length < minLen)
            return BadRequest(new { message = $"Password must be at least {minLen} characters." });

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            Name = request.Name.Trim(),
            Role = UserRole.Admin.ToString(),
            IsApproved = true,
            IsActive = true,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, 12),
            CreatedAt = DateTime.UtcNow,
        };

        invite.Used = true;
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        _logger.LogInformation("New admin registered via invite: {Email}", email);
        return Ok(new { message = "Admin account created. You can now log in." });
    }

}

public class RegisterRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public class ForgotPasswordEligibilityRequest
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string DeliveryMethod { get; set; } = "Email"; // "Email" or "Phone"
    public string? Phone { get; set; }
}

public class ResetPasswordWithTokenRequest
{
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
    public string? Phone { get; set; }
}

public class VerifyResetCodeRequest
{
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string? Phone { get; set; }
}

public class AdminRegisterRequest
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
