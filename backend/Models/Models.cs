using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace EliteApp.API.Models;

public enum UserRole
{
    Admin,
    Vendor,
    Customer
}

public class User
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    // Never serialize credential material — Job endpoints return User via navigation
    // properties, so anything without [JsonIgnore] here ships to every caller.
    [Required]
    [JsonIgnore]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = UserRole.Customer.ToString();

    [StringLength(255, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Address { get; set; }

    [StringLength(30)]
    public string? Phone { get; set; }
    
    // Vendor specific
    public bool IsApproved { get; set; } = false;
    
    public bool IsActive { get; set; } = true;
    
    public bool IsPhoneVerified { get; set; } = false;
    [JsonIgnore]
    public string? PhoneVerificationCode { get; set; }
    [JsonIgnore]
    public DateTime? PhoneVerificationExpiry { get; set; }
    [JsonIgnore]
    public int PhoneVerificationAttempts { get; set; } = 0;
    [JsonIgnore]
    public DateTime? PhoneVerificationLastAttempt { get; set; }

    // UTC time of the last password reset. Tokens issued before this are rejected in
    // Program.cs (OnTokenValidated) — a 7-day JWT must not outlive the reset that was
    // meant to lock its holder out. Null means the password has never been reset.
    [JsonIgnore]
    public DateTime? PasswordChangedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Job
{
    [Key]
    public Guid Id { get; set; }

    public int JobNumber { get; set; }

    public Guid CustomerId { get; set; }
    
    [ForeignKey("CustomerId")]
    public User? Customer { get; set; }

    [Required]
    [StringLength(5000)]
    public string Description { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Address { get; set; } = string.Empty;

    [StringLength(50)]
    public string Status { get; set; } = "Submitted";
    [StringLength(50)]
    public string Urgency { get; set; } = "No rush";

    [StringLength(5000)]
    public string? OtherDetails { get; set; }
    
    // Simple way to store photos as comma separated strings for now
    public string? Photos { get; set; } 

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Workflow enhancement
    public Guid? VendorId { get; set; }
    
    [ForeignKey("VendorId")]
    public User? Vendor { get; set; }

    public DateTime? AssignedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public string? ScopeOfWork { get; set; }
    public decimal? ContractAmount { get; set; }
    public DateTime? WorkStartDate { get; set; }
    public string? CompletedPhotos { get; set; } // Comma separated URLs
    public bool IsInvoiced { get; set; } = false;
    public string? InvoiceDocumentUrl { get; set; }
    public DateTime? InvoiceRequestedAt { get; set; }
    public DateTime? InvoicedAt { get; set; }

    // Payment lifecycle (Stripe). Source of truth for "Paid" is the verified webhook,
    // never the client. Default Unpaid; flips to Paid only on payment_intent.succeeded.
    [StringLength(20)]
    public string PaymentStatus { get; set; } = "Unpaid";

    public List<JobNote> Notes { get; set; } = new();

    // Contact enhancement
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }

    public Guid? ParentJobId { get; set; }

    [ForeignKey("ParentJobId")]
    public Job? ParentJob { get; set; }

    public List<Job> ChildJobs { get; set; } = new();

    [Timestamp]
    public byte[]? RowVersion { get; set; }

    public string? JobSuffix { get; set; }
    public string? Services { get; set; }
}

public class JobNote
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid JobId { get; set; }
    
    [Required]
    public Guid AuthorId { get; set; }
    
    [Required]
    public string Content { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Message
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid SenderId { get; set; }

    [Required]
    public Guid ReceiverId { get; set; }

    [Required]
    [StringLength(10000)]
    public string Content { get; set; } = string.Empty;

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public bool IsRead { get; set; } = false;

    [ForeignKey("SenderId")]
    public User? Sender { get; set; }

    [ForeignKey("ReceiverId")]
    public User? Receiver { get; set; }
}

public class PasswordResetToken
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [Required]
    public string Token { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public bool Used { get; set; }

    // Failed verify count for this specific code. The IP rate limiter alone does not stop a
    // distributed guess of a 6-digit OTP; the token is burned once this hits the cap.
    public int Attempts { get; set; }
}

public class Payment
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid JobId { get; set; }

    [ForeignKey("JobId")]
    public Job? Job { get; set; }

    // Who pays — the job's customer at intent-creation time.
    [Required]
    public Guid CustomerId { get; set; }

    // Snapshot of ContractAmount * 100 at intent creation. Amount is computed server-side;
    // the client never sends it. The webhook re-verifies the Stripe amount matches this.
    public long AmountCents { get; set; }

    [StringLength(10)]
    public string Currency { get; set; } = "usd";

    // RequiresPaymentConfirmation -> Succeeded / Failed / Canceled.
    [StringLength(40)]
    public string Status { get; set; } = "RequiresPaymentConfirmation";

    [Required]
    [StringLength(255)]
    public string StripePaymentIntentId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }

    [Timestamp]
    public byte[]? RowVersion { get; set; }
}

public class AdminInvite
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [EmailAddress]
    [StringLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string TokenHash { get; set; } = string.Empty;

    public Guid InvitedByAdminId { get; set; }

    [ForeignKey("InvitedByAdminId")]
    public User? InvitedByAdmin { get; set; }

    public DateTime ExpiresAt { get; set; }

    public bool Used { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
