namespace EliteApp.API.Services.Security;

/// <summary>
/// Central SHA-256 token hashing. Consolidates the four near-identical hash helpers that used to
/// live in AuthService / UsersController / AuthController / AdminInviteController.
/// </summary>
public interface ITokenHasher
{
    /// <summary>
    /// Peppered hash for LOW-entropy secrets (6-digit OTPs, short reset codes). The server-side
    /// pepper is what makes these resistant to offline brute force.
    /// </summary>
    string HashWithPepper(string plaintext);

    /// <summary>
    /// Un-peppered hash for HIGH-entropy random tokens (invite tokens). These are already
    /// brute-force-infeasible, so no pepper is needed — and keeping it un-peppered preserves
    /// compatibility with already-issued invite hashes stored in the database.
    /// </summary>
    string HashRaw(string plaintext);
}
