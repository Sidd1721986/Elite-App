using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = UserRole.Customer.ToString();

    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    
    // Vendor specific
    public bool IsApproved { get; set; } = false;
    
    public bool IsActive { get; set; } = true;
    
    public bool IsPhoneVerified { get; set; } = false;
    public string? PhoneVerificationCode { get; set; }
    public DateTime? PhoneVerificationExpiry { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Job
{
    [Key]
    public Guid Id { get; set; }

    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int JobNumber { get; set; }

    public Guid CustomerId { get; set; }
    
    [ForeignKey("CustomerId")]
    public User? Customer { get; set; }

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string Address { get; set; } = string.Empty;

    public string Status { get; set; } = "Submitted"; // Submitted, Assigned, Accepted, ReachedOut, ApptSet, Sale, FollowUp, Expired, Completed, Invoiced
    public string Urgency { get; set; } = "No rush";
    
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

    public List<JobNote> Notes { get; set; } = new();

    // Contact enhancement
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
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
}
