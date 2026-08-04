using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EliteApp.API.Data;
using EliteApp.API.Models;
using EliteApp.API.Services.Email;
using EliteApp.API.Services.Sms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using Serilog;

namespace EliteApp.API.Services;

public interface IAuthService
{
    Task<(User? User, string Error)> RegisterAsync(User user, string password);
    Task<(string? Token, User? User, string Error)> LoginAsync(string email, string password, string role);
    Task<bool> CanShowForgotPasswordAsync(string email, string role);
    Task<ForgotPasswordRequestResult> RequestPasswordResetAsync(string email, string role, string deliveryMethod, string? phone = null);
    Task<(bool Ok, string Error)> VerifyResetCodeAsync(string email, string token, string? phone = null);
    Task<(bool Ok, string Error)> ResetPasswordAsync(string email, string token, string newPassword, string? phone = null);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IEmailSender _emailSender;
    private readonly ISmsService _smsService;
    private readonly ILogger<AuthService> _logger;
    private readonly JwtSigningKeyProvider _jwtKeyProvider;
    private readonly EliteApp.API.Services.Security.ITokenHasher _tokenHasher;
    private readonly IMemoryCache _cache;

    // Failed verifies allowed against one reset code before it is burned.
    private const int MaxResetAttempts = 5;

    public AuthService(
        AppDbContext context,
        IConfiguration configuration,
        IEmailSender emailSender,
        ISmsService smsService,
        ILogger<AuthService> logger,
        JwtSigningKeyProvider jwtKeyProvider,
        EliteApp.API.Services.Security.ITokenHasher tokenHasher,
        IMemoryCache cache)
    {
        _context = context;
        _configuration = configuration;
        _emailSender = emailSender;
        _smsService = smsService;
        _logger = logger;
        _jwtKeyProvider = jwtKeyProvider;
        _tokenHasher = tokenHasher;
        _cache = cache;
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
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, 12); 
        
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
                _logger.LogWarning("Login failed: email={Email} reason=InvalidCredentials", emailTrimmed);
                return (null, null, "Invalid credentials");
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("Login failed: email={Email} reason=AccountDeactivated userId={UserId}", emailTrimmed, user.Id);
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
        _logger.LogInformation("Login success: email={Email} role={Role} userId={UserId}", emailTrimmed, user.Role, user.Id);
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
            // Issued-at is the revocation anchor: Program.cs (OnTokenValidated) rejects any
            // token issued before the user's PasswordChangedAt.
            new Claim(JwtRegisteredClaimNames.Iat,
                DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64),
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

    // Constant by design. The previous per-account answer (does this vendor email exist? is it
    // approved?) was an unauthenticated oracle for enumerating registered vendors. The reset
    // request itself already responds generically, so the UI can offer the link to everyone.
    public Task<bool> CanShowForgotPasswordAsync(string email, string role) => Task.FromResult(true);

    public async Task<ForgotPasswordRequestResult> RequestPasswordResetAsync(string email, string role, string deliveryMethod, string? phone = null)
    {
        const string genericOk =
            "If an account matches the details provided, password reset instructions have been sent.";

        var isPhone = deliveryMethod.Equals("Phone", StringComparison.OrdinalIgnoreCase);

        // Phone is a full identifier: the user is looked up by phone number alone.
        // Email flow continues to identify the account by email address.
        User? user;
        if (isPhone)
        {
            if (string.IsNullOrWhiteSpace(phone) || string.IsNullOrWhiteSpace(role))
            {
                return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.InvalidInput,
                    "Phone number and role are required.");
            }
            // Match on digits only (last 10) so "+1 617-794-6854" and "6177946854"
            // resolve to the same account regardless of how the number was stored. The
            // comparable form lives in its own indexed column — normalizing Phone here
            // instead would mean loading every user row on each reset request.
            var wanted = PhoneNormalizer.Normalize(phone);
            user = await _context.Users.FirstOrDefaultAsync(u => u.PhoneNormalized == wanted);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(role))
            {
                return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.InvalidInput,
                    "Email and role are required.");
            }
            user = await _context.Users.FirstOrDefaultAsync(u =>
                u.Email.ToLower() == email.Trim().ToLower());
        }

        if (user == null)
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);

        if (!string.Equals(user.Role, role.Trim(), StringComparison.OrdinalIgnoreCase))
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);

        if (!user.IsActive)
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);

        if (user.Role == UserRole.Vendor.ToString() && !user.IsApproved)
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);

        var expiryHours = Math.Clamp(_configuration.GetValue("PasswordReset:TokenExpiryHours", 1), 1, 72);

        // Single DELETE statement — no round-trip to load rows into memory first.
        // (The old AsNoTracking + RemoveRange pattern was fragile across EF Core versions.)
        await _context.PasswordResetTokens
            .Where(t => t.UserId == user.Id && !t.Used)
            .ExecuteDeleteAsync();

        // Cryptographically secure 6-digit OTP (100000–999999).
        // RandomNumberGenerator.GetInt32 uses the OS CSPRNG, unlike System.Random.
        var plaintextCode = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        var tokenHash = _tokenHasher.HashWithPepper(plaintextCode);

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
            if (string.IsNullOrWhiteSpace(user.Phone))
            {
                _logger.LogWarning("Password reset SMS requested for {Email} but no phone number on record.", user.Email);
                return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);
            }
            var smsBody = $"Your Elite password reset code is {plaintextCode}. Valid for {expiryHours} hour(s). Do not share this code.";
            try
            {
                await _smsService.SendAsync(user.Phone, smsBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Password reset SMS failed for user {UserId}", user.Id);
            }
            return new ForgotPasswordRequestResult(ForgotPasswordRequestStatus.Processed, genericOk);
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

    public async Task<(bool Ok, string Error)> VerifyResetCodeAsync(string email, string token, string? phone = null)
    {
        var byPhone = !string.IsNullOrWhiteSpace(phone);
        if (string.IsNullOrWhiteSpace(token) || (!byPhone && string.IsNullOrWhiteSpace(email)))
            return (false, "A reset code and your email or phone are required.");

        var (entry, error) = await ResolveResetTokenAsync(email, token, phone);
        if (entry == null)
            return (false, error);

        return (true, string.Empty);
    }

    /// <summary>
    /// Matches a submitted reset code to its live token row. A wrong code is charged as a failed
    /// attempt against the code currently outstanding for the supplied identity, and that code is
    /// burned once <see cref="MaxResetAttempts"/> is reached — the IP rate limiter alone leaves a
    /// 6-digit OTP guessable from rotating addresses. Mirrors the phone-verification counter in
    /// UsersController.VerifyPhone. Returns (null, error) when the code is not usable.
    /// </summary>
    private async Task<(PasswordResetToken? Entry, string Error)> ResolveResetTokenAsync(string email, string token, string? phone)
    {
        const string invalid = "Invalid or expired reset code.";

        var tokenHash = _tokenHasher.HashWithPepper(token.Trim());
        var entry = await _context.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t =>
                t.Token == tokenHash && !t.Used && t.ExpiresAt > DateTime.UtcNow);

        if (entry?.User != null && ResetIdentityMatches(entry.User, email, phone))
            return (entry, string.Empty);

        // The code did not resolve to this identity's token — count the miss on whatever code
        // that identity currently has outstanding.
        var outstanding = await FindOutstandingTokenAsync(email, phone);
        if (outstanding == null)
            return (null, invalid);

        outstanding.Attempts++;
        var exhausted = outstanding.Attempts >= MaxResetAttempts;
        if (exhausted)
            outstanding.Used = true; // burn it: the user must request a fresh code
        await _context.SaveChangesAsync();

        if (exhausted)
        {
            _logger.LogWarning("Password reset code burned after {Attempts} failed attempts for user {UserId}",
                outstanding.Attempts, outstanding.UserId);
            return (null, "Too many incorrect attempts. Please request a new reset code.");
        }

        return (null, invalid);
    }

    /// <summary>The live (unused, unexpired) reset token belonging to the supplied identity, if any.</summary>
    private async Task<PasswordResetToken?> FindOutstandingTokenAsync(string email, string? phone)
    {
        var live = _context.PasswordResetTokens
            .Include(t => t.User)
            .Where(t => !t.Used && t.ExpiresAt > DateTime.UtcNow);

        if (!string.IsNullOrWhiteSpace(phone))
        {
            // Same indexed comparable form the reset-request flow looks the account up by.
            var wanted = PhoneNormalizer.Normalize(phone);
            return await live.FirstOrDefaultAsync(t => t.User != null && t.User.PhoneNormalized == wanted);
        }

        if (string.IsNullOrWhiteSpace(email)) return null;
        var wantedEmail = email.Trim().ToLower();
        return await live.FirstOrDefaultAsync(t => t.User != null && t.User.Email.ToLower() == wantedEmail);
    }

    // The reset code is tied to a user; confirm the supplied identifier (phone for the
    // phone flow, email otherwise) belongs to that same user so a code can't be replayed
    // against a different account.
    private static bool ResetIdentityMatches(User user, string email, string? phone)
    {
        if (!string.IsNullOrWhiteSpace(phone))
            return !string.IsNullOrWhiteSpace(user.Phone) &&
                   PhoneNormalizer.Normalize(user.Phone) == PhoneNormalizer.Normalize(phone);
        return string.Equals(user.Email, email.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    public async Task<(bool Ok, string Error)> ResetPasswordAsync(string email, string token, string newPassword, string? phone = null)
    {
        var minLen = Math.Clamp(_configuration.GetValue("Security:MinPasswordLength", 8), 8, 128);
        var byPhone = !string.IsNullOrWhiteSpace(phone);
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(newPassword) || (!byPhone && string.IsNullOrWhiteSpace(email)))
            return (false, "A reset code, new password, and your email or phone are required.");
        if (newPassword.Length < minLen)
            return (false, $"Password must be at least {minLen} characters.");

        var (entry, error) = await ResolveResetTokenAsync(email, token, phone);
        if (entry?.User == null)
            return (false, error);

        entry.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword, 12);
        // Revokes every JWT issued before this moment (tokens live 7 days and are otherwise
        // unaffected by a reset). Enforced in Program.cs → OnTokenValidated.
        entry.User.PasswordChangedAt = DateTime.UtcNow;
        entry.Used = true;
        await _context.SaveChangesAsync();

        // The auth hook caches this user's IsActive/PasswordChangedAt for 60s — drop it so the
        // revocation takes effect on the next request instead of after the TTL.
        _cache.Remove($"user-active:{entry.User.Id}");

        return (true, string.Empty);
    }
}
