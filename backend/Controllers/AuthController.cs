using EliteApp.API.Models;
using EliteApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EliteApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [EnableRateLimiting("auth-login")]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            Name = request.Name,
            Role = request.Role,
            Address = request.Address,
            Phone = request.Phone,
            IsApproved = request.Role != UserRole.Vendor.ToString() // Authors approve non-vendors
        };

        var (newUser, error) = await _authService.RegisterAsync(user, request.Password);

        if (newUser == null)
        {
            return BadRequest(new { message = error });
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
            body.NewPassword ?? string.Empty);

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
            body.Token ?? string.Empty);

        if (!ok)
            return BadRequest(new { message = error });

        return Ok(new { message = "Code verified." });
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
}

public class VerifyResetCodeRequest
{
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
}
