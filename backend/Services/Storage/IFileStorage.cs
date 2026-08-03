namespace EliteApp.API.Services.Storage;

/// <summary>
/// Abstraction over upload storage. Production uses Azure Blob Storage so files survive
/// container restarts and are visible to every instance; local dev without a connection
/// string falls back to the on-disk wwwroot/uploads folder.
/// </summary>
public interface IFileStorage
{
    Task SaveAsync(string fileName, Stream content, string contentType, CancellationToken ct = default);

    /// <summary>Returns null when the file does not exist.</summary>
    Task<FileStorageEntry?> OpenReadAsync(string fileName, CancellationToken ct = default);
}

public sealed record FileStorageEntry(Stream Content, string ContentType, long? Length);
