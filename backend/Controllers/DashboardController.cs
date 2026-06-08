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
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;

    public DashboardController(AppDbContext context)
    {
        _context = context;
    }

    private bool IsAdmin()
    {
        var role = User.FindFirstValue("role");
        return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
    }

    // ── Summary KPIs ─────────────────────────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        if (!IsAdmin()) return Forbid();

        var jobs = await _context.Jobs.Where(j => j.ParentJobId == null).ToListAsync();
        var vendors = await _context.Users.Where(u => u.Role == "Vendor").ToListAsync();
        var customers = await _context.Users.Where(u => u.Role == "Customer").ToListAsync();

        var totalJobs       = jobs.Count;
        var completedJobs   = jobs.Count(j => j.Status == "Completed" || j.Status == "Invoiced");
        var salesJobs       = jobs.Count(j => j.Status == "Sale" || j.Status == "Completed" || j.Status == "Invoiced" || j.Status == "InvoiceRequested");
        var cancelledJobs   = jobs.Count(j => j.Status == "Expired");
        var activeJobs      = jobs.Count(j => j.Status != "Expired" && j.Status != "Completed" && j.Status != "Invoiced");
        var conversionRate  = totalJobs > 0 ? Math.Round((double)salesJobs / totalJobs * 100, 1) : 0;
        var totalRevenue    = jobs.Where(j => j.ContractAmount.HasValue).Sum(j => j.ContractAmount!.Value);
        var approvedVendors = vendors.Count(v => v.IsApproved);
        var pendingVendors  = vendors.Count(v => !v.IsApproved);
        var totalCustomers  = customers.Count;

        // Jobs this week
        var weekAgo = DateTime.UtcNow.AddDays(-7);
        var jobsThisWeek = jobs.Count(j => j.CreatedAt >= weekAgo);

        return Ok(new
        {
            totalJobs,
            completedJobs,
            salesJobs,
            cancelledJobs,
            activeJobs,
            conversionRate,
            totalRevenue,
            approvedVendors,
            pendingVendors,
            totalCustomers,
            jobsThisWeek
        });
    }

    // ── Funnel (status breakdown) ─────────────────────────────────────────────
    [HttpGet("funnel")]
    public async Task<IActionResult> GetFunnel()
    {
        if (!IsAdmin()) return Forbid();

        var statusOrder = new[] { "Submitted", "Assigned", "Accepted", "ReachedOut", "ApptSet", "Sale", "FollowUp", "Expired", "Completed", "InvoiceRequested", "Invoiced" };

        var counts = await _context.Jobs
            .Where(j => j.ParentJobId == null)
            .GroupBy(j => j.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var result = statusOrder.Select(s => new
        {
            status = s,
            count  = counts.FirstOrDefault(c => c.Status == s)?.Count ?? 0
        });

        return Ok(result);
    }

    // ── Vendor leaderboard ────────────────────────────────────────────────────
    [HttpGet("vendors")]
    public async Task<IActionResult> GetVendors()
    {
        if (!IsAdmin()) return Forbid();

        var vendors = await _context.Users
            .Where(u => u.Role == "Vendor")
            .ToListAsync();

        var jobCounts = await _context.Jobs
            .Where(j => j.VendorId != null)
            .GroupBy(j => j.VendorId)
            .Select(g => new { VendorId = g.Key, Total = g.Count(), Completed = g.Count(j => j.Status == "Completed" || j.Status == "Invoiced"), Revenue = g.Where(j => j.ContractAmount.HasValue).Sum(j => j.ContractAmount!.Value) })
            .ToListAsync();

        var result = vendors.Select(v =>
        {
            var stats = jobCounts.FirstOrDefault(j => j.VendorId == v.Id);
            return new
            {
                id         = v.Id,
                name       = v.Name,
                email      = v.Email,
                isApproved = v.IsApproved,
                isActive   = v.IsActive,
                joinedAt   = v.CreatedAt,
                totalJobs  = stats?.Total ?? 0,
                completedJobs = stats?.Completed ?? 0,
                revenue    = stats?.Revenue ?? 0
            };
        })
        .OrderByDescending(v => v.totalJobs)
        .ToList();

        return Ok(result);
    }

    // ── Live activity feed ────────────────────────────────────────────────────
    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity()
    {
        if (!IsAdmin()) return Forbid();

        var recentJobs = await _context.Jobs
            .Include(j => j.Customer)
            .Include(j => j.Vendor)
            .Where(j => j.ParentJobId == null)
            .OrderByDescending(j => j.CreatedAt)
            .Take(30)
            .Select(j => new
            {
                type        = "job",
                id          = j.Id,
                jobNumber   = j.JobNumber,
                status      = j.Status,
                description = j.Description.Length > 60 ? j.Description.Substring(0, 60) + "…" : j.Description,
                customer    = j.Customer != null ? j.Customer.Name : "Unknown",
                vendor      = j.Vendor != null ? j.Vendor.Name : (string?)null,
                services    = j.Services,
                urgency     = j.Urgency,
                amount      = j.ContractAmount,
                timestamp   = j.CreatedAt
            })
            .ToListAsync();

        var recentUsers = await _context.Users
            .OrderByDescending(u => u.CreatedAt)
            .Take(10)
            .Select(u => new
            {
                type      = "signup",
                id        = u.Id,
                name      = u.Name,
                role      = u.Role,
                timestamp = u.CreatedAt
            })
            .ToListAsync();

        // Merge and sort by timestamp
        var activity = recentJobs
            .Select(j => new { j.type, label = $"Job #{j.jobNumber} — {j.customer} ({j.status})", j.timestamp, extra = j.services ?? j.description })
            .Cast<object>()
            .Concat(recentUsers.Select(u => new { type = u.type, label = $"New {u.role}: {u.name}", timestamp = u.timestamp, extra = u.role } as object))
            .OrderByDescending(x => ((dynamic)x).timestamp)
            .Take(25)
            .ToList();

        return Ok(activity);
    }

    // ── Monthly trend (last 6 months) ─────────────────────────────────────────
    [HttpGet("trend")]
    public async Task<IActionResult> GetTrend()
    {
        if (!IsAdmin()) return Forbid();

        var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);

        var jobs = await _context.Jobs
            .Where(j => j.ParentJobId == null && j.CreatedAt >= sixMonthsAgo)
            .ToListAsync();

        var trend = jobs
            .GroupBy(j => new { j.CreatedAt.Year, j.CreatedAt.Month })
            .Select(g => new
            {
                year     = g.Key.Year,
                month    = g.Key.Month,
                label    = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yyyy"),
                requests = g.Count(),
                sales    = g.Count(j => j.Status == "Sale" || j.Status == "Completed" || j.Status == "Invoiced"),
                revenue  = g.Where(j => j.ContractAmount.HasValue).Sum(j => j.ContractAmount!.Value)
            })
            .OrderBy(g => g.year).ThenBy(g => g.month)
            .ToList();

        return Ok(trend);
    }
}
