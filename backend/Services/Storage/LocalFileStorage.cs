namespace EliteApp.API.Services.Storage;

/// <summary>
/// Path-based storage. In production this points at the App Service /home share
/// (persistent, shared across instances); in dev it points at wwwroot/uploads.
/// A plain container path would be ephemeral — the root must be durable in prod.
/// </summary>
public sealed class LocalFileStorage : IFileStorage
{
    private readonly string _root;

    private static readonly Dictionary<string, string> ExtensionContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png",
        [".webp"] = "image/webp", [".heic"] = "image/heic", [".heif"] = "image/heif",
        [".pdf"] = "application/pdf",
    };

    public LocalFileStorage(string rootPath)
    {
        _root = rootPath;
        Directory.CreateDirectory(_root);
    }

    public async Task SaveAsync(string fileName, Stream content, string contentType, CancellationToken ct = default)
    {
        var path = Path.Combine(_root, fileName);
        await using var stream = new FileStream(path, FileMode.Create);
        await content.CopyToAsync(stream, ct);
    }

    public Task<FileStorageEntry?> OpenReadAsync(string fileName, CancellationToken ct = default)
    {
        var path = Path.Combine(_root, fileName);
        if (!System.IO.File.Exists(path))
            return Task.FromResult<FileStorageEntry?>(null);

        var contentType = ExtensionContentTypes.GetValueOrDefault(
            Path.GetExtension(fileName), "application/octet-stream");
        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<FileStorageEntry?>(new FileStorageEntry(stream, contentType, stream.Length));
    }
}
