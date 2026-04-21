using System.Security.Cryptography;
using System.Text;
using EliteApp.API.Data;
using EliteApp.API.Models;
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

    public UsersController(AppDbContext context, IWebHostEnvironment environment, IConfiguration configuration)
    {
        _context = context;
        _environment = environment;
        _configuration = configuration;
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
    public async Task<IActionResult> GetPendingVendors()
    {
        // Only Admin should access this
        if (!User.IsInRole("Admin")) return Forbid();

        var pendingVendors = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role == "Vendor" && !u.IsApproved)
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

        user.IsApproved = true;
        await _context.SaveChangesAsync();

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
        user.IsActive = false;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Vendor denied" });
    }

    [HttpGet("approved-vendors")]
    public async Task<IActionResult> GetApprovedVendors()
    {
        if (!User.IsInRole("Admin")) return Forbid();

        var approvedVendors = await _context.Users
            .AsNoTracking()
            .Where(u => u.Role == "Vendor" && u.IsApproved)
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

        // TODO: Replace with a real SMS provider (e.g. Twilio, Azure Communication Services).
        // Until then the code is logged at Warning level so it is visible in dev but still
        // surfaced as a configuration gap in production log monitoring.
        Serilog.Log.Warning("[SMS NOT CONFIGURED] Phone verification code for {Phone}: {Code}. " +
            "Wire up ISmsService with a real provider before shipping.", user.Phone, plainCode);

        return Ok(new { message = "Verification code sent" });
    }

    [HttpPost("verify-phone")]
    public async Task<IActionResult> VerifyPhone([FromBody] VerifyPhoneRequest request)
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return NotFound();

        // Compare hashes — the DB stores only the hashed OTP, never the plaintext.
        // CryptographicOperations.FixedTimeEquals prevents timing-based side-channel attacks.
        var submittedHash = HashPhoneCode(request.Code ?? string.Empty);
        var storedHash    = user.PhoneVerificationCode ?? string.Empty;

        var hashesMatch = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(submittedHash),
            Encoding.UTF8.GetBytes(storedHash));

        if (hashesMatch && user.PhoneVerificationExpiry > DateTime.UtcNow)
        {
            user.IsPhoneVerified = true;
            user.PhoneVerificationCode = null;
            user.PhoneVerificationExpiry = null;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Phone verified successfully" });
        }

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
