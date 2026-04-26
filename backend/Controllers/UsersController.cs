using System.Security.Cryptography;
using System.Text;
using EliteApp.API.Data;
using EliteApp.API.Models;
using EliteApp.API.Services.Sms;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EliteApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;
    private readonly ISmsService _smsService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(AppDbContext context, IWebHostEnvironment environment, IConfiguration configuration, ISmsService smsService, ILogger<UsersController> logger)
    {
        _context = context;
        _environment = environment;
        _configuration = configuration;
        _smsService = smsService;
        _logger = logger;
    }

    // ── Phone-OTP hashing (mirrors AuthService.HashResetCode) ──────────────────
    // The pepper is the same shared secret used for password-reset OTPs so both
    // flows benefit from the same protection without a second secret to manage.
    private string HashPhoneCode(string plaintext)
    {
        var pepper = _configuration["PasswordReset:Pepper"] ?? string.Empty;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(plaintext + pepper));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return NotFound();

        // Project to a safe DTO — never expose PasswordHash, PhoneVerificationCode, or
        // PhoneVerificationExpiry to the client, even when the token is valid.
        return Ok(new
        {
            user.Id, user.Name, user.Email, user.Role, user.Address, user.Phone,
            user.IsApproved, user.IsActive, user.IsPhoneVerified, user.CreatedAt
        });
    }

    [HttpGet("pending-vendors")]
    public async Task<IActionResult> GetPendingVendors([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        if (!User.IsInRole("Admin")) return Forbid();

        pageSize = Math.Clamp(pageSize, 1, 200);
        page     = Math.Max(1, page);

        var pendingVendors = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role == "Vendor" && !u.IsApproved && u.IsActive)
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new { u.Id, u.Email, u.Name, u.Role, u.Address, u.Phone, u.IsApproved, u.CreatedAt })
            .ToListAsync();

        return Ok(pendingVendors);
    }

    [HttpPost("approve-vendor/{id}")]
    public async Task<IActionResult> ApproveVendor(Guid id)
    {
        if (!User.IsInRole("Admin")) return Forbid();

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        var adminId = User.FindFirst("id")?.Value;
        user.IsApproved = true;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Vendor approved: vendorId={VendorId} email={Email} by adminId={AdminId}", id, user.Email, adminId);
        return Ok(new { message = "Vendor approved" });
    }
    
    [HttpPost("deny-vendor/{id}")]
    public async Task<IActionResult> DenyVendor(Guid id)
    {
        if (!User.IsInRole("Admin")) return Forbid();

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Soft-delete: mark as inactive instead of hard-deleting.
        // Benefits:
        //  • Audit trail — the record and CreatedAt are preserved for review.
        //  • Prevents silent re-registration on the same email (email unique index
        //    is still respected, so a denied vendor cannot simply re-register).
        //  • Consistent with how DeleteSelf works (IsActive = false).
        // A denied vendor is identified by: Role == "Vendor" && IsApproved == false && IsActive == false.
        var adminId = User.FindFirst("id")?.Value;
        user.IsActive = false;
        await _context.SaveChangesAsync();

        _logger.LogWarning("Vendor denied: vendorId={VendorId} email={Email} by adminId={AdminId}", id, user.Email, adminId);
        return Ok(new { message = "Vendor denied" });
    }

    [HttpGet("approved-vendors")]
    public async Task<IActionResult> GetApprovedVendors([FromQuery] int page = 1, [FromQuery] int pageSize = 100)
    {
        if (!User.IsInRole("Admin")) return Forbid();

        pageSize = Math.Clamp(pageSize, 1, 200);
        page     = Math.Max(1, page);

        var approvedVendors = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role == "Vendor" && u.IsApproved && u.IsActive)
            .OrderBy(u => u.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new { u.Id, u.Email, u.Name, u.Role, u.Address, u.Phone, u.IsApproved, u.CreatedAt })
            .ToListAsync();

        return Ok(approvedVendors);
    }

    [HttpDelete("remove-vendor/{id}")]
    public async Task<IActionResult> RemoveVendor(Guid id)
    {
        if (!User.IsInRole("Admin")) return Forbid();

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Soft-delete — preserves the record for audit, prevents FK cascade errors
        // on Jobs and Messages, and mirrors the pattern used by DenyVendor and DeleteSelf.
        user.IsActive = false;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Vendor removed" });
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return NotFound();

        if (request.Name != null) user.Name = request.Name;
        if (request.Address != null) user.Address = request.Address;
        if (request.Phone != null)
        {
            if (user.Phone != request.Phone.Trim())
            {
                user.Phone = request.Phone.Trim();
                user.IsPhoneVerified = false; // Reset verification if phone changes
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            user.Id, user.Name, user.Email, user.Role, user.Address, user.Phone,
            user.IsApproved, user.IsActive, user.IsPhoneVerified, user.CreatedAt
        });
    }

    [HttpPost("request-phone-verification")]
    public async Task<IActionResult> RequestPhoneVerification()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return NotFound();

        if (string.IsNullOrEmpty(user.Phone)) return BadRequest(new { message = "No phone number set" });

        // Cryptographically secure 6-digit OTP (100000–999999).
        var plainCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

        // Hash the OTP before storing — same pattern as password-reset tokens.
        // The plaintext is sent to the user; only the hash lives in the database.
        user.PhoneVerificationCode = HashPhoneCode(plainCode);
        user.PhoneVerificationExpiry = DateTime.UtcNow.AddMinutes(10);

        await _context.SaveChangesAsync();

        await _smsService.SendAsync(user.Phone, $"Your Elite Home Services verification code is: {plainCode}. It expires in 10 minutes.");

        return Ok(new { message = "Verification code sent" });
    }

    [HttpPost("verify-phone")]
    public async Task<IActionResult> VerifyPhone([FromBody] VerifyPhoneRequest request)
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return NotFound();

        // Brute-force guard: max 5 attempts per 10-minute window per user.
        var windowStart = DateTime.UtcNow.AddMinutes(-10);
        if (user.PhoneVerificationLastAttempt > windowStart && user.PhoneVerificationAttempts >= 5)
            return StatusCode(429, new { message = "Too many attempts. Request a new code and try again." });

        // Reset counter once outside the window.
        if (user.PhoneVerificationLastAttempt <= windowStart)
            user.PhoneVerificationAttempts = 0;

        user.PhoneVerificationAttempts++;
        user.PhoneVerificationLastAttempt = DateTime.UtcNow;

        // Compare hashes — the DB stores only the hashed OTP, never the plaintext.
        // CryptographicOperations.FixedTimeEquals prevents timing-based side-channel attacks.
        var submittedHash = HashPhoneCode(request.Code ?? string.Empty);
        var storedHash    = user.PhoneVerificationCode ?? string.Empty;

        // Ensure equal-length byte arrays for constant-time compare.
        var submittedBytes = Encoding.UTF8.GetBytes(submittedHash);
        var storedBytes    = Encoding.UTF8.GetBytes(storedHash.PadRight(submittedHash.Length));

        var hashesMatch = CryptographicOperations.FixedTimeEquals(submittedBytes, storedBytes)
                          && storedHash.Length == submittedHash.Length;

        if (hashesMatch && user.PhoneVerificationExpiry > DateTime.UtcNow)
        {
            user.IsPhoneVerified = true;
            user.PhoneVerificationCode = null;
            user.PhoneVerificationExpiry = null;
            user.PhoneVerificationAttempts = 0;
            user.PhoneVerificationLastAttempt = null;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Phone verified successfully" });
        }

        await _context.SaveChangesAsync();
        return BadRequest(new { message = "Invalid or expired verification code" });
    }

    [HttpPost("delete-self")]
    public async Task<IActionResult> DeleteSelf()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return NotFound();

        user.IsActive = false; // Soft delete for compliance
        await _context.SaveChangesAsync();

        return Ok(new { message = "Account deactivated successfully" });
    }

    /// <summary>Development only — creates weak demo accounts. Disabled outside Development.</summary>
    [HttpPost("seed")]
    [AllowAnonymous]
    public async Task<IActionResult> Seed()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        if (await _context.Users.AnyAsync())
        {
            return Ok(new { message = "Database already seeded" });
        }

        var users = new List<User>
        {
            new User { Id = Guid.NewGuid(), Email = "admin@test.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"), Role = "Admin", Name = "Admin User", IsApproved = true },
            new User { Id = Guid.NewGuid(), Email = "vendor@test.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("vendor123"), Role = "Vendor", Name = "Vendor User", IsApproved = true },
            new User { Id = Guid.NewGuid(), Email = "customer@test.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("customer123"), Role = "Customer", Name = "Customer User", IsApproved = true },
            new User { Id = Guid.NewGuid(), Email = "plumber@test.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("vendor123"), Role = "Vendor", Name = "Premium Plumbing", IsApproved = true, Address = "123 Water St", Phone = "555-0101" },
            new User { Id = Guid.NewGuid(), Email = "electric@test.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("vendor123"), Role = "Vendor", Name = "Elite Electricians", IsApproved = true, Address = "456 Spark Ave", Phone = "555-0202" },
            new User { Id = Guid.NewGuid(), Email = "roofer@test.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("vendor123"), Role = "Vendor", Name = "Top Tier Roofing", IsApproved = true, Address = "789 Peak Rd", Phone = "555-0303" }
        };
        
        _context.Users.AddRange(users);
        await _context.SaveChangesAsync();
        
        return Ok(new { message = "Seeded default users" });
    }
}

public class UpdateProfileRequest
{
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
}

public class VerifyPhoneRequest
{
    public string Code { get; set; } = string.Empty;
}
