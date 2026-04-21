using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace EliteApp.API.Services.Email;

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendAsync(string toEmail, string subject, string plainTextBody, string? htmlBody = null,
        CancellationToken cancellationToken = default)
    {
        var host = _configuration["Email:Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
            throw new InvalidOperationException("Email:Smtp:Host is not configured.");

        var port = int.TryParse(_configuration["Email:Smtp:Port"], out var p) ? p : 587;
        var user = _configuration["Email:Smtp:User"] ?? string.Empty;
        var password = _configuration["Email:Smtp:Password"] ?? string.Empty;
        var fromAddress = _configuration["Email:FromAddress"] ?? user;
        var fromName = _configuration["Email:FromName"] ?? "Elite Services";

        if (string.IsNullOrWhiteSpace(fromAddress))
            throw new InvalidOperationException("Email:FromAddress (or Smtp:User) must be set.");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;

        var builder = new BodyBuilder { TextBody = plainTextBody };
        if (!string.IsNullOrEmpty(htmlBody))
            builder.HtmlBody = htmlBody;
        message.Body = builder.ToMessageBody();

        using var client = new SmtpClient();
        client.Timeout = 30_000;

        // StartTls (not StartTlsWhenAvailable) — fail hard if the server doesn't
        // advertise STARTTLS rather than silently falling back to plaintext, which
        // would send password-reset codes over an unencrypted connection.
        var secure = port == 465
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTls;
        try
        {
            await client.ConnectAsync(host, port, secure, cancellationToken);
            if (!string.IsNullOrEmpty(user))
                await client.AuthenticateAsync(user, password, cancellationToken);
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP send failed to {To}", toEmail);
            throw;
        }
    }
}
