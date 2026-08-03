using EliteApp.API.Data;
using EliteApp.API.Models;
using EliteApp.API.Services.Email;
using EliteApp.API.Services.Stripe;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Stripe;
using Stripe.Checkout;

namespace EliteApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IStripeService _stripe;
    private readonly IEmailQueue _emailQueue;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PaymentsController> _logger;

    // Statuses a sale has reached where collecting payment is meaningful. "after the job is
    // completed" per the product spec: pay from Completed / InvoiceRequested / Invoiced.
    private static readonly HashSet<string> PayableStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Sale", "FollowUp", "Completed", "InvoiceRequested", "Invoiced"
    };

    // Metadata key carrying the amount (in cents) the customer was quoted when the Stripe object
    // was created. The webhook verifies against this snapshot: an admin may change the job's
    // ContractAmount while checkout is open, and the customer must be settled for what they paid.
    private const string ExpectedAmountMetadataKey = "expectedAmountCents";

    public PaymentsController(
        AppDbContext context,
        IStripeService stripe,
        IEmailQueue emailQueue,
        IConfiguration configuration,
        ILogger<PaymentsController> logger)
    {
        _context = context;
        _stripe = stripe;
        _emailQueue = emailQueue;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>Best-effort admin notification that a job was paid. Queued so the Stripe
    /// webhook can acknowledge immediately instead of waiting on an SMTP round-trip.</summary>
    private Task NotifyAdminPaidAsync(Job job, long amountCents)
    {
        var to = _configuration["Email:AdminNotify"];
        if (string.IsNullOrWhiteSpace(to)) return Task.CompletedTask;

        var amount = $"${amountCents / 100m:0.00}";
        var subject = $"Payment received — Order #{job.JobNumber} ({amount})";
        var body =
            $"A customer just paid for Order #{job.JobNumber} at {job.Address}.\n\n" +
            $"Amount: {amount}\nStatus: Paid\n\nView the order in the Elite Home Services app.";
        _emailQueue.TryEnqueue(new OutgoingEmail(to, subject, body));
        return Task.CompletedTask;
    }

    /// <summary>Postgres unique-violation (SQLSTATE 23505) — a concurrent insert of the same
    /// Stripe intent id is a benign race, not a server fault.</summary>
    private static bool IsUniqueViolation(DbUpdateException ex)
        => ex.InnerException is Npgsql.PostgresException { SqlState: "23505" };

    /// <summary>
    /// Customer creates (or reuses) a PaymentIntent for their job. The amount is computed
    /// server-side from Job.ContractAmount — the client sends only the jobId.
    /// </summary>
    [HttpPost("jobs/{jobId}/intent")]
    public async Task<IActionResult> CreateIntent(Guid jobId)
    {
        if (!Guid.TryParse(User.FindFirstValue("id"), out var userId))
            return Unauthorized();

        var job = await _context.Jobs.FindAsync(jobId);
        if (job == null) return NotFound();

        // Ownership: only the job's customer may pay it.
        if (job.CustomerId != userId)
            return Forbid();

        if (string.Equals(job.PaymentStatus, "Paid", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "This job is already paid." });

        if (job.ContractAmount is not { } amount || amount <= 0)
            return BadRequest(new { message = "This job does not have a payable amount yet." });

        if (!PayableStatuses.Contains(job.Status))
            return BadRequest(new { message = $"Payment is not available from status '{job.Status}'." });

        // Server-side amount. decimal dollars -> integer cents, rounded to avoid float drift.
        var amountCents = (long)decimal.Round(amount * 100m, MidpointRounding.AwayFromZero);

        // Reuse an existing open intent for this job (idempotent UX) instead of stacking intents.
        var existing = await _context.Payments
            .Where(p => p.JobId == jobId && p.Status == "RequiresPaymentConfirmation" && p.AmountCents == amountCents)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        try
        {
            if (existing != null)
            {
                var openIntent = await _stripe.GetPaymentIntentAsync(existing.StripePaymentIntentId);
                if (openIntent.Status is "requires_payment_method" or "requires_confirmation" or "requires_action")
                {
                    return Ok(new
                    {
                        clientSecret = openIntent.ClientSecret,
                        publishableKey = _stripe.PublishableKey,
                        amount = amountCents,
                    });
                }
            }

            var metadata = new Dictionary<string, string>
            {
                ["jobId"] = jobId.ToString(),
                ["customerId"] = userId.ToString(),
                ["jobNumber"] = job.JobNumber.ToString(),
                [ExpectedAmountMetadataKey] = amountCents.ToString(),
            };

            // Idempotency key keyed on (job, amount): the same job+amount can never create two intents,
            // which neutralizes the apiClient's automatic retry logic.
            var idempotencyKey = $"job-{jobId}-{amountCents}";

            var intent = await _stripe.CreatePaymentIntentAsync(amountCents, "usd", idempotencyKey, metadata);

            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                CustomerId = userId,
                AmountCents = amountCents,
                Currency = "usd",
                Status = "RequiresPaymentConfirmation",
                StripePaymentIntentId = intent.Id,
                CreatedAt = DateTime.UtcNow,
            };
            _context.Payments.Add(payment);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                // Concurrent CreateIntent for the same job: the Stripe idempotency key handed both
                // callers the same intent, so the loser of the insert race simply serves the row the
                // winner already wrote instead of surfacing a 500.
                _context.Entry(payment).State = EntityState.Detached;
                var winner = await _context.Payments.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.StripePaymentIntentId == intent.Id);
                if (winner == null) throw;
                _logger.LogInformation("Concurrent intent creation for job {JobId}; reusing payment {PaymentId}", jobId, winner.Id);
            }

            return Ok(new
            {
                clientSecret = intent.ClientSecret,
                publishableKey = _stripe.PublishableKey,
                amount = amountCents,
            });
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe intent creation failed for job {JobId}", jobId);
            return StatusCode(502, new { message = "Payment provider error. Please try again." });
        }
    }

    /// <summary>
    /// Customer starts a hosted Stripe Checkout for their job. Returns the Stripe-hosted URL the
    /// app opens in the browser ("navigate to the Stripe UI"). Amount is computed server-side.
    /// "Paid" is written only by the checkout.session.completed webhook, never by this call.
    /// </summary>
    [HttpPost("jobs/{jobId}/checkout")]
    public async Task<IActionResult> CreateCheckout(Guid jobId)
    {
        if (!Guid.TryParse(User.FindFirstValue("id"), out var userId))
            return Unauthorized();

        var job = await _context.Jobs.FindAsync(jobId);
        if (job == null) return NotFound();

        if (job.CustomerId != userId)
            return Forbid();

        if (string.Equals(job.PaymentStatus, "Paid", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "This job is already paid." });

        if (job.ContractAmount is not { } amount || amount <= 0)
            return BadRequest(new { message = "This job does not have a payable amount yet." });

        if (!PayableStatuses.Contains(job.Status))
            return BadRequest(new { message = $"Payment is not available from status '{job.Status}'." });

        var amountCents = (long)decimal.Round(amount * 100m, MidpointRounding.AwayFromZero);
        var baseUrl = (_configuration["App:BaseUrl"] ?? "https://eliteapp-api-prod.azurewebsites.net").TrimEnd('/');

        var metadata = new Dictionary<string, string>
        {
            ["jobId"] = jobId.ToString(),
            ["customerId"] = userId.ToString(),
            ["jobNumber"] = job.JobNumber.ToString(),
            [ExpectedAmountMetadataKey] = amountCents.ToString(),
        };
        var idempotencyKey = $"checkout-{jobId}-{amountCents}";

        try
        {
            var session = await _stripe.CreateCheckoutSessionAsync(
                amountCents,
                "usd",
                productName: $"Order #{job.JobNumber} — {job.Address}",
                successUrl: $"{baseUrl}/payment-complete?order={job.JobNumber}",
                cancelUrl: $"{baseUrl}/payment-cancel",
                idempotencyKey,
                metadata);

            return Ok(new { url = session.Url });
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe checkout session failed for job {JobId}", jobId);
            return StatusCode(502, new { message = "Payment provider error. Please try again." });
        }
    }

    /// <summary>Stripe redirects here after a successful hosted payment. Static confirmation page.</summary>
    [AllowAnonymous]
    [HttpGet("/payment-complete")]
    public IActionResult PaymentComplete([FromQuery] string? order)
    {
        // "order" is a JobNumber echoed back by Stripe's redirect. Accept digits only — anything
        // else is dropped rather than interpolated into the markup below.
        var isOrderNumber = order is { Length: > 0 and <= 12 } && order.All(char.IsAsciiDigit);
        var heading = isOrderNumber ? $"Payment received — Order #{order}" : "Payment received";
        var html = $@"<!DOCTYPE html><html lang=""en""><head><meta charset=""UTF-8""/>
<meta name=""viewport"" content=""width=device-width,initial-scale=1""/><title>Payment complete</title>
<style>body{{font-family:-apple-system,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px}}
.card{{background:#fff;border-radius:16px;padding:40px 32px;max-width:420px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}}
.check{{font-size:56px}}h1{{font-size:20px;color:#111;margin:12px 0}}p{{color:#555;font-size:15px;line-height:1.5}}</style></head>
<body><div class=""card""><div class=""check"">✅</div><h1>{heading}</h1>
<p>Thank you. Your payment was successful. You can close this page and return to the Elite Home Services app.</p></div></body></html>";
        return Content(html, "text/html");
    }

    /// <summary>Stripe redirects here if the customer cancels the hosted payment.</summary>
    [AllowAnonymous]
    [HttpGet("/payment-cancel")]
    public IActionResult PaymentCancel()
    {
        var html = @"<!DOCTYPE html><html lang=""en""><head><meta charset=""UTF-8""/>
<meta name=""viewport"" content=""width=device-width,initial-scale=1""/><title>Payment canceled</title>
<style>body{font-family:-apple-system,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px}
.card{background:#fff;border-radius:16px;padding:40px 32px;max-width:420px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
h1{font-size:20px;color:#111;margin:12px 0}p{color:#555;font-size:15px;line-height:1.5}</style></head>
<body><div class=""card""><h1>Payment canceled</h1>
<p>No charge was made. Return to the Elite Home Services app to try again.</p></div></body></html>";
        return Content(html, "text/html");
    }

    /// <summary>
    /// Stripe webhook. Authenticated by signature (no JWT), so it is AllowAnonymous. This is the
    /// ONLY writer of "Paid" status — never the client success callback.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        // Read the RAW body — signature verification fails if anything reparses the stream.
        string json;
        using (var reader = new StreamReader(Request.Body))
            json = await reader.ReadToEndAsync();

        // A webhook we cannot verify (forged/missing/malformed signature, or no secret configured)
        // is always a bad request, never a server fault — reject with 400 and process nothing.
        Event stripeEvent;
        try
        {
            stripeEvent = _stripe.ConstructWebhookEvent(json, Request.Headers["Stripe-Signature"].ToString());
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Rejected unverifiable Stripe webhook.");
            return BadRequest();
        }

        // Hosted Checkout flow: settle the job from the completed session.
        if (stripeEvent.Type == "checkout.session.completed" && stripeEvent.Data.Object is Session session)
        {
            await HandleCheckoutSessionCompletedAsync(session);
            return Ok();
        }

        if (stripeEvent.Data.Object is not PaymentIntent intent)
            return Ok(); // event type we don't model — acknowledge so Stripe stops retrying.

        var payment = await _context.Payments
            .FirstOrDefaultAsync(p => p.StripePaymentIntentId == intent.Id);
        if (payment == null)
        {
            _logger.LogWarning("Webhook for unknown PaymentIntent {IntentId}", intent.Id);
            return Ok();
        }

        switch (stripeEvent.Type)
        {
            case "payment_intent.succeeded":
                // Idempotent: already settled -> no-op (Stripe retries webhooks).
                if (string.Equals(payment.Status, "Succeeded", StringComparison.OrdinalIgnoreCase))
                    return Ok();

                // Defense in depth: trust the webhook amount only if it matches our snapshot.
                if (intent.Amount != payment.AmountCents)
                {
                    _logger.LogError(
                        "Amount mismatch for intent {IntentId}: stripe={Stripe} expected={Expected}",
                        intent.Id, intent.Amount, payment.AmountCents);
                    return Ok();
                }

                payment.Status = "Succeeded";
                payment.PaidAt = DateTime.UtcNow;

                var paidJob = await _context.Jobs.FindAsync(payment.JobId);
                if (paidJob != null)
                {
                    paidJob.PaymentStatus = "Paid";
                    await _context.SaveChangesAsync();
                    await NotifyAdminPaidAsync(paidJob, payment.AmountCents);
                    return Ok();
                }
                break;

            case "payment_intent.payment_failed":
                if (!string.Equals(payment.Status, "Succeeded", StringComparison.OrdinalIgnoreCase))
                    payment.Status = "Failed";
                break;

            case "payment_intent.canceled":
                if (!string.Equals(payment.Status, "Succeeded", StringComparison.OrdinalIgnoreCase))
                    payment.Status = "Canceled";
                break;

            default:
                return Ok();
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    /// <summary>
    /// Settles a job paid via hosted Checkout. Idempotent, amount-verified, and the source of truth
    /// for "Paid" on the checkout path. Also records an audit Payment row and notifies the admin.
    /// </summary>
    private async Task HandleCheckoutSessionCompletedAsync(Session session)
    {
        if (session.Metadata == null ||
            !session.Metadata.TryGetValue("jobId", out var jobIdRaw) ||
            !Guid.TryParse(jobIdRaw, out var jobId))
        {
            _logger.LogWarning("Checkout session {SessionId} completed without a jobId.", session.Id);
            return;
        }

        var job = await _context.Jobs.FindAsync(jobId);
        if (job == null)
        {
            _logger.LogWarning("Checkout session {SessionId} references unknown job {JobId}.", session.Id, jobId);
            return;
        }

        // Idempotent: Stripe retries webhooks; a job already Paid is a no-op.
        if (string.Equals(job.PaymentStatus, "Paid", StringComparison.OrdinalIgnoreCase))
            return;

        // Verify against the amount snapshotted into the session's metadata at creation, NOT the
        // job's live ContractAmount: an admin can change that while checkout is open, which would
        // otherwise leave a charged customer sitting at Unpaid with only a log line. Sessions
        // created before this metadata existed fall back to the live value.
        var liveCents = (long)decimal.Round((job.ContractAmount ?? 0m) * 100m, MidpointRounding.AwayFromZero);
        var expectedCents = session.Metadata != null
            && session.Metadata.TryGetValue(ExpectedAmountMetadataKey, out var snapshotRaw)
            && long.TryParse(snapshotRaw, out var snapshotCents)
                ? snapshotCents
                : liveCents;

        if (session.AmountTotal != expectedCents)
        {
            _logger.LogError(
                "Refusing to settle job {JobId} (Order #{JobNumber}): Stripe reports {StripeCents} cents but the " +
                "checkout was created for {ExpectedCents} cents (job currently lists {LiveCents}). Session {SessionId} " +
                "needs manual reconciliation — the customer may have been charged.",
                jobId, job.JobNumber, session.AmountTotal, expectedCents, liveCents, session.Id);
            return;
        }

        // Second line of defence: if this intent already has a Payment row, that DB snapshot must
        // agree with what Stripe charged.
        var piId = session.PaymentIntentId;
        var existingPayment = string.IsNullOrEmpty(piId)
            ? null
            : await _context.Payments.FirstOrDefaultAsync(p => p.StripePaymentIntentId == piId);

        if (existingPayment != null && existingPayment.AmountCents != session.AmountTotal)
        {
            _logger.LogError(
                "Refusing to settle job {JobId} (Order #{JobNumber}): Stripe reports {StripeCents} cents but payment " +
                "record {PaymentId} was created for {RecordedCents} cents. Intent {IntentId} needs manual reconciliation.",
                jobId, job.JobNumber, session.AmountTotal, existingPayment.Id, existingPayment.AmountCents, piId);
            return;
        }

        if (liveCents != expectedCents)
        {
            _logger.LogWarning(
                "Job {JobId} (Order #{JobNumber}) was charged {PaidCents} cents but its amount has since changed to " +
                "{LiveCents} cents. Settling for what the customer actually paid.",
                jobId, job.JobNumber, expectedCents, liveCents);
        }

        job.PaymentStatus = "Paid";

        // Audit row, keyed by the underlying PaymentIntent (unique).
        Payment? auditRow = null;
        if (!string.IsNullOrEmpty(piId) && existingPayment == null)
        {
            auditRow = new Payment
            {
                Id = Guid.NewGuid(),
                JobId = job.Id,
                CustomerId = job.CustomerId,
                AmountCents = expectedCents,
                Currency = session.Currency ?? "usd",
                Status = "Succeeded",
                StripePaymentIntentId = piId,
                CreatedAt = DateTime.UtcNow,
                PaidAt = DateTime.UtcNow,
            };
            _context.Payments.Add(auditRow);
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (auditRow != null && IsUniqueViolation(ex))
        {
            // The payment_intent.succeeded handler recorded this intent between the check above and
            // this save. Drop the duplicate audit row so the settlement itself still persists.
            _context.Entry(auditRow).State = EntityState.Detached;
            await _context.SaveChangesAsync();
        }

        await NotifyAdminPaidAsync(job, expectedCents);
    }
}
