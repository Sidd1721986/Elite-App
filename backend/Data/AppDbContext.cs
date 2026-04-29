using Microsoft.EntityFrameworkCore;
using EliteApp.API.Models;

namespace EliteApp.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<Job> Jobs { get; set; }
    public DbSet<JobNote> JobNotes { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }
    public DbSet<AdminInvite> AdminInvites { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Ensure email is unique
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<PasswordResetToken>()
            .HasIndex(t => t.Token)
            .IsUnique();

        // Job query patterns
        modelBuilder.Entity<Job>()
            .HasIndex(j => new { j.CustomerId, j.CreatedAt });

        modelBuilder.Entity<Job>()
            .HasIndex(j => new { j.VendorId, j.CreatedAt });

        modelBuilder.Entity<Job>()
            .HasIndex(j => new { j.Status, j.AssignedAt });

        // Messaging query patterns
        modelBuilder.Entity<Message>()
            .HasIndex(m => new { m.ReceiverId, m.IsRead, m.Timestamp });

        modelBuilder.Entity<Message>()
            .HasIndex(m => new { m.SenderId, m.ReceiverId, m.Timestamp });

        modelBuilder.Entity<AdminInvite>()
            .HasIndex(i => i.TokenHash)
            .IsUnique();

        modelBuilder.Entity<AdminInvite>()
            .HasIndex(i => i.Email);
    }
}
