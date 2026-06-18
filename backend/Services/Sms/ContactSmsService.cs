using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;

namespace EliteApp.API.Services.Sms;

public sealed class ContactSmsService : ISmsService
{
    private readonly string _fromPhone;
    private readonly string _accountSid;
    private readonly string _authToken;
    private readonly ILogger<ContactSmsService> _logger;

    public ContactSmsService(IConfiguration configuration, ILogger<ContactSmsService> logger)
    {
        _fromPhone  = configuration["Sms:ContactPhone"]
                      ?? throw new InvalidOperationException("Sms:ContactPhone is required.");
        _accountSid = configuration["Sms:Twilio:AccountSid"]
                      ?? throw new InvalidOperationException("Sms:Twilio:AccountSid is required.");
        _authToken  = configuration["Sms:Twilio:AuthToken"]
                      ?? throw new InvalidOperationException("Sms:Twilio:AuthToken is required.");
        _logger = logger;

        TwilioClient.Init(_accountSid, _authToken);
    }

    public async Task SendAsync(string toPhoneNumber, string message)
    {
        if (string.IsNullOrWhiteSpace(toPhoneNumber))
        {
            _logger.LogWarning("SMS skipped: toPhoneNumber is empty.");
            return;
        }

        var e164 = ToE164(toPhoneNumber);

        var msg = await MessageResource.CreateAsync(
            to:   new PhoneNumber(e164),
            from: new PhoneNumber(_fromPhone),
            body: message);

        _logger.LogInformation("SMS sent: SID={Sid} Status={Status} To={To}", msg.Sid, msg.Status, e164);
    }

    // Twilio requires E.164 (e.g. +14133448327). Numbers are stored as bare digits
    // (often a 10-digit US number with no country code), so normalize before sending:
    //   already "+..."           -> leave as-is
    //   10 digits                -> assume US, prefix "+1"
    //   11 digits starting "1"   -> prefix "+"
    //   anything else            -> prefix "+" and hope the caller stored it correctly
    private static string ToE164(string raw)
    {
        var trimmed = raw.Trim();
        if (trimmed.StartsWith("+")) return trimmed;

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (digits.Length == 10) return "+1" + digits;
        if (digits.Length == 11 && digits[0] == '1') return "+" + digits;
        return "+" + digits;
    }
}
