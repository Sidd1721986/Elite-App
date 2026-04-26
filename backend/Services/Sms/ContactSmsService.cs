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

        var msg = await MessageResource.CreateAsync(
            to:   new PhoneNumber(toPhoneNumber),
            from: new PhoneNumber(_fromPhone),
            body: message);

        _logger.LogInformation("SMS sent: SID={Sid} Status={Status} To={To}", msg.Sid, msg.Status, toPhoneNumber);
    }
}
