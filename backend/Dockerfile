FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project + lockfile first so restore is a distinct cached layer (--locked-mode matches CI).
COPY ["EliteApp.API.csproj", "packages.lock.json", "./"]
RUN dotnet restore "EliteApp.API.csproj" --locked-mode

# Copy source and build.
COPY . .
# Output must stay under bin/Release/... so `dotnet publish --no-build` can reuse it.
RUN dotnet build "EliteApp.API.csproj" -c Release

FROM build AS publish
# --no-build: reuse the binary from the build stage above.
RUN dotnet publish "EliteApp.API.csproj" -c Release -o /app/publish --no-build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 5260

# Run as a non-root user (principle of least privilege).
# mcr.microsoft.com/dotnet/aspnet is Debian-based; use groupadd/useradd (not Alpine addgroup/adduser).
RUN groupadd --system appgroup \
 && useradd --system --gid appgroup --no-create-home --shell /usr/sbin/nologin appuser

COPY --from=publish /app/publish .

# Transfer ownership so the app can write to /app (uploads, logs if any).
RUN chown -R appuser:appgroup /app

USER appuser

ENV ASPNETCORE_HTTP_PORTS=5260

# Health check: Docker and Azure App Service use this to determine liveness.
# /health is the existing ASP.NET Core health endpoint registered in Program.cs.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5260/health || exit 1

ENTRYPOINT ["dotnet", "EliteApp.API.dll"]
