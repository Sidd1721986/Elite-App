namespace EliteApp.API.Services;

/// <summary>
/// Single source of truth for phone-number matching. Numbers are stored in whatever format the
/// user typed, so every lookup compares the normalized form — and User.PhoneNormalized is written
/// with the very same function, otherwise indexed lookups and in-memory checks disagree.
/// </summary>
public static class PhoneNormalizer
{
    /// <summary>
    /// Reduce a phone number to comparable digits: strip everything non-numeric and, for
    /// 11-digit numbers, drop a leading country code so US numbers match with or without "+1".
    /// Returns the last 10 digits when available.
    /// </summary>
    public static string Normalize(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length > 10 ? digits[^10..] : digits;
    }

    /// <summary>
    /// The value to persist in <c>PhoneNormalized</c>. Null when there is nothing to match on, so
    /// a blank or digit-free phone never collides with another such row on an equality lookup.
    /// </summary>
    public static string? ForStorage(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var normalized = Normalize(phone);
        return normalized.Length == 0 ? null : normalized;
    }
}
