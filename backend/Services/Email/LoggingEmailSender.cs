namespace EliteApp.API.Services.Email;

/// <summary>
/// Development: logs the full message (including reset code) when SMTP is not configured.
/// Production: throws so callers can surface a safe error — configure Email:Smtp:Host in production.
/// </summary>
public sealed class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;
    private readonly IHostEnvironment _env;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger, IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public Task SendAsync(string toEmail, string subject, string plainTextBody, string? htmlBody = null,
        CancellationToken cancellationToken = default)
    {
        if (!_env.IsDevelopment())
        {
            throw new InvalidOperationException(
                "Email is not configured. Set Email:Smtp:Host (and related settings) for production.");
        }

        _logger.LogWarning(
            "DEV: email not sent via SMTP. To={To} Subject={Subject}\n{Body}",
            toEmail, subject, plainTextBody);
        return Task.CompletedTask;
    }
}
