using EliteApp.API.Data;
using EliteApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EliteApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
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

    [HttpPost("seed")]
    [AllowAnonymous] // Allow seeding without auth for setup convenience
    public async Task<IActionResult> Seed()
    {
        if (await _context.Users.AnyAsync())
        {
            return Ok(new { message = "Database already seeded" });
        }
        
        var users = new List<User>
        {
            new User { Id = Guid.NewGuid(), Email = "admin@test.com", PasswordHash = "admin123", Role = "Admin", Name = "Admin User", IsApproved = true },
            new User { Id = Guid.NewGuid(), Email = "vendor@test.com", PasswordHash = "vendor123", Role = "Vendor", Name = "Vendor User", IsApproved = true },
            new User { Id = Guid.NewGuid(), Email = "customer@test.com", PasswordHash = "customer123", Role = "Customer", Name = "Customer User", IsApproved = true }
        };
        
        _context.Users.AddRange(users);
        await _context.SaveChangesAsync();
        
        return Ok(new { message = "Seeded default users" });
    }
}
