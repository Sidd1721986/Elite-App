using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EliteApp.API.Data;
using EliteApp.API.Models;
using EliteApp.API.Services.Email;
using EliteApp.API.Services.Sms;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace EliteApp.API.Services;

public interface IAuthService
{
    Task<(User? User, string Error)> RegisterAsync(User user, string password);
    Task<(string? Token, User? User, string Error)> LoginAsync(string email, string password, string role);
    Task<bool> CanShowForgotPasswordAsync(string email, string role);
    Task<ForgotPasswordRequestResult> RequestPasswordResetAsync(string email, string role, string deliveryMethod, string? phone = null);
    Task<(bool Ok, string Error)> VerifyResetCodeAsync(string email, string token);
    Task<(bool Ok, string Error)> ResetPasswordAsync(string email, string token, string newPassword);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IEmailSender _emailSender;
    private readonly ISmsService _smsService;
    private readonly ILogger<AuthService> _logger;
    private readonly JwtSigningKeyProvider _jwtKeyProvider;

    public AuthService(
        AppDbContext context,
        IConfiguration configuration,
        IEmailSender emailSender,
        ISmsService smsService,
        ILogger<AuthService> logger,
        JwtSigningKeyProvider jwtKeyProvider)
    {
        _context = context;
        _configuration = configuration;
        _emailSender = emailSender;
        _smsService = smsService;
        _logger = logger;
        _jwtKeyProvider = jwtKeyProvider;
    }

    public async Task<(User? User, string Error)> RegisterAsync(User user, string password)
    {
        if (string.Equals(user.Role, UserRole.Admin.ToString(), StringComparison.OrdinalIgnoreCase))
            return (null, "Invalid role");

        var minLen = Math.Clamp(_configuration.GetValue("Security:MinPasswordLength", 8), 8, 128);
        if (string.IsNullOrEmpty(password) || password.Length < minLen)
            return (null, $"Password must be at least {minLen} characters.");

        if (await _context.Users.AsNoTracking().AnyAsync(u => u.Email == user.Email))
        {
            return (null, "Email already exists");
        }

        // In a real app, hash the password properly (e.g., BCrypt). 
        // For this demo, we'll store it as is or a simple hash to match the requirement of "setup".
        // Let's stick to simple for now but acknowledge it's not prod-ready security.
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password); 
        
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return (user, string.Empty);
    }

    public async Task<(string? Token, User? User, string Error)> LoginAsync(string? email, string? password, string? requestedRole)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(requestedRole))
        {
            return (null, null, "Email, password, and role are required.");
        }

        var emailTrimmed = email.Trim().ToLowerInvariant();
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email.ToLower() == emailTrimmed);

        try
        {
            if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            {
                return (null, null, "Invalid credentials");
            }

            if (!user.IsActive)
            {
                return (null, null, "Account deactivated. Please contact support.");
            }
        }
        catch (BCrypt.Net.SaltParseException ex)
        {
            Log.Error(ex, "SaltParseException for user {Email}", email);
            return (null, null, "Invalid credentials");
        }

        if (!string.Equals(user.Role, requestedRole.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return (null, null, "Invalid credentials");
        }

        if (user.Role == UserRole.Vendor.ToString() && !user.IsApproved)
        {
            return (null, null, "Account not approved yet");
        }

        var token = GenerateJwtToken(user);
        return (token, user, string.Empty);
    }

    private string GenerateJwtToken(User user)
    {
        // Key, issuer, and audience are resolved and validated once at startup
        // (Program.cs → ResolveJwtSigningKey) and injected via JwtSigningKeyProvider.
        // There is no fallback here — a missing key throws at startup before any request
        // can reach this point.
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtKeyProvider.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Email ?? "unknown"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("id", user.Id.ToString()),
            new Claim(ClaimTypes.Role, user.Role ?? "Customer"), // Long URI form
            new Claim("role", user.Role ?? "Customer"),          // Short form
            new Claim(ClaimTypes.Name, user.Name ?? "User")
        };

        var token = new JwtSecurityToken(
            issuer: _jwtKeyProvider.Issuer,
            audience: _jwtKeyProvider.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<bool> CanShowForgotPasswordAsync(string email, string role)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        var r = (role ?? string.Empty).Trim();
        if (!string.Equals(r, UserRole.Vendor.ToString(), StringComparison.OrdinalIgnoreCase))
            return true;

        var user = await _context.Users.FirstOrDefaultAsync(u =>
            u.Email.ToLower() == email.Trim().ToLower());
        if (user == null) return false;
        if (!string.Equals(user.Role, UserRole.Vendor.ToString(), StringComparison.OrdinalIgnoreCase))
            return false;
        return user.IsApproved;
    }

    public async Task<ForgotPasswordRequestResult> RequestPasswordResetAsync(string email, string role, string deliveryMethod, string? phone = null)
    {
        const string genericOk =
            "If an account exists for this email and role, password reset instructions have been sent.";

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(role))
        {
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.InvalidInput,
                "Email and role are required.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u =>
            u.Email.ToLower() == email.Trim().ToLower());

        if (user == null)
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);

        if (!string.Equals(user.Role, role.Trim(), StringComparison.OrdinalIgnoreCase))
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);

        if (!user.IsActive)
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);

        if (user.Role == UserRole.Vendor.ToString() && !user.IsApproved)
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);

        // If Phone is selected, we should theoretically check if the provided phone matches.
        // For security, if it doesn't match, we still return "Success" but don't send anything.
        if (deliveryMethod.Equals("Phone", StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(user.Phone) || !string.Equals(user.Phone.Trim(), phone?.Trim()))
            {
                return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);
            }
        }

        var expiryHours = Math.Clamp(_configuration.GetValue("PasswordReset:TokenExpiryHours", 1), 1, 72);

        // Single DELETE statement — no round-trip to load rows into memory first.
        // (The old AsNoTracking + RemoveRange pattern was fragile across EF Core versions.)
        await _context.PasswordResetTokens
            .Where(t => t.UserId == user.Id && !t.Used)
            .ExecuteDeleteAsync();

        // Cryptographically secure 6-digit OTP (100000–999999).
        // RandomNumberGenerator.GetInt32 uses the OS CSPRNG, unlike System.Random.
        var plaintextCode = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        var tokenHash = HashResetCode(plaintextCode);

        _context.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            Token = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddHours(expiryHours),
            Used = false
        });
        await _context.SaveChangesAsync();

        if (deliveryMethod.Equals("Phone", StringComparison.OrdinalIgnoreCase))
        {
            var smsBody = $"Your Elite password reset code is {plaintextCode}. Valid for {expiryHours} hour(s). Do not share this code.";
            await _smsService.SendAsync(user.Phone!, smsBody);
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed,
                "If an account exists for this email and role, password reset instructions have been sent.");
        }
        else
        {
            var subject = _configuration["Email:PasswordResetSubject"] ?? "Reset your Elite password";
            var plainBody =
                $"Hello,\n\nUse this code in the app to reset your password (expires in {expiryHours} hour(s)):\n\n{plaintextCode}\n\nIf you did not request this, you can ignore this email.\n";
            var htmlBody =
                $"<p>Hello,</p><p>Use this code in the app to reset your password (expires in <strong>{expiryHours}</strong> hour(s)):</p><p style=\"font-size:24px;font-weight:bold;letter-spacing:4px;color:#6366F1;\">{plaintextCode}</p><p>If you did not request this, you can ignore this email.</p>";

            try
            {
                await _emailSender.SendAsync(user.Email, subject, plainBody, htmlBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Password reset email failed for {Email}", user.Email);
                return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.EmailDeliveryFailed,
                    "We could not send email right now. Please try again later.");
            }
        }

        return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);
    }

    public async Task<(bool Ok, string Error)> VerifyResetCodeAsync(string email, string token)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(token))
            return (false, "Email and reset code are required.");

        var tokenHash = HashResetCode(token.Trim());
        var entry = await _context.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t =>
                t.Token == tokenHash && !t.Used && t.ExpiresAt > DateTime.UtcNow);

        if (entry?.User == null)
            return (false, "Invalid or expired reset code.");

        if (!string.Equals(entry.User.Email, email.Trim(), StringComparison.OrdinalIgnoreCase))
            return (false, "Invalid or expired reset code.");

        return (true, string.Empty);
    }

    private string HashResetCode(string plaintext)
    {
        var pepper = _configuration["PasswordReset:Pepper"] ?? string.Empty;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(plaintext + pepper));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public async Task<(bool Ok, string Error)> ResetPasswordAsync(string email, string token, string newPassword)
    {
        var minLen = Math.Clamp(_configuration.GetValue("Security:MinPasswordLength", 8), 8, 128);
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(newPassword))
            return (false, "Email, reset code, and new password are required.");
        if (newPassword.Length < minLen)
            return (false, $"Password must be at least {minLen} characters.");

        var tokenHash = HashResetCode(token.Trim());
        var entry = await _context.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t =>
                t.Token == tokenHash && !t.Used && t.ExpiresAt > DateTime.UtcNow);

        if (entry?.User == null)
            return (false, "Invalid or expired reset code.");

        if (!string.Equals(entry.User.Email, email.Trim(), StringComparison.OrdinalIgnoreCase))
            return (false, "Invalid or expired reset code.");

        entry.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        entry.Used = true;
        await _context.SaveChangesAsync();
        return (true, string.Empty);
    }
}
