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

    [HttpGet("pending-vendors")]
    public async Task<IActionResult> GetPendingVendors()
    {
        // Only Admin should access this
        if (!User.IsInRole("Admin")) return Forbid();

        var pendingVendors = await _context.Users
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
