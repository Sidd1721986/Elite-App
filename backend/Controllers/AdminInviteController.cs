using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EliteApp.API.Data;
using EliteApp.API.Models;
using EliteApp.API.Services.Email;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EliteApp.API.Controllers;

[ApiController]
public class AdminInviteController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IEmailSender _emailSender;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminInviteController> _logger;

    public AdminInviteController(
        AppDbContext context,
        IEmailSender emailSender,
        IConfiguration configuration,
        ILogger<AdminInviteController> logger)
    {
        _context = context;
        _emailSender = emailSender;
        _configuration = configuration;
        _logger = logger;
    }

    // POST /api/admin/invite — Admin sends an invite to a new admin by email.
    [Authorize(Roles = "Admin")]
    [HttpPost("api/admin/invite")]
    public async Task<IActionResult> SendInvite([FromBody] AdminInviteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Email is required." });

        var email = request.Email.Trim().ToLowerInvariant();

        var adminId = User.FindFirst("id")?.Value;
        if (!Guid.TryParse(adminId, out var adminGuid))
            return Unauthorized();

        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email))
            return Conflict(new { message = "An account with this email already exists." });

        // Invalidate any pending invites for this email.
        await _context.AdminInvites
            .Where(i => i.Email.ToLower() == email && !i.Used)
            .ExecuteDeleteAsync();

        var plainToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        var tokenHash = HashToken(plainToken);

        var expiryHours = 48;
        _context.AdminInvites.Add(new AdminInvite
        {
            Email = email,
            TokenHash = tokenHash,
            InvitedByAdminId = adminGuid,
            ExpiresAt = DateTime.UtcNow.AddHours(expiryHours),
        });
        await _context.SaveChangesAsync();

        var baseUrl = _configuration["App:BaseUrl"] ?? "https://eliteapp-api-prod.azurewebsites.net";
        var inviteUrl = $"{baseUrl}/invite?token={Uri.EscapeDataString(plainToken)}&email={Uri.EscapeDataString(email)}";

        var subject = "You've been invited to join Elite Home Services as an Admin";
        var plainBody = $"Hello,\n\nYou have been invited to become an Admin on the Elite Home Services app.\n\nTap the link below on your mobile device to accept the invite (expires in {expiryHours} hours):\n\n{inviteUrl}\n\nIf you did not expect this invite, you can ignore this email.";
        var htmlBody = $@"
<div style=""font-family:sans-serif;max-width:600px;margin:auto;"">
  <h2 style=""color:#6366F1;"">Elite Home Services</h2>
  <p>You've been invited to join <strong>Elite Home Services</strong> as an <strong>Admin</strong>.</p>
  <p>Tap the button below on your mobile device to accept (expires in <strong>{expiryHours} hours</strong>):</p>
  <a href=""{inviteUrl}"" style=""display:inline-block;padding:14px 28px;background:#6366F1;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;"">Accept Invite</a>
  <p style=""color:#888;font-size:13px;"">If the button doesn't work, copy and open this link in your browser:<br/><a href=""{inviteUrl}"">{inviteUrl}</a></p>
  <p style=""color:#aaa;font-size:12px;"">If you didn't expect this invite, you can safely ignore this email.</p>
</div>";

        try
        {
            await _emailSender.SendAsync(email, subject, plainBody, htmlBody);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send admin invite email to {Email}", email);
            return StatusCode(503, new { message = "Could not send invite email. Please try again." });
        }

        _logger.LogInformation("Admin invite sent to {Email} by admin {AdminId}", email, adminGuid);
        return Ok(new { message = $"Invite sent to {email}." });
    }

    // GET /invite — Smart landing page: tries deep link, shows download buttons if app not installed.
    [AllowAnonymous]
    [HttpGet("/invite")]
    public IActionResult InviteLanding([FromQuery] string token, [FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(email))
            return Content("<h2>Invalid invite link.</h2>", "text/html");

        var deepLink = $"eliteapp://admin-register?token={Uri.EscapeDataString(token)}&email={Uri.EscapeDataString(email)}";
        var appStoreUrl = _configuration["App:iOSStoreUrl"] ?? "https://apps.apple.com/app/id123456789";
        var playStoreUrl = _configuration["App:AndroidStoreUrl"] ?? "https://play.google.com/store/apps/details?id=com.elitehomeservicesusa.app";

        var html = $@"<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8""/>
  <meta name=""viewport"" content=""width=device-width,initial-scale=1""/>
  <title>Elite Home Services — Admin Invite</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}}
    .card{{background:#fff;border-radius:16px;padding:40px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}}
    .logo{{font-size:28px;font-weight:700;color:#6366F1;margin-bottom:8px}}
    h1{{font-size:20px;color:#111;margin-bottom:12px}}
    p{{color:#555;font-size:15px;line-height:1.5;margin-bottom:24px}}
    .btn{{display:block;width:100%;padding:14px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;margin-bottom:12px;cursor:pointer;border:none}}
    .btn-primary{{background:#6366F1;color:#fff}}
    .btn-store{{background:#111;color:#fff}}
    .btn-store.android{{background:#01875f}}
    .divider{{color:#aaa;font-size:13px;margin:8px 0 16px}}
    .note{{color:#aaa;font-size:12px;margin-top:20px}}
  </style>
</head>
<body>
<div class=""card"">
  <div class=""logo"">Elite</div>
  <h1>You're invited as an Admin</h1>
  <p>You've been invited to manage the Elite Home Services app as an Admin.</p>

  <a class=""btn btn-primary"" href=""{deepLink}"" id=""openBtn"">Open in App</a>

  <div class=""divider"">— Don't have the app yet? —</div>

  <a class=""btn btn-store"" href=""{appStoreUrl}"">Download on the App Store</a>
  <a class=""btn btn-store android"" href=""{playStoreUrl}"">Get it on Google Play</a>

  <p class=""note"">After installing, return to this email and tap <strong>Open in App</strong> again.</p>
</div>
<script>
  // Try to open the app automatically. If it fails (app not installed),
  // the user stays on this page and sees the download buttons.
  setTimeout(function() {{
    window.location.href = '{deepLink}';
  }}, 500);
</script>
</body>
</html>";

        return Content(html, "text/html");
    }

    private string HashToken(string plaintext)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(plaintext));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

public class AdminInviteRequest
{
    public string Email { get; set; } = string.Empty;
}
