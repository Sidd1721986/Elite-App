namespace EliteApp.API.Services.Security;

/// <summary>
/// Utility for masking PII (email, phone) in application logs to adhere to privacy best practices.
/// </summary>
public static class DataMasker
{
    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return "[empty]";
        var parts = email.Trim().Split('@');
        if (parts.Length != 2) return "***";
        var name = parts[0];
        var domain = parts[1];
        if (name.Length <= 2)
            return $"{name[0]}*@{domain}";
        return $"{name[0]}***{name[^1]}@{domain}";
    }

    public static string MaskPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return "[empty]";
        var clean = phone.Trim();
        if (clean.Length <= 4) return "****";
        return $"***-***-{clean[^4..]}";
    }
}
