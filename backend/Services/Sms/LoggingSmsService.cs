namespace EliteApp.API.Services.Sms;

/// <summary>
/// No-op SMS sender used when Twilio credentials are not configured.
/// Logs every attempted send at Warning level so it's visible in monitoring.
/// </summary>
public sealed class LoggingSmsService : ISmsService
{
    private readonly ILogger<LoggingSmsService> _logger;

    public LoggingSmsService(ILogger<LoggingSmsService> logger) => _logger = logger;

    public Task SendAsync(string toPhoneNumber, string message)
    {
        _logger.LogWarning(
            "[SMS DISABLED] Would send to {To}: {Message}. Configure Twilio to enable delivery.",
            toPhoneNumber, message);
        return Task.CompletedTask;
    }
}
