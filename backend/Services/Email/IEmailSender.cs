namespace EliteApp.API.Services.Email;

public interface IEmailSender
{
    Task SendAsync(
        string toEmail,
        string subject,
        string plainTextBody,
        string? htmlBody = null,
        CancellationToken cancellationToken = default);
}
