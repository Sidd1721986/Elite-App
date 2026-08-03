using Stripe;
using Stripe.Checkout;

namespace EliteApp.API.Services.Stripe;

/// <summary>
/// Thin wrapper around Stripe.net. The secret key is read from config (env/Key Vault in prod,
/// appsettings.Local.json in dev) and set globally once at startup in Program.cs.
/// </summary>
public class StripeService : IStripeService
{
    private readonly string _webhookSecret;
    private readonly PaymentIntentService _intents = new();
    private readonly SessionService _sessions = new();

    public string PublishableKey { get; }

    public StripeService(IConfiguration config)
    {
        PublishableKey = config["Stripe:PublishableKey"] ?? string.Empty;
        _webhookSecret = config["Stripe:WebhookSecret"] ?? string.Empty;
    }

    public Task<PaymentIntent> CreatePaymentIntentAsync(
        long amountCents,
        string currency,
        string idempotencyKey,
        IDictionary<string, string> metadata,
        CancellationToken ct = default)
    {
        var options = new PaymentIntentCreateOptions
        {
            Amount = amountCents,
            Currency = currency,
            // Lets PaymentSheet pick whatever methods are enabled in the Stripe dashboard.
            AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions { Enabled = true },
            Metadata = new Dictionary<string, string>(metadata),
        };

        // Idempotency key collapses client retries into a single intent (no double-charge).
        return _intents.CreateAsync(options, new RequestOptions { IdempotencyKey = idempotencyKey }, ct);
    }

    public Task<PaymentIntent> GetPaymentIntentAsync(string paymentIntentId, CancellationToken ct = default)
        => _intents.GetAsync(paymentIntentId, cancellationToken: ct);

    public Task<Session> CreateCheckoutSessionAsync(
        long amountCents,
        string currency,
        string productName,
        string successUrl,
        string cancelUrl,
        string idempotencyKey,
        IDictionary<string, string> metadata,
        CancellationToken ct = default)
    {
        var options = new SessionCreateOptions
        {
            Mode = "payment",
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    Quantity = 1,
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = currency,
                        UnitAmount = amountCents,
                        ProductData = new SessionLineItemPriceDataProductDataOptions { Name = productName },
                    },
                },
            },
            Metadata = new Dictionary<string, string>(metadata),
            // Mirror metadata onto the PaymentIntent so both webhook events carry the jobId.
            PaymentIntentData = new SessionPaymentIntentDataOptions
            {
                Metadata = new Dictionary<string, string>(metadata),
            },
        };

        // Idempotency key keyed on (job, amount) collapses client retries into one session.
        return _sessions.CreateAsync(options, new RequestOptions { IdempotencyKey = idempotencyKey }, ct);
    }

    public Event ConstructWebhookEvent(string json, string signatureHeader)
    {
        if (string.IsNullOrEmpty(_webhookSecret))
            throw new InvalidOperationException("Stripe:WebhookSecret is not configured.");

        // throwOnApiVersionMismatch:false so a dashboard API-version bump doesn't 400 every event.
        return EventUtility.ConstructEvent(json, signatureHeader, _webhookSecret, throwOnApiVersionMismatch: false);
    }
}
