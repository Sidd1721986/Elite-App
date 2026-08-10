using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;

namespace EliteApp.API.Services.Security;

/// <summary>
/// Identity extracted from a verified Apple/Google ID token.
/// </summary>
public record SocialIdentity(string Provider, string Subject, string Email, bool EmailVerified, string? Name);

public interface ISocialTokenVerifier
{
    /// <param name="provider">"apple" or "google" (case-insensitive).</param>
    Task<(SocialIdentity? Identity, string Error)> VerifyAsync(string provider, string idToken);
}

/// <summary>
/// Verifies Apple / Google ID tokens against the providers' published JWKS.
/// Key sets are cached for 24h; an unknown kid triggers one forced refresh
/// (providers rotate keys without notice).
/// </summary>
public class SocialTokenVerifier : ISocialTokenVerifier
{
    private const string AppleJwksUrl = "https://appleid.apple.com/auth/keys";
    private const string GoogleJwksUrl = "https://www.googleapis.com/oauth2/v3/certs";
    private const string AppleIssuer = "https://appleid.apple.com";
    private static readonly string[] GoogleIssuers = { "https://accounts.google.com", "accounts.google.com" };
    private static readonly TimeSpan KeyCacheTtl = TimeSpan.FromHours(24);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SocialTokenVerifier> _logger;

    private sealed class CachedKeys
    {
        public IList<SecurityKey> Keys = Array.Empty<SecurityKey>();
        public DateTime FetchedAtUtc = DateTime.MinValue;
        public readonly SemaphoreSlim Gate = new(1, 1);
    }

    private static readonly Dictionary<string, CachedKeys> KeyCache = new()
    {
        ["apple"] = new CachedKeys(),
        ["google"] = new CachedKeys(),
    };

    public SocialTokenVerifier(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<SocialTokenVerifier> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<(SocialIdentity? Identity, string Error)> VerifyAsync(string provider, string idToken)
    {
        provider = provider?.Trim().ToLowerInvariant() ?? string.Empty;
        if (provider is not ("apple" or "google"))
            return (null, "Unsupported provider.");
        if (string.IsNullOrWhiteSpace(idToken))
            return (null, "Missing token.");

        string[] validIssuers;
        string[] validAudiences;
        string jwksUrl;
        if (provider == "apple")
        {
            var bundleId = _configuration["SocialAuth:Apple:BundleId"];
            if (string.IsNullOrWhiteSpace(bundleId))
                return (null, "Apple sign-in is not configured.");
            validIssuers = new[] { AppleIssuer };
            validAudiences = new[] { bundleId };
            jwksUrl = AppleJwksUrl;
        }
        else
        {
            var clientIds = _configuration.GetSection("SocialAuth:Google:ClientIds").Get<string[]>()
                            ?? (_configuration["SocialAuth:Google:ClientIds"] is { Length: > 0 } single ? new[] { single } : null);
            if (clientIds == null || clientIds.Length == 0)
                return (null, "Google sign-in is not configured.");
            validIssuers = GoogleIssuers;
            validAudiences = clientIds;
            jwksUrl = GoogleJwksUrl;
        }

        var result = await ValidateAsync(provider, idToken, validIssuers, validAudiences, jwksUrl, forceKeyRefresh: false);
        if (result.Identity == null && result.KidMiss)
        {
            // Provider may have rotated keys since our last fetch — one forced refresh, then give up.
            result = await ValidateAsync(provider, idToken, validIssuers, validAudiences, jwksUrl, forceKeyRefresh: true);
        }
        return (result.Identity, result.Error);
    }

    private async Task<(SocialIdentity? Identity, string Error, bool KidMiss)> ValidateAsync(
        string provider, string idToken, string[] issuers, string[] audiences, string jwksUrl, bool forceKeyRefresh)
    {
        IList<SecurityKey> keys;
        try
        {
            keys = await GetSigningKeysAsync(provider, jwksUrl, forceKeyRefresh);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch {Provider} signing keys", provider);
            return (null, "Sign-in verification is temporarily unavailable. Please try again.", false);
        }

        var parameters = new TokenValidationParameters
        {
            ValidIssuers = issuers,
            ValidAudiences = audiences,
            IssuerSigningKeys = keys,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromMinutes(2),
        };

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(idToken, parameters, out _);

            var subject = principal.FindFirst("sub")?.Value
                          ?? principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var email = principal.FindFirst("email")?.Value
                        ?? principal.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
            if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(email))
                return (null, "Token is missing required identity claims.", false);

            // Both providers emit email_verified as bool or the string "true".
            var verifiedRaw = principal.FindFirst("email_verified")?.Value;
            var emailVerified = string.Equals(verifiedRaw, "true", StringComparison.OrdinalIgnoreCase);

            var name = principal.FindFirst("name")?.Value; // Google only; Apple sends the name via the client on first auth

            return (new SocialIdentity(provider, subject, email.Trim().ToLowerInvariant(), emailVerified, name), string.Empty, false);
        }
        catch (SecurityTokenSignatureKeyNotFoundException)
        {
            return (null, "Invalid token.", true);
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning("Social token validation failed for {Provider}: {Reason}", provider, ex.GetType().Name);
            return (null, "Invalid token.", false);
        }
        catch (ArgumentException)
        {
            return (null, "Invalid token.", false);
        }
    }

    private async Task<IList<SecurityKey>> GetSigningKeysAsync(string provider, string jwksUrl, bool forceRefresh)
    {
        var cache = KeyCache[provider];
        if (!forceRefresh && cache.Keys.Count > 0 && DateTime.UtcNow - cache.FetchedAtUtc < KeyCacheTtl)
            return cache.Keys;

        await cache.Gate.WaitAsync();
        try
        {
            // Another request may have refreshed while we waited.
            if (!forceRefresh && cache.Keys.Count > 0 && DateTime.UtcNow - cache.FetchedAtUtc < KeyCacheTtl)
                return cache.Keys;

            var client = _httpClientFactory.CreateClient("social-jwks");
            var json = await client.GetStringAsync(jwksUrl);
            var keySet = new JsonWebKeySet(json);
            cache.Keys = keySet.GetSigningKeys();
            cache.FetchedAtUtc = DateTime.UtcNow;
            return cache.Keys;
        }
        finally
        {
            cache.Gate.Release();
        }
    }
}
