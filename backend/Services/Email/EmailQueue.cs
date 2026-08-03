using System.Threading.Channels;

namespace EliteApp.API.Services.Email;

/// <summary>
/// Fire-and-forget outbound email. Notification mail (job events, payment notices) must not
/// hold an HTTP request open for a full SMTP handshake — under load that stacks seconds of
/// latency onto every request and can push the Stripe webhook past its ack timeout.
/// Emails whose failure the caller must report (invoices, admin invites, reset codes)
/// should keep using IEmailSender directly.
/// </summary>
public interface IEmailQueue
{
    /// <summary>Returns false if the queue is full (email dropped, caller already logs best-effort).</summary>
    bool TryEnqueue(OutgoingEmail email);
}

public sealed record OutgoingEmail(string To, string Subject, string PlainTextBody, string? HtmlBody = null);

public sealed class EmailQueue : IEmailQueue
{
    // Bounded so a mail outage can't grow memory without limit; 1000 pending notifications
    // is far beyond normal burst size.
    private readonly Channel<OutgoingEmail> _channel = Channel.CreateBounded<OutgoingEmail>(
        new BoundedChannelOptions(1000)
        {
            SingleReader = true,
            FullMode = BoundedChannelFullMode.DropWrite
        });

    private readonly ILogger<EmailQueue> _logger;

    public EmailQueue(ILogger<EmailQueue> logger) => _logger = logger;

    internal ChannelReader<OutgoingEmail> Reader => _channel.Reader;

    public bool TryEnqueue(OutgoingEmail email)
    {
        if (string.IsNullOrWhiteSpace(email.To))
            return false;
        if (_channel.Writer.TryWrite(email))
            return true;
        _logger.LogError("Email queue full — dropped notification to {To}: {Subject}", email.To, email.Subject);
        return false;
    }
}

/// <summary>Drains the queue in the background, sending via the configured IEmailSender with retry.</summary>
public sealed class EmailDispatchService : BackgroundService
{
    private static readonly TimeSpan[] RetryDelays = [TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(30)];

    private readonly EmailQueue _queue;
    private readonly IEmailSender _sender;
    private readonly ILogger<EmailDispatchService> _logger;

    public EmailDispatchService(EmailQueue queue, IEmailSender sender, ILogger<EmailDispatchService> logger)
    {
        _queue = queue;
        _sender = sender;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var email in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            for (var attempt = 0; ; attempt++)
            {
                try
                {
                    await _sender.SendAsync(email.To, email.Subject, email.PlainTextBody, email.HtmlBody, stoppingToken);
                    break;
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return; // shutting down — remaining queue entries are best-effort by contract
                }
                catch (Exception ex)
                {
                    if (attempt >= RetryDelays.Length)
                    {
                        _logger.LogError(ex, "Notification email permanently failed to {To}: {Subject}", email.To, email.Subject);
                        break;
                    }
                    _logger.LogWarning(ex, "Notification email attempt {Attempt} failed to {To}; retrying", attempt + 1, email.To);
                    try { await Task.Delay(RetryDelays[attempt], stoppingToken); }
                    catch (OperationCanceledException) { return; }
                }
            }
        }
    }
}
