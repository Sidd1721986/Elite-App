using EliteApp.API.Data;
using EliteApp.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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

    // Valid status values; used to reject unknown values from untrusted callers.
    private static readonly HashSet<string> KnownStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Submitted", "Assigned", "Accepted", "ReachedOut", "ApptSet",
        "Sale", "FollowUp", "Expired", "Completed", "InvoiceRequested", "Invoiced"
    };

    private static List<string> ParseCsvList(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new List<string>();
        return raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();
    }

    /// <summary>Statuses from which an admin may force-close a vendor-assigned job to Completed (e.g. vendor forgot to tap complete).</summary>
    private static bool IsAdminForceCompleteFromStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return false;
        var s = status.Trim();
        if (s.Equals("Completed", StringComparison.OrdinalIgnoreCase)
            || s.Equals("Invoiced", StringComparison.OrdinalIgnoreCase)
            || s.Equals("InvoiceRequested", StringComparison.OrdinalIgnoreCase)
            || s.Equals("Submitted", StringComparison.OrdinalIgnoreCase)
            || s.Equals("Assigned", StringComparison.OrdinalIgnoreCase)
            || s.Equals("Expired", StringComparison.OrdinalIgnoreCase))
            return false;

        return s.Equals("Sale", StringComparison.OrdinalIgnoreCase)
            || s.Equals("FollowUp", StringComparison.OrdinalIgnoreCase)
            || s.Equals("Follow Up", StringComparison.OrdinalIgnoreCase)
            || s.Equals("Accepted", StringComparison.OrdinalIgnoreCase)
            || s.Equals("ReachedOut", StringComparison.OrdinalIgnoreCase)
            || s.Equals("ApptSet", StringComparison.OrdinalIgnoreCase);
    }

    [HttpGet]
    [EnableRateLimiting("read-messages")]
    public async Task<IActionResult> GetJobs([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] bool includeSubJobs = false)
    {
        // Cap page size to prevent unbounded memory loads.
        pageSize = Math.Clamp(pageSize, 1, 200);
        // Negative or zero page causes a negative SQL OFFSET — clamp to 1.
        page = Math.Max(1, page);
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

        // Admin dashboard: include split children so one parent card can show partial assignment state.
        if (User.IsInRole("Admin") || User.IsInRole("admin"))
        {
            query = query.Include(j => j.ChildJobs).ThenInclude(c => c.Vendor);
        }

        if (User.IsInRole("Customer") || User.IsInRole("customer"))
        {
            query = query.Where(j => j.CustomerId == userId);
        }
        else if (User.IsInRole("Vendor") || User.IsInRole("vendor"))
        {
            // Vendors see jobs assigned to them
            query = query.Where(j => j.VendorId == userId);
            // Vendors should always see their assigned jobs even if they are sub-jobs
            includeSubJobs = true;
        }

        // Hide sub-jobs from main dashboard lists (Admin/Customer) unless requested
        if (!includeSubJobs)
        {
            query = query.Where(j => j.ParentJobId == null);
        }

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
            .Include(j => j.ChildJobs)
                .ThenInclude(c => c.Vendor)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (job == null) return NotFound();
        if (!CurrentUserCanAccessJob(userId, job)) return NotFound();

        return Ok(job);
    }

    [HttpPost]
    [EnableRateLimiting("create-job")]
    public async Task<IActionResult> CreateJob([FromBody] CreateJobRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        bool isAdmin = User.IsInRole("Admin") || User.IsInRole("admin");
        if (!User.IsInRole("Customer") && !User.IsInRole("customer") && !isAdmin)
            return StatusCode(403, new { message = "Only customers or admins (for splitting) can create service requests." });

        Guid targetCustomerId = userId;
        if (isAdmin && request.CustomerId != null)
        {
            targetCustomerId = request.CustomerId.Value;
        }

        if (string.IsNullOrWhiteSpace(request.Description) ||
            string.IsNullOrWhiteSpace(request.Address) ||
            string.IsNullOrWhiteSpace(request.ContactPhone) ||
            string.IsNullOrWhiteSpace(request.ContactEmail) ||
            request.Services == null || !request.Services.Any())
        {
            return BadRequest(new { message = "Services, Description, Address, ContactPhone, and ContactEmail are all mandatory fields." });
        }

        // Validate each service string: max 100 chars, alphanumeric + common punctuation only.
        // Rejects path-traversal sequences (../, /, \) and oversized payloads.
        var invalidServiceChars = new System.Text.RegularExpressions.Regex(@"[^\w\s\-,&'().]+");
        foreach (var svc in request.Services)
        {
            if (string.IsNullOrWhiteSpace(svc) || svc.Length > 100 || invalidServiceChars.IsMatch(svc))
                return BadRequest(new { message = $"Invalid service value: '{svc}'. Services must be plain text, max 100 characters each." });
        }

        int nextJobNumber;
        string? suffix = null;

        if (request.ParentJobId != null)
        {
            var parentJob = await _context.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == request.ParentJobId);
            if (parentJob == null) return BadRequest(new { message = "Parent job not found." });
            
            nextJobNumber = parentJob.JobNumber;
            // Find how many sub-jobs this parent already has to determine the suffix (A, B, C...)
            int existingKids = await _context.Jobs.CountAsync(j => j.ParentJobId == request.ParentJobId);
            suffix = ((char)('A' + existingKids)).ToString();
        }
        else
        {
            // Manual increment for parent jobs
            int maxJobNumber = await _context.Jobs.AnyAsync() 
                ? await _context.Jobs.MaxAsync(j => j.JobNumber) 
                : 1000;
            nextJobNumber = maxJobNumber + 1;
        }

        var job = new Job
        {
            Id = Guid.NewGuid(),
            CustomerId = targetCustomerId,
            Description = request.Description,
            Address = request.Address,
            Urgency = request.Urgency,
            OtherDetails = request.OtherDetails,
            Photos = request.Photos != null ? string.Join(",", request.Photos) : null,
            Status = "Submitted",
            ContactPhone = request.ContactPhone,
            ContactEmail = request.ContactEmail,
            ParentJobId = request.ParentJobId,
            JobNumber = nextJobNumber,
            JobSuffix = suffix,
            Services = request.Services != null ? string.Join(",", request.Services) : null,
            CreatedAt = DateTime.UtcNow
        };

        // Admin split: child job must be assigned immediately (otherwise it appears as a second "Submitted" request).
        if (request.ParentJobId != null && request.VendorId.HasValue && request.VendorId.Value != Guid.Empty)
        {
            if (!isAdmin)
                return StatusCode(403, new { message = "Only admins can create vendor-assigned split jobs." });

            var splitVendorId = request.VendorId.Value;
            var vendor = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == splitVendorId && u.Role == "Vendor" && u.IsApproved && u.IsActive);
            if (vendor == null)
                return BadRequest(new { message = "The specified vendor does not exist, is not approved, or is inactive." });

            job.VendorId = splitVendorId;
            job.Status = "Assigned";
            job.AssignedAt = DateTime.UtcNow;
        }

        _context.Jobs.Add(job);
        await _context.SaveChangesAsync();

        // Populate the Customer navigation property on the tracked entity
        // instead of issuing a second SELECT round-trip.
        await _context.Entry(job).Reference(j => j.Customer).LoadAsync();
        if (job.VendorId != null)
            await _context.Entry(job).Reference(j => j.Vendor).LoadAsync();
        return CreatedAtAction(nameof(GetJob), new { id = job.Id }, job);
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

        // Admin: clear vendor via PUT (same contract as POST .../unassign-vendor) so older proxies/routes still hit UpdateJob.
        if (request.ClearAssignedVendor)
        {
            if (!isAdmin)
                return BadRequest(new { message = "Only admins can unassign the vendor." });

            if (job.Status == "Completed" || job.Status == "Invoiced")
                return BadRequest(new { message = $"Cannot unassign vendor for a job that is already {job.Status.ToLower()}." });

            if (job.VendorId != null)
            {
                var prevVendor = await _context.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == job.VendorId);
                var previousName = prevVendor?.Name ?? "Unknown vendor";

                job.VendorId = null;
                job.AssignedAt = null;
                job.AcceptedAt = null;
                job.Status = "Submitted";

                _context.JobNotes.Add(new JobNote
                {
                    Id = Guid.NewGuid(),
                    JobId = id,
                    AuthorId = userId,
                    Content = $"Vendor unassigned by admin. Previous vendor: {previousName}.",
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        // Mobile unassign sends only { clearAssignedVendor: true }. Parent/shell jobs may have empty Services
        // after splits — do not block unassign on the general "required fields" check used for full edits.
        var isVendorUnassignOnly = isAdmin && request.ClearAssignedVendor
            && request.Status == null
            && request.Description == null
            && request.Address == null
            && request.Urgency == null
            && request.OtherDetails == null
            && request.Photos == null
            && request.Services == null
            && request.ContactPhone == null
            && request.ContactEmail == null;

        if (isVendorUnassignOnly)
        {
            await _context.SaveChangesAsync();
            await _context.Entry(job).Reference(j => j.Customer).LoadAsync();
            await _context.Entry(job).Reference(j => j.Vendor).LoadAsync();
            return Ok(job);
        }

        // Customers must not be able to advance the status themselves — that is the
        // workflow of vendors and admins.  Only admins may change status via this endpoint
        // (vendors use dedicated action endpoints like /accept, /complete-sale, etc.).
        if (request.Status != null)
        {
            if (!isAdmin)
                return BadRequest(new { message = "Job status can only be changed through dedicated workflow actions." });
            if (!KnownStatuses.Contains(request.Status))
                return BadRequest(new { message = $"Invalid status value '{request.Status}'." });
            job.Status = request.Status;
        }
        if (request.Description != null) job.Description = request.Description;
        if (request.Address != null) job.Address = request.Address;
        if (request.Urgency != null) job.Urgency = request.Urgency;
        if (request.OtherDetails != null) job.OtherDetails = request.OtherDetails;
        if (request.Photos != null) job.Photos = string.Join(",", request.Photos);
        if (request.Services != null) job.Services = string.Join(",", request.Services);
        if (request.ContactPhone != null) job.ContactPhone = request.ContactPhone;
        if (request.ContactEmail != null) job.ContactEmail = request.ContactEmail;

        // Final validation to ensure mandatory fields weren't cleared
        var missingFields = new List<string>();
        if (string.IsNullOrWhiteSpace(job.Description)) missingFields.Add("Description");
        if (string.IsNullOrWhiteSpace(job.Address)) missingFields.Add("Address");
        if (string.IsNullOrWhiteSpace(job.ContactPhone)) missingFields.Add("Contact Phone");
        if (string.IsNullOrWhiteSpace(job.ContactEmail)) missingFields.Add("Contact Email");
        // In split-assignment flow, parent jobs can legitimately have no remaining services
        // once all scopes are delegated to child jobs.
        var hasChildAssignments = await _context.Jobs.AsNoTracking().AnyAsync(j => j.ParentJobId == id);
        if (string.IsNullOrWhiteSpace(job.Services) && !hasChildAssignments) missingFields.Add("Services");

        if (missingFields.Any())
        {
            return BadRequest(new { message = $"Cannot update job. The following fields are required: {string.Join(", ", missingFields)}" });
        }

        // Do NOT set EntityState.Modified explicitly — EF Core's change tracker
        // already detects which columns changed and generates a minimal UPDATE statement.
        // Setting Modified marks every column dirty, causing unnecessary DB writes.
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "Job was modified by another request. Please refresh and try again." });
        }

        // Populate navigation properties on the already-tracked entity instead of
        // issuing a second SELECT round-trip.
        await _context.Entry(job).Reference(j => j.Customer).LoadAsync();
        await _context.Entry(job).Reference(j => j.Vendor).LoadAsync();
        return Ok(job);
    }

    [HttpPost("{id}/assign")]
    public async Task<IActionResult> AssignVendor(Guid id, [FromBody] AssignVendorRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var adminId)) return Unauthorized();

        bool isAdmin = User.IsInRole("Admin") || User.IsInRole("admin");
        if (!isAdmin) return StatusCode(403, new { message = "Forbidden: Admin access required." });

        var job = await _context.Jobs.Include(j => j.Customer).Include(j => j.Vendor).FirstOrDefaultAsync(j => j.Id == id);
        if (job == null) return NotFound(new { message = "Job not found" });

        if (job.Status == "Completed" || job.Status == "Invoiced")
        {
            return BadRequest(new { message = $"Cannot change vendor for a job that is already {job.Status.ToLower()}." });
        }

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

        // Validate that the target vendor exists, is active, and is approved.
        if (request.VendorId == Guid.Empty)
            return BadRequest(new { message = "VendorId is required." });

        var vendor = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.VendorId && u.Role == "Vendor" && u.IsApproved && u.IsActive);
        if (vendor == null)
            return BadRequest(new { message = "The specified vendor does not exist, is not approved, or is inactive." });

        string noteContent;
        if (job.VendorId != null && job.VendorId != request.VendorId)
        {
            var oldVendorName = job.Vendor?.Name ?? "Unknown Vendor";
            noteContent = $"Vendor reassigned by admin. Previous vendor: {oldVendorName}.";
        }
        else
        {
            noteContent = "Vendor assigned to job by admin.";
        }

        job.VendorId = request.VendorId;
        job.Status = "Assigned";
        job.AssignedAt = DateTime.UtcNow;
        job.AcceptedAt = null; // Reset acceptance for new vendor

        _context.JobNotes.Add(new JobNote
        {
            Id = Guid.NewGuid(), JobId = id, AuthorId = adminId,
            Content = noteContent, CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        // Load navigation properties on the tracked entity — avoids a second SELECT.
        await _context.Entry(job).Reference(j => j.Customer).LoadAsync();
        await _context.Entry(job).Reference(j => j.Vendor).LoadAsync();
        return Ok(job);
    }

    /// <summary>Admin-only: clears the assigned vendor and returns the job to Submitted.</summary>
    [HttpPost("{id}/unassign-vendor")]
    public async Task<IActionResult> UnassignVendor(Guid id)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var adminId)) return Unauthorized();

        if (!User.IsInRole("Admin") && !User.IsInRole("admin"))
            return StatusCode(403, new { message = "Forbidden: Admin access required." });

        var job = await _context.Jobs.Include(j => j.Vendor).FirstOrDefaultAsync(j => j.Id == id);
        if (job == null) return NotFound(new { message = "Job not found" });

        if (job.VendorId == null)
        {
            await _context.Entry(job).Reference(j => j.Customer).LoadAsync();
            await _context.Entry(job).Reference(j => j.Vendor).LoadAsync();
            return Ok(job);
        }

        if (job.Status == "Completed" || job.Status == "Invoiced")
            return BadRequest(new { message = $"Cannot unassign vendor for a job that is already {job.Status.ToLower()}." });

        var previousName = job.Vendor?.Name ?? "Unknown vendor";

        job.VendorId = null;
        job.Vendor = null;
        job.Status = "Submitted";
        job.AssignedAt = null;
        job.AcceptedAt = null;

        _context.JobNotes.Add(new JobNote
        {
            Id = Guid.NewGuid(),
            JobId = id,
            AuthorId = adminId,
            Content = $"Vendor unassigned by admin. Previous vendor: {previousName}.",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        await _context.Entry(job).Reference(j => j.Customer).LoadAsync();
        await _context.Entry(job).Reference(j => j.Vendor).LoadAsync();
        return Ok(job);
    }

    /// <summary>
    /// Admin-only: unassigns one vendor from a split parent job by deleting that vendor's child assignments
    /// and merging their services back to the parent scope.
    /// </summary>
    [HttpPost("{id}/unassign-scope-vendor")]
    public async Task<IActionResult> UnassignVendorScope(Guid id, [FromBody] UnassignVendorScopeRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var adminId)) return Unauthorized();

        if (!User.IsInRole("Admin") && !User.IsInRole("admin"))
            return StatusCode(403, new { message = "Forbidden: Admin access required." });

        if (request.VendorId == Guid.Empty)
            return BadRequest(new { message = "VendorId is required." });

        var parent = await _context.Jobs
            .Include(j => j.Customer)
            .Include(j => j.Vendor)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (parent == null) return NotFound(new { message = "Parent job not found." });

        var assignedChildren = await _context.Jobs
            .Include(j => j.Vendor)
            .Where(j => j.ParentJobId == id && j.VendorId == request.VendorId)
            .ToListAsync();

        // Fallback: if this is a direct parent assignment (not split), reuse the existing unassign logic.
        if (!assignedChildren.Any())
        {
            if (parent.VendorId == request.VendorId)
                return await UnassignVendor(id);
            return BadRequest(new { message = "No assignments found for this vendor on the selected job." });
        }

        if (assignedChildren.Any(j => j.Status == "Completed" || j.Status == "Invoiced"))
            return BadRequest(new { message = "Cannot unassign a vendor with completed or invoiced scope." });

        var parentServices = ParseCsvList(parent.Services);
        var parentPhotos = ParseCsvList(parent.Photos);
        foreach (var child in assignedChildren)
        {
            var childServices = ParseCsvList(child.Services);
            foreach (var service in childServices)
            {
                if (!parentServices.Contains(service, StringComparer.OrdinalIgnoreCase))
                    parentServices.Add(service);
            }

            foreach (var photo in ParseCsvList(child.Photos))
            {
                if (!parentPhotos.Contains(photo, StringComparer.Ordinal))
                    parentPhotos.Add(photo);
            }
        }

        parent.Services = parentServices.Any() ? string.Join(",", parentServices) : parent.Services;
        parent.Photos = parentPhotos.Any() ? string.Join(",", parentPhotos) : null;

        var removedCount = assignedChildren.Count;
        var previousVendorName = assignedChildren.First().Vendor?.Name ?? "Unknown vendor";

        _context.Jobs.RemoveRange(assignedChildren);

        var hasAnyRemainingAssignments = await _context.Jobs.AnyAsync(j => j.ParentJobId == id && j.VendorId != null && !assignedChildren.Select(c => c.Id).Contains(j.Id));
        if (!hasAnyRemainingAssignments && parent.VendorId == null)
            parent.Status = "Submitted";
        else
            parent.Status = "Assigned";

        _context.JobNotes.Add(new JobNote
        {
            Id = Guid.NewGuid(),
            JobId = id,
            AuthorId = adminId,
            Content = $"Vendor scope unassigned by admin. Vendor: {previousVendorName}. Removed assignments: {removedCount}.",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        await _context.Entry(parent).Collection(p => p.ChildJobs).LoadAsync();
        foreach (var child in parent.ChildJobs)
            await _context.Entry(child).Reference(c => c.Vendor).LoadAsync();

        return Ok(parent);
    }

    [HttpPost("{id}/accept")]
    public async Task<IActionResult> AcceptJob(Guid id)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        if (job.VendorId != userId) return Forbid();

        if (job.Status != "Assigned")
            return BadRequest(new { message = "Job must be in 'Assigned' status before accepting." });

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

        if (string.IsNullOrWhiteSpace(request.Content))
            return BadRequest(new { message = "Note content cannot be empty." });
        if (request.Content.Length > 5000)
            return BadRequest(new { message = "Note content exceeds the maximum length of 5,000 characters." });

        var note = new JobNote
        {
            JobId = id,
            AuthorId = userId,
            Content = request.Content,
            CreatedAt = DateTime.UtcNow
        };

        _context.JobNotes.Add(note);
        await _context.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, note);
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
            .AsNoTracking()
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

        if (string.IsNullOrWhiteSpace(request.ScopeOfWork))
            return BadRequest(new { message = "Scope of work is required." });
        if (request.ContractAmount <= 0)
            return BadRequest(new { message = "Contract amount must be greater than zero." });
        if (request.WorkStartDate == default || request.WorkStartDate.Date < DateTime.UtcNow.Date)
            return BadRequest(new { message = "A valid future work start date is required." });

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

        var isAdmin = User.IsInRole("Admin") || User.IsInRole("admin");

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        if (isAdmin)
        {
            if (job.VendorId == null)
                return BadRequest(new { message = "Cannot mark complete: this job has no assigned vendor." });
            if (!IsAdminForceCompleteFromStatus(job.Status))
                return BadRequest(new { message = $"Cannot mark complete from status '{job.Status}'. Use the normal workflow when possible." });

            _context.JobNotes.Add(new JobNote
            {
                Id = Guid.NewGuid(),
                JobId = id,
                AuthorId = userId,
                Content = "Job marked complete by admin (vendor had not finalized in the app).",
                CreatedAt = DateTime.UtcNow
            });
        }
        else
        {
            if (job.VendorId != userId) return Forbid();
        }

        job.Status = "Completed";
        if (request.CompletedPhotos != null && request.CompletedPhotos.Any())
        {
            job.CompletedPhotos = string.Join(",", request.CompletedPhotos);
        }

        await _context.SaveChangesAsync();
        return Ok(job);
    }

    [HttpPost("{id}/request-invoice")]
    public async Task<IActionResult> RequestInvoice(Guid id)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var adminId)) return Unauthorized();

        if (!User.IsInRole("Admin") && !User.IsInRole("admin"))
            return Forbid();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        job.Status = "InvoiceRequested";
        job.InvoiceRequestedAt = DateTime.UtcNow;

        // Add audit note
        var note = new JobNote
        {
            Id = Guid.NewGuid(),
            JobId = id,
            AuthorId = adminId,
            Content = "Invoice requested from vendor by admin.",
            CreatedAt = DateTime.UtcNow
        };
        _context.JobNotes.Add(note);

        await _context.SaveChangesAsync();
        return Ok(job);
    }

    [HttpPost("{id}/upload-invoice")]
    public async Task<IActionResult> UploadInvoice(Guid id, [FromBody] UploadInvoiceRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        if (job.VendorId != userId) return Forbid();

        if (job.Status != "InvoiceRequested")
            return BadRequest(new { message = "Invoice can only be uploaded after admin requests it." });
        if (string.IsNullOrWhiteSpace(request.InvoiceDocumentUrl))
            return BadRequest(new { message = "Invoice document URL is required." });

        job.Status = "Invoiced";
        job.IsInvoiced = true;
        job.InvoiceDocumentUrl = request.InvoiceDocumentUrl;
        job.InvoicedAt = DateTime.UtcNow;

        // Add audit note
        var note = new JobNote
        {
            Id = Guid.NewGuid(),
            JobId = id,
            AuthorId = userId,
            Content = "Invoice document uploaded by vendor.",
            CreatedAt = DateTime.UtcNow
        };
        _context.JobNotes.Add(note);

        await _context.SaveChangesAsync();
        return Ok(job);
    }

    [HttpPost("{id}/photos")]
    public async Task<IActionResult> AddJobPhotos(Guid id, [FromBody] AddPhotosRequest request)
    {
        var userIdString = User.FindFirstValue("id");
        if (!Guid.TryParse(userIdString, out var userId)) return Unauthorized();

        var job = await _context.Jobs.FindAsync(id);
        if (job == null) return NotFound();

        // Check if Caller is assigned Vendor or Admin
        bool isAdmin = User.IsInRole("Admin") || User.IsInRole("admin");
        if (job.VendorId != userId && !isAdmin)
        {
            return StatusCode(403, new { message = "Forbidden: You are not assigned to this job." });
        }

        if (request.Photos == null || !request.Photos.Any())
            return BadRequest(new { message = "No photos provided." });

        // Append to existing photos
        var existingPhotos = !string.IsNullOrEmpty(job.Photos) 
            ? job.Photos.Split(',').ToList() 
            : new List<string>();
        
        existingPhotos.AddRange(request.Photos);
        job.Photos = string.Join(",", existingPhotos);

        // Add audit note
        var authorName = User.FindFirstValue(ClaimTypes.Name) ?? "Vendor";
        var note = new JobNote
        {
            Id = Guid.NewGuid(),
            JobId = id,
            AuthorId = userId,
            Content = $"{authorName} added additional job photos.",
            CreatedAt = DateTime.UtcNow
        };
        _context.JobNotes.Add(note);

        await _context.SaveChangesAsync();
        return Ok(job);
    }
}

public class AddPhotosRequest
{
    public List<string> Photos { get; set; } = new();
}

public class UploadInvoiceRequest
{
    public string InvoiceDocumentUrl { get; set; } = string.Empty;
}

public class AssignVendorRequest
{
    public Guid VendorId { get; set; }
}

public class UnassignVendorScopeRequest
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
    public List<string>? Services { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? ParentJobId { get; set; }

    /// <summary>When creating a split child (<see cref="ParentJobId"/>), admin may assign the vendor immediately.</summary>
    public Guid? VendorId { get; set; }
}

public class UpdateJobRequest
{
    /// <summary>When true (admin only), clears VendorId and returns the job to Submitted.</summary>
    public bool ClearAssignedVendor { get; set; }

    public string? Status { get; set; }
    public string? Description { get; set; }
    public string? Address { get; set; }
    public string? Urgency { get; set; }
    public string? OtherDetails { get; set; }
    public List<string>? Photos { get; set; }
    public List<string>? Services { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
}
