using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

    private static string? DetectMimeFromMagic(Stream stream)
    {
        Span<byte> header = stackalloc byte[12];
        var read = stream.Read(header);
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
        return null; // HEIC/HEIF lack universal magic — fall through to MIME+extension check
    }

    private readonly IWebHostEnvironment _environment;

    public FilesController(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    [HttpPost("upload")]
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
        // HEIC/HEIF don't have universal magic bytes so we skip them here.
        if (!contentType.StartsWith("image/heic", StringComparison.OrdinalIgnoreCase) &&
            !contentType.StartsWith("image/heif", StringComparison.OrdinalIgnoreCase))
        {
            using var peekStream = file.OpenReadStream();
            var detectedMime = DetectMimeFromMagic(peekStream);
            if (detectedMime != null && !string.Equals(detectedMime, contentType, StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "File content does not match the declared type." });
        }

        // ── Write to disk with a random name (no user-supplied filename) ────────
        var uploadsFolder = Path.Combine(_environment.WebRootPath ?? "wwwroot", "uploads");
        if (!Directory.Exists(uploadsFolder))
            Directory.CreateDirectory(uploadsFolder);

        var safeFileName = $"{Guid.NewGuid()}{extension.ToLowerInvariant()}";
        var filePath = Path.Combine(uploadsFolder, safeFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var baseUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}";
        var fileUrl = $"{baseUrl}/uploads/{safeFileName}";

        return Ok(new { url = fileUrl });
    }
}
