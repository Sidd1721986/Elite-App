using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EliteApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FilesController : ControllerBase
{
    // Maximum upload size: 10 MB
    private const long MaxFileSizeBytes = 10 * 1024 * 1024;

    // Strict allowlist of accepted MIME types and their permitted extensions.
    // Any upload that does not match both checks is rejected before writing to disk.
    private static readonly Dictionary<string, HashSet<string>> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"]       = new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg" },
        ["image/png"]        = new(StringComparer.OrdinalIgnoreCase) { ".png" },
        ["image/webp"]       = new(StringComparer.OrdinalIgnoreCase) { ".webp" },
        ["image/heic"]       = new(StringComparer.OrdinalIgnoreCase) { ".heic" },
        ["image/heif"]       = new(StringComparer.OrdinalIgnoreCase) { ".heif" },
        ["application/pdf"]  = new(StringComparer.OrdinalIgnoreCase) { ".pdf" },
    };

    // Magic byte signatures for server-side content sniffing (defence-in-depth against
    // a client sending a renamed executable with a valid MIME type header).
    private static readonly (byte[] Magic, string MimeType)[] MagicSignatures =
    [
        (new byte[] { 0xFF, 0xD8, 0xFF },             "image/jpeg"),
        (new byte[] { 0x89, 0x50, 0x4E, 0x47 },       "image/png"),
        (new byte[] { 0x52, 0x49, 0x46, 0x46 },       "image/webp"), // RIFF....WEBP
        (new byte[] { 0x25, 0x50, 0x44, 0x46 },       "application/pdf"),
    ];

    // HEIC/HEIF are ISO base media files: bytes 4-7 are the "ftyp" box type and bytes 8-11
    // the major brand. Only the still-image/sequence brands are accepted — the same box
    // structure also fronts MP4/MOV, which must not pass as an image.
    private static readonly string[] HeifBrands =
        ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"];

    private static string? DetectMimeFromMagic(Stream stream)
    {
        // 12 bytes is exactly enough for every signature below, including the ftyp major
        // brand at offset 8-11. Read may return short even mid-stream, so demand all 12.
        Span<byte> header = stackalloc byte[12];
        var read = stream.ReadAtLeast(header, header.Length, throwOnEndOfStream: false);
        stream.Position = 0;

        foreach (var (magic, mime) in MagicSignatures)
        {
            if (read >= magic.Length && header[..magic.Length].SequenceEqual(magic))
            {
                // WebP extra check: bytes 8-11 must be "WEBP"
                if (mime == "image/webp" && (read < 12 || !header[8..12].SequenceEqual("WEBP"u8)))
                    continue;
                return mime;
            }
        }

        if (read >= 12 && header[4..8].SequenceEqual("ftyp"u8))
        {
            var brand = System.Text.Encoding.ASCII.GetString(header[8..12]);
            if (HeifBrands.Contains(brand, StringComparer.OrdinalIgnoreCase))
                return "image/heic";
        }

        return null;
    }

    // HEIC and HEIF are one container under two labels; clients send the same file as either,
    // so a HEIF-family brand satisfies both declared types.
    private static bool DetectedMatchesDeclared(string detected, string declared) =>
        string.Equals(detected, declared, StringComparison.OrdinalIgnoreCase) ||
        (IsHeifFamily(detected) && IsHeifFamily(declared));

    private static bool IsHeifFamily(string mime) =>
        string.Equals(mime, "image/heic", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(mime, "image/heif", StringComparison.OrdinalIgnoreCase);

    private readonly EliteApp.API.Services.Storage.IFileStorage _storage;

    public FilesController(EliteApp.API.Services.Storage.IFileStorage storage)
    {
        _storage = storage;
    }

    [HttpPost("upload")]
    [EnableRateLimiting("file-upload")]
    // Explicitly cap at MaxFileSizeBytes — replaces the former [DisableRequestSizeLimit]
    // which removed all size constraints and allowed unlimited uploads.
    [RequestSizeLimit(MaxFileSizeBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxFileSizeBytes)]
    public async Task<IActionResult> UploadFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        // ── Size guard ──────────────────────────────────────────────────────────
        if (file.Length > MaxFileSizeBytes)
            return BadRequest(new { message = $"File exceeds the maximum allowed size of {MaxFileSizeBytes / 1024 / 1024} MB." });

        // ── MIME type guard ─────────────────────────────────────────────────────
        var contentType = file.ContentType?.Trim() ?? string.Empty;
        if (!AllowedTypes.TryGetValue(contentType, out var allowedExtensions))
            return BadRequest(new { message = "File type not allowed. Accepted types: JPEG, PNG, WebP, HEIC/HEIF, PDF." });

        // ── Extension guard (must match the declared MIME type) ─────────────────
        var extension = Path.GetExtension(file.FileName ?? string.Empty);
        if (string.IsNullOrEmpty(extension) || !allowedExtensions.Contains(extension))
            return BadRequest(new { message = "File extension does not match the declared content type." });

        // ── Magic-byte guard (server-side content sniffing) ─────────────────────
        // Every allowed type has a recognisable signature, so an unrecognised header is a
        // rejection rather than a pass — otherwise a renamed binary declared as HEIC slips through.
        using (var peekStream = file.OpenReadStream())
        {
            var detectedMime = DetectMimeFromMagic(peekStream);
            if (detectedMime == null || !DetectedMatchesDeclared(detectedMime, contentType))
                return BadRequest(new { message = "File content does not match the declared type." });
        }

        // ── Persist with a random name (no user-supplied filename) ──────────────
        var safeFileName = $"{Guid.NewGuid()}{extension.ToLowerInvariant()}";

        await using (var uploadStream = file.OpenReadStream())
        {
            await _storage.SaveAsync(safeFileName, uploadStream, contentType);
        }

        var baseUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}";
        var fileUrl = $"{baseUrl}/uploads/{safeFileName}";

        return Ok(new { url = fileUrl });
    }
}
