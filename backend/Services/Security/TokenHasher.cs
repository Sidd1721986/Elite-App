using System.Security.Cryptography;
using System.Text;

namespace EliteApp.API.Services.Security;

public class TokenHasher : ITokenHasher
{
    private readonly string _pepper;

    public TokenHasher(IConfiguration configuration)
    {
        _pepper = configuration["PasswordReset:Pepper"] ?? string.Empty;
    }

    public string HashWithPepper(string plaintext) => Hash(plaintext + _pepper);

    public string HashRaw(string plaintext) => Hash(plaintext);

    private static string Hash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
