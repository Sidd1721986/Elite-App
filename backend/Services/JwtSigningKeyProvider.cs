namespace EliteApp.API.Services;

/// <summary>
/// Carries the JWT signing key and token parameters resolved and validated once at startup
/// (via <c>ResolveJwtSigningKey</c> in Program.cs). Injected as a singleton so that
/// <see cref="AuthService"/> and any other token-issuing service always use the same key
/// that the JWT middleware uses for validation — eliminating the old bifurcated code path
/// that contained a hard-coded fallback key.
/// </summary>
public sealed record JwtSigningKeyProvider(string Key, string Issuer, string Audience);

/// <summary>
/// The per-user facts the JWT validation hook needs on every authenticated request
/// (Program.cs → OnTokenValidated). Cached for 60s under "user-active:{userId}" so both
/// checks cost one DB round-trip instead of one each; evicted by UsersController on
/// deactivation and by <see cref="AuthService"/> on password reset.
/// </summary>
public sealed record UserAuthSnapshot(bool IsActive, DateTime? PasswordChangedAt);
