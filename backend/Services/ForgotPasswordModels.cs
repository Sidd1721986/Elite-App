namespace EliteApp.API.Services;

public enum ForgotPasswordRequestStatus
{
    InvalidInput,
    Processed,
    EmailDeliveryFailed,
    SmsDeliveryFailed
}

public sealed record ForgotPasswordRequestResult(ForgotPasswordRequestStatus Status, string Message);
