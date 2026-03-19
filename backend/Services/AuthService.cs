using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EliteApp.API.Data;
using EliteApp.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EliteApp.API.Services;

public interface IAuthService
{
    Task<(User? User, string Error)> RegisterAsync(User user, string password);
    Task<(string? Token, User? User, string Error)> LoginAsync(string email, string password, string role);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthService(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<(User? User, string Error)> RegisterAsync(User user, string password)
    {
        if (await _context.Users.AnyAsync(u => u.Email == user.Email))
        {
            return (null, "Email already exists");
        }

        // In a real app, hash the password properly (e.g., BCrypt). 
        // For this demo, we'll store it as is or a simple hash to match the requirement of "setup".
        // Let's stick to simple for now but acknowledge it's not prod-ready security.
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password); 
        
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return (user, string.Empty);
    }

    public async Task<(string? Token, User? User, string Error)> LoginAsync(string email, string password, string role)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            return (null, null, "Invalid credentials");
        }

        // Role check — reject if the requested role doesn't match the stored role
        if (!string.IsNullOrEmpty(role) && !string.Equals(user.Role, role, StringComparison.OrdinalIgnoreCase))
        {
            return (null, null, "Invalid credentials");
        }

        // Vendor approval check
        if (user.Role == UserRole.Vendor.ToString() && !user.IsApproved)
        {
            return (null, null, "Account not approved yet");
        }

        var token = GenerateJwtToken(user);
        return (token, user, string.Empty);
    }

    private string GenerateJwtToken(User user)
    {
        var jwtKey = _configuration["Jwt:Key"] ?? "supersecretsupersecretsupersecret123!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Email),
            new Claim("id", user.Id.ToString()),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(ClaimTypes.Name, user.Name)
        };

        var token = new JwtSecurityToken(
            issuer: null,
            audience: null,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
