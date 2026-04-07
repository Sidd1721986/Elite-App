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

    public UsersController(AppDbContext context, IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return NotFound();

        return Ok(user);
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

        // In a real app, you might flag as 'Denied'. 
        // For this demo, denying means removing the registration request.
        _context.Users.Remove(user);
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

        _context.Users.Remove(user);
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
        return Ok(user);
    }

    [HttpPost("request-phone-verification")]
    public async Task<IActionResult> RequestPhoneVerification()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return NotFound();

        if (string.IsNullOrEmpty(user.Phone)) return BadRequest(new { message = "No phone number set" });

        // Simple 6-digit code for demo
        var code = new Random().Next(100000, 999999).ToString();
        user.PhoneVerificationCode = code;
        user.PhoneVerificationExpiry = DateTime.UtcNow.AddMinutes(10);

        await _context.SaveChangesAsync();

        // MOCK: Log to console so user can see it
        Console.WriteLine($"[MOCK SMS] To {user.Phone}: Your verification code is {code}");
        Serilog.Log.Information("[MOCK SMS] To {Phone}: Your verification code is {Code}", user.Phone, code);
        
        return Ok(new { message = "Verification code sent (mocked)" });
    }

    [HttpPost("verify-phone")]
    public async Task<IActionResult> VerifyPhone([FromBody] VerifyPhoneRequest request)
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return NotFound();

        if (user.PhoneVerificationCode == request.Code && user.PhoneVerificationExpiry > DateTime.UtcNow)
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
            new User { Id = Guid.NewGuid(), Email = "customer@test.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("customer123"), Role = "Customer", Name = "Customer User", IsApproved = true }
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
