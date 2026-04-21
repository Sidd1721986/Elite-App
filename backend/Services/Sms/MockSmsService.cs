namespace EliteApp.API.Services.Sms;

/// <summary>
/// Development/staging SMS stub — logs the message at Warning level instead of sending it.
/// This makes it obvious in logs that SMS is not wired up, without silently swallowing the
/// message the way a no-op would.
///
/// To enable real SMS delivery:
///   1. Add your SMS provider's NuGet package (e.g. Twilio, Azure.Communication.Sms).
///   2. Create a concrete <see cref="ISmsService"/> implementation.
///   3. Register it in Program.cs in place of <see cref="MockSmsService"/>, conditioned
///      on the relevant config key being present (same pattern as SmtpEmailSender).
///
/// Example for Twilio:
///   if (!string.IsNullOrWhiteSpace(cfg["Sms:Twilio:AccountSid"]))
///       return new TwilioSmsService(cfg, logger);
///   return new MockSmsService(logger);
/// </summary>
public sealed class MockSmsService : ISmsService
{
    private readonly ILogger<MockSmsService> _logger;

    public MockSmsService(ILogger<MockSmsService> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(string phoneNumber, string message)
    {
        _logger.LogWarning(
            "[SMS NOT CONFIGURED] Would send to {PhoneNumber}: {Message}. " +
            "Register a real ISmsService implementation to enable SMS delivery.",
            phoneNumber,
            message);

        return Task.CompletedTask;
    }
}
