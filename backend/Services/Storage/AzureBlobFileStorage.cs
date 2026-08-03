using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace EliteApp.API.Services.Storage;

public sealed class AzureBlobFileStorage : IFileStorage
{
    private readonly BlobContainerClient _container;

    public AzureBlobFileStorage(string connectionString, string containerName)
    {
        _container = new BlobContainerClient(connectionString, containerName);
    }

    public async Task SaveAsync(string fileName, Stream content, string contentType, CancellationToken ct = default)
    {
        var blob = _container.GetBlobClient(fileName);
        await blob.UploadAsync(content, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = contentType }
        }, ct);
    }

    public async Task<FileStorageEntry?> OpenReadAsync(string fileName, CancellationToken ct = default)
    {
        var blob = _container.GetBlobClient(fileName);
        try
        {
            var response = await blob.DownloadStreamingAsync(cancellationToken: ct);
            var details = response.Value.Details;
            return new FileStorageEntry(
                response.Value.Content,
                string.IsNullOrEmpty(details.ContentType) ? "application/octet-stream" : details.ContentType,
                details.ContentLength);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }
}
