namespace EliteApp.API.Services.Sms;

/// <summary>
/// Abstraction for sending SMS messages.
/// Swap the registered implementation for a real provider (Twilio, Azure Communication
/// Services, etc.) without touching any call-site code.
/// </summary>
public interface ISmsService
{
    /// <summary>Sends a text message to <paramref name="phoneNumber"/>.</summary>
    /// <param name="phoneNumber">E.164 or local format phone number.</param>
    /// <param name="message">Plain-text message body.</param>
    Task SendAsync(string phoneNumber, string message);
}
