using EliteApp.API.Models;
using EliteApp.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace EliteApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            Name = request.Name,
            Role = request.Role,
            Address = request.Address,
            Phone = request.Phone,
            IsApproved = request.Role != UserRole.Vendor.ToString() // Authors approve non-vendors
        };

        var (newUser, error) = await _authService.RegisterAsync(user, request.Password);

        if (newUser == null)
        {
            return BadRequest(new { message = error });
        }

        return Ok(new { message = "Registration successful" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var (token, user, error) = await _authService.LoginAsync(request.Email, request.Password, request.Role);

        if (token == null || user == null)
        {
            return Unauthorized(new { message = error });
        }

        var u = user!;
        return Ok(new
        {
            token,
            user = new
            {
                u.Id,
                u.Name,
                u.Email,
                u.Role,
                u.Address,
                u.Phone,
                u.IsApproved
            }
        });
    }
}

public class RegisterRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}
