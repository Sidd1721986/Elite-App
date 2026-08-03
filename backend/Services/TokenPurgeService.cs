using EliteApp.API.Data;
using Microsoft.EntityFrameworkCore;

namespace EliteApp.API.Services;

/// <summary>
/// Purges long-expired password-reset tokens once a day. Replaces the former boot-time
/// delete, which ran on every instance start — wasteful under scale-out and rolling restarts.
/// </summary>
public sealed class TokenPurgeService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    private static readonly TimeSpan InitialDelay = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TokenPurgeService> _logger;

    public TokenPurgeService(IServiceScopeFactory scopeFactory, ILogger<TokenPurgeService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Small delay so the purge never competes with startup migrations/seeding.
        try { await Task.Delay(InitialDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var deleted = await db.PasswordResetTokens
                    .Where(t => t.ExpiresAt < DateTime.UtcNow.AddDays(-7))
                    .ExecuteDeleteAsync(stoppingToken);
                if (deleted > 0)
                    _logger.LogInformation("Purged {Count} expired password reset tokens.", deleted);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Password reset token purge failed; will retry next cycle.");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }
}
