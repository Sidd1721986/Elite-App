using Stripe;
using Stripe.Checkout;

namespace EliteApp.API.Services.Stripe;

public interface IStripeService
{
    /// <summary>
    /// Creates (or reuses) a PaymentIntent for the given job/amount. Amount is in cents and is
    /// always computed server-side by the caller from Job.ContractAmount — never from the client.
    /// The idempotencyKey prevents duplicate intents when the mobile client retries.
    /// </summary>
    Task<PaymentIntent> CreatePaymentIntentAsync(
        long amountCents,
        string currency,
        string idempotencyKey,
        IDictionary<string, string> metadata,
        CancellationToken ct = default);

    /// <summary>Retrieves an existing PaymentIntent (used to reuse an open intent for a job).</summary>
    Task<PaymentIntent> GetPaymentIntentAsync(string paymentIntentId, CancellationToken ct = default);

    /// <summary>
    /// Creates a hosted Stripe Checkout Session and returns it (Session.Url is the page the
    /// customer is redirected to). Amount is in cents, computed server-side. On completion Stripe
    /// fires checkout.session.completed, carrying the metadata back to the webhook.
    /// </summary>
    Task<Session> CreateCheckoutSessionAsync(
        long amountCents,
        string currency,
        string productName,
        string successUrl,
        string cancelUrl,
        string idempotencyKey,
        IDictionary<string, string> metadata,
        CancellationToken ct = default);

    /// <summary>
    /// Verifies the Stripe-Signature header and parses the event. Throws StripeException on a
    /// forged/replayed payload — this is how the webhook authenticates (it carries no JWT).
    /// </summary>
    Event ConstructWebhookEvent(string json, string signatureHeader);

    string PublishableKey { get; }
}
