using EliteApp.API.Data;
using EliteApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EliteApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class JobsController : ControllerBase
{
    private readonly AppDbContext _context;

    public JobsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>Returns true if the caller may view this job (customer, assigned vendor, or admin).</summary>
    private bool CurrentUserCanAccessJob(Guid userId, Job job)
    {
        if (User.IsInRole("Admin") || User.IsInRole("admin")) return true;
        if (job.CustomerId == userId) return true;
        if (job.VendorId == userId) return true;
        return false;
    }

    [HttpGet]
    public async Task<IActionResult> GetJobs([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var userRole = User.FindFirstValue("role");
        var userIdString = User.FindFirstValue("id");

        if (!Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        // Keep this endpoint read-only for consistent latency.
        IQueryable<Job> query = _context.Jobs.AsNoTracking()
            .Include(j => j.Customer)
            .Include(j => j.Vendor);

        if (User.IsInRole("Customer") || User.IsInRole("customer"))
        {
            query = query.Where(j => j.CustomerId == userId);
        }
        else if (User.IsInRole("Vendor") || User.IsInRole("vendor"))
        {
            // Vendors see jobs assigned to them
            query = query.Where(j => j.VendorId == userId);
        }
        // Admin sees all

        var jobs = await query
            .OrderByDescending(j => j.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        return Ok(jobs);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetJob(Guid id)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.AsNoTracking()
            .Include(j => j.Customer)
            .Include(j => j.Vendor)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (job == null) return NotFound();
        if (!CurrentUserCanAccessJob(userId, job)) return NotFound();

        return Ok(job);
    }

    [HttpPost]
    public async Task<IActionResult> CreateJob([FromBody] CreateJobRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        if (!User.IsInRole("Customer") && !User.IsInRole("customer"))
            return StatusCode(403, new { message = "Only customers can create service requests." });

        if (string.IsNullOrWhiteSpace(request.Description) || 
            string.IsNullOrWhiteSpace(request.Address) || 
            string.IsNullOrWhiteSpace(request.ContactPhone) || 
            string.IsNullOrWhiteSpace(request.ContactEmail))
        {
            return BadRequest(new { message = "Description, Address, ContactPhone, and ContactEmail are all mandatory fields." });
        }

        var job = new Job
        {
            Id = Guid.NewGuid(),
            CustomerId = userId,
            Description = request.Description,
            Address = request.Address,
            Urgency = request.Urgency,
            OtherDetails = request.OtherDetails,
            Photos = request.Photos != null ? string.Join(",", request.Photos) : null,
            Status = "Submitted",
            ContactPhone = request.ContactPhone,
            ContactEmail = request.ContactEmail,
            CreatedAt = DateTime.UtcNow
        };

        _context.Jobs.Add(job);
        await _context.SaveChangesAsync();

        // Reload with customer info for consistent UI display
        var createdJob = await _context.Jobs.Include(j => j.Customer).FirstOrDefaultAsync(j => j.Id == job.Id);
        return CreatedAtAction(nameof(GetJob), new { id = job.Id }, createdJob);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateJob(Guid id, [FromBody] UpdateJobRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        // Security check: Only the owning customer (or an Admin) can modify the job
        bool isAdmin = User.IsInRole("Admin") || User.IsInRole("admin");
        if (job.CustomerId != userId && !isAdmin)
        {
            return StatusCode(403, new { message = "Forbidden: You do not have permission to modify this job. It belongs to another customer." });
        }

        if (request.Status != null) job.Status = request.Status;
        if (request.Description != null) job.Description = request.Description;
        if (request.Address != null) job.Address = request.Address;
        if (request.Urgency != null) job.Urgency = request.Urgency;
        if (request.OtherDetails != null) job.OtherDetails = request.OtherDetails;
        if (request.Photos != null) job.Photos = string.Join(",", request.Photos);
        if (request.ContactPhone != null) job.ContactPhone = request.ContactPhone;
        if (request.ContactEmail != null) job.ContactEmail = request.ContactEmail;

        // Final validation to ensure mandatory fields weren't cleared
        var missingFields = new List<string>();
        if (string.IsNullOrWhiteSpace(job.Description)) missingFields.Add("Description");
        if (string.IsNullOrWhiteSpace(job.Address)) missingFields.Add("Address");
        if (string.IsNullOrWhiteSpace(job.ContactPhone)) missingFields.Add("Contact Phone");
        if (string.IsNullOrWhiteSpace(job.ContactEmail)) missingFields.Add("Contact Email");

        if (missingFields.Any())
        {
            return BadRequest(new { message = $"Cannot update job. The following fields are required: {string.Join(", ", missingFields)}" });
        }

        _context.Entry(job).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        
        // Refresh job with customer and vendor info for consistent UI display
        var updatedJob = await _context.Jobs
            .Include(j => j.Customer)
            .Include(j => j.Vendor)
            .FirstOrDefaultAsync(j => j.Id == id);
        return Ok(updatedJob);
    }

    [HttpPost("{id}/assign")]
    public async Task<IActionResult> AssignVendor(Guid id, [FromBody] AssignVendorRequest request)
    {
        bool isAdmin = User.IsInRole("Admin") || User.IsInRole("admin");
        if (!isAdmin) return StatusCode(403, new { message = "Forbidden: Admin access required." });

        var job = await _context.Jobs.Include(j => j.Customer).FirstOrDefaultAsync(j => j.Id == id);
        if (job == null) return NotFound(new { message = "Job not found" });

        if (job.Customer == null)
        {
            return BadRequest(new { message = "Cannot assign vendor: Customer profile not found for this job." });
        }

        // Check if contact info is complete
        var missingFields = new List<string>();
        if (string.IsNullOrEmpty(job.Customer.Phone)) missingFields.Add("Phone");
        if (string.IsNullOrEmpty(job.Address)) missingFields.Add("Address");
        if (string.IsNullOrEmpty(job.Customer.Email)) missingFields.Add("Email");

        if (missingFields.Any())
        {
            return BadRequest(new { message = $"Cannot assign vendor: Homeowner contact information is incomplete. Missing: {string.Join(", ", missingFields)}" });
        }

        job.VendorId = request.VendorId;
        job.Status = "Assigned";
        job.AssignedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(job);
    }

    [HttpPost("{id}/accept")]
    public async Task<IActionResult> AcceptJob(Guid id)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        if (job.VendorId != userId) return Forbid();

        job.Status = "Accepted";
        job.AcceptedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(job);
    }

    [HttpPost("{id}/notes")]
    public async Task<IActionResult> AddNote(Guid id, [FromBody] AddNoteRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();
        if (!CurrentUserCanAccessJob(userId, job)) return NotFound();

        var note = new JobNote
        {
            JobId = id,
            AuthorId = userId,
            Content = request.Content,
            CreatedAt = DateTime.UtcNow
        };

        _context.JobNotes.Add(note);
        await _context.SaveChangesAsync();

        return Ok(note);
    }

    [HttpGet("{id}/notes")]
    public async Task<IActionResult> GetNotes(Guid id)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == id);
        if (job == null) return NotFound();
        if (!CurrentUserCanAccessJob(userId, job)) return NotFound();

        var notes = await _context.JobNotes
            .Where(n => n.JobId == id)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();
        return Ok(notes);
    }

    [HttpPost("{id}/complete-sale")]
    public async Task<IActionResult> CompleteSale(Guid id, [FromBody] CompleteSaleRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        if (job.VendorId != userId) return Forbid();

        job.Status = "Sale";
        job.ScopeOfWork = request.ScopeOfWork;
        job.ContractAmount = request.ContractAmount;
        job.WorkStartDate = request.WorkStartDate;

        await _context.SaveChangesAsync();
        return Ok(job);
    }

    [HttpPost("{id}/reach-out")]
    public async Task<IActionResult> ReachOut(Guid id)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        if (job.VendorId != userId) return Forbid();

        job.Status = "ReachedOut";
        await _context.SaveChangesAsync();
        return Ok(job);
    }

    [HttpPost("{id}/set-appointment")]
    public async Task<IActionResult> SetAppointment(Guid id)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        if (job.VendorId != userId) return Forbid();

        job.Status = "ApptSet";
        await _context.SaveChangesAsync();
        return Ok(job);
    }

    [HttpPost("{id}/complete")]
    public async Task<IActionResult> CompleteJob(Guid id, [FromBody] CompleteJobRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        if (job.VendorId != userId) return Forbid();

        job.Status = "Completed";
        if (request.CompletedPhotos != null && request.CompletedPhotos.Any())
        {
            job.CompletedPhotos = string.Join(",", request.CompletedPhotos);
        }

        await _context.SaveChangesAsync();
        return Ok(job);
    }
}

public class AssignVendorRequest
{
    public Guid VendorId { get; set; }
}

public class AddNoteRequest
{
    public string Content { get; set; } = string.Empty;
}

public class CompleteSaleRequest
{
    public string ScopeOfWork { get; set; } = string.Empty;
    public decimal ContractAmount { get; set; }
    public DateTime WorkStartDate { get; set; }
}

public class CompleteJobRequest
{
    public List<string>? CompletedPhotos { get; set; }
}


public class CreateJobRequest
{
    public string Description { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Urgency { get; set; } = "No rush";
    public string? OtherDetails { get; set; }
    public List<string>? Photos { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
}

public class UpdateJobRequest
{
    public string? Status { get; set; }
    public string? Description { get; set; }
    public string? Address { get; set; }
    public string? Urgency { get; set; }
    public string? OtherDetails { get; set; }
    public List<string>? Photos { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
}
