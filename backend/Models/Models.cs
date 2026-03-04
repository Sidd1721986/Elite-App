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
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Job
{
    [Key]
    public Guid Id { get; set; }

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
