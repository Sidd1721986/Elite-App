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
        // Use IsInRole (reads the configured RoleClaimType = ClaimTypes.Role) like the rest of
        // the app. The previous FindFirstValue("role") read the short claim, which JWT's default
        // inbound claim-mapping renames — so every dashboard endpoint silently 403'd for admins.
        return User.IsInRole("Admin") ||
            string.Equals(User.FindFirstValue("role"), "Admin", StringComparison.OrdinalIgnoreCase);
    }

    // ── Summary KPIs ─────────────────────────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        if (!IsAdmin()) return Forbid();

        // Aggregate in the DB instead of materializing whole Jobs/Users tables into memory.
        var weekAgo = DateTime.UtcNow.AddDays(-7);
        var parentJobs = _context.Jobs.Where(j => j.ParentJobId == null);

        // One grouped query returns only (status, count) pairs — not every job row.
        var statusGroups = await parentJobs
            .GroupBy(j => j.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        int CountOf(params string[] statuses) =>
            statusGroups.Where(g => statuses.Contains(g.Status)).Sum(g => g.Count);

        var totalJobs       = statusGroups.Sum(g => g.Count);
        var completedJobs   = CountOf("Completed", "Invoiced");
        var salesJobs       = CountOf("Sale", "Completed", "Invoiced", "InvoiceRequested");
        var cancelledJobs   = CountOf("Expired");
        var activeJobs      = totalJobs - CountOf("Expired", "Completed", "Invoiced");
        var conversionRate  = totalJobs > 0 ? Math.Round((double)salesJobs / totalJobs * 100, 1) : 0;
        var totalRevenue    = await parentJobs.Where(j => j.ContractAmount.HasValue).SumAsync(j => j.ContractAmount!.Value);
        var jobsThisWeek    = await parentJobs.CountAsync(j => j.CreatedAt >= weekAgo);

        var approvedVendors = await _context.Users.CountAsync(u => u.Role == "Vendor" && u.IsApproved);
        var pendingVendors  = await _context.Users.CountAsync(u => u.Role == "Vendor" && !u.IsApproved);
        var totalCustomers  = await _context.Users.CountAsync(u => u.Role == "Customer");

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

        // O(1) lookups instead of an O(vendors × groups) in-memory FirstOrDefault join.
        var jobCounts = (await _context.Jobs
            .Where(j => j.VendorId != null)
            .GroupBy(j => j.VendorId)
            .Select(g => new { VendorId = g.Key, Total = g.Count(), Completed = g.Count(j => j.Status == "Completed" || j.Status == "Invoiced"), Revenue = g.Where(j => j.ContractAmount.HasValue).Sum(j => j.ContractAmount!.Value) })
            .ToListAsync())
            .ToDictionary(j => j.VendorId!.Value);

        var result = vendors.Select(v =>
        {
            jobCounts.TryGetValue(v.Id, out var stats);
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

        // Aggregate per month in the DB (returns ~6 rows) instead of materializing 6 months of jobs.
        var grouped = await _context.Jobs
            .Where(j => j.ParentJobId == null && j.CreatedAt >= sixMonthsAgo)
            .GroupBy(j => new { j.CreatedAt.Year, j.CreatedAt.Month })
            .Select(g => new
            {
                year     = g.Key.Year,
                month    = g.Key.Month,
                requests = g.Count(),
                sales    = g.Count(j => j.Status == "Sale" || j.Status == "Completed" || j.Status == "Invoiced"),
                revenue  = g.Where(j => j.ContractAmount.HasValue).Sum(j => j.ContractAmount!.Value)
            })
            .ToListAsync();

        // Build month labels client-side (ToString isn't SQL-translatable) from the small result.
        var trend = grouped
            .OrderBy(g => g.year).ThenBy(g => g.month)
            .Select(g => new
            {
                g.year,
                g.month,
                label    = new DateTime(g.year, g.month, 1).ToString("MMM yyyy"),
                g.requests,
                g.sales,
                g.revenue
            })
            .ToList();

        return Ok(trend);
    }
}
