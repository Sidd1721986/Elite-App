using System.Threading.RateLimiting;
using EliteApp.API.Services.Email;
using EliteApp.API.Services.Sms;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.ResponseCompression;
using Serilog;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Diagnostics;
using HealthChecks.NpgSql;

var builder = WebApplication.CreateBuilder(args);
// BindAllInterfaces: listen on 0.0.0.0 so physical phones (same Wi‑Fi) can reach the API during dev.
// appsettings.Development.json sets Kestrel:BindAllInterfaces=true; omit or false for localhost-only.
// Configure Serilog for structured logging
var serilogConfig = new LoggerConfiguration()
    .WriteTo.Console()
    .Enrich.FromLogContext();

var aiKey = builder.Configuration["ApplicationInsights:InstrumentationKey"];
if (!string.IsNullOrEmpty(aiKey))
{
    serilogConfig.WriteTo.ApplicationInsights(aiKey, TelemetryConverter.Traces);
}

Log.Logger = serilogConfig.CreateLogger();
builder.Host.UseSerilog();

builder.WebHost.ConfigureKestrel((context, serverOptions) =>
{
    var bindAll = context.Configuration.GetValue("Kestrel:BindAllInterfaces", false)
        || context.HostingEnvironment.IsProduction();
    if (bindAll)
        serverOptions.ListenAnyIP(5260);
    else
        serverOptions.ListenLocalhost(5260);
});

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddEndpointsApiExplorer();


// Response compression for smaller payloads over network
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
    options.Level = System.IO.Compression.CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
    options.Level = System.IO.Compression.CompressionLevel.Fastest);
builder.Services.AddResponseCaching();
builder.Services.AddMemoryCache();

// Services
builder.Services.AddSingleton<IEmailSender>(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var env = sp.GetRequiredService<IHostEnvironment>();
    if (!string.IsNullOrWhiteSpace(cfg["Email:Smtp:Host"]))
        return new SmtpEmailSender(cfg, sp.GetRequiredService<ILogger<SmtpEmailSender>>());
    return new LoggingEmailSender(
        sp.GetRequiredService<ILogger<LoggingEmailSender>>(),
        env);
});
builder.Services.AddScoped<EliteApp.API.Services.IAuthService, EliteApp.API.Services.AuthService>();

// SMS: swap MockSmsService for a real provider when Sms:Provider config is present.
// See MockSmsService.cs for integration instructions (Twilio, Azure Communication Services, etc.).
builder.Services.AddSingleton<ISmsService>(sp =>
{
    var cfg    = sp.GetRequiredService<IConfiguration>();
    var logger = sp.GetRequiredService<ILogger<MockSmsService>>();
    // TODO: check cfg["Sms:Twilio:AccountSid"] (or your chosen provider) and return a real impl.
    return new MockSmsService(logger);
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, token) =>
    {
        ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await ctx.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Too many requests. Please try again later." },
            token);
    };
    options.AddPolicy("password-reset", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var path = httpContext.Request.Path.Value ?? "";
        var partition = $"{ip}:{path}";
        return RateLimitPartition.GetSlidingWindowLimiter(partition, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 12,
            Window = TimeSpan.FromMinutes(15),
            SegmentsPerWindow = 3,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });
    options.AddPolicy("auth-login", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetSlidingWindowLimiter(ip, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(15),
            SegmentsPerWindow = 4,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });
    // Job creation: 20 per user per hour prevents runaway submission loops.
    options.AddPolicy("create-job", httpContext =>
    {
        var userId = httpContext.User?.FindFirst("id")?.Value
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anon";
        return RateLimitPartition.GetSlidingWindowLimiter(userId, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromHours(1),
            SegmentsPerWindow = 4,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });
});

if (!builder.Environment.IsDevelopment())
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });
}

// Add Entity Framework Core with PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<EliteApp.API.Data.AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Health Checks — uses the registered NpgSql package (async, pooled connection)
// instead of the former raw-connection + synchronous Open() that blocked the thread pool.
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString!, name: "Postgres")
    .AddCheck("Memory", () =>
    {
        var used = Process.GetCurrentProcess().WorkingSet64 / 1024 / 1024;
        return used < 1024 ? HealthCheckResult.Healthy() : HealthCheckResult.Degraded();
    });

static string ResolveJwtSigningKey(IConfiguration configuration, IHostEnvironment environment)
{
    var key = configuration["Jwt:Key"]?.Trim() ?? string.Empty;
    if (environment.IsProduction())
    {
        if (string.IsNullOrEmpty(key))
            throw new InvalidOperationException("Jwt:Key must be configured in Production (minimum 32 characters).");
        if (key.Length < 32)
            throw new InvalidOperationException("Jwt:Key must be at least 32 characters in Production.");
        return key;
    }

    return string.IsNullOrWhiteSpace(key)
        ? "supersecretsupersecretsupersecret123!"
        : key;
}

if (builder.Environment.IsProduction())
{
    var cs = builder.Configuration.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(cs))
        throw new InvalidOperationException("ConnectionStrings:DefaultConnection must be set in Production.");

    var pepper = builder.Configuration["PasswordReset:Pepper"]?.Trim() ?? string.Empty;
    if (string.IsNullOrEmpty(pepper) ||
        pepper.Contains("REPLACE_", StringComparison.OrdinalIgnoreCase) ||
        pepper.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("PasswordReset:Pepper must be set to a strong secret in Production.");

    var allowedHosts = builder.Configuration["AllowedHosts"]?.Trim() ?? string.Empty;
    if (allowedHosts == "*" || string.IsNullOrWhiteSpace(allowedHosts))
        throw new InvalidOperationException(
            "AllowedHosts must list your API hostname(s) in Production (semicolon-separated), e.g. \"api.example.com;your-api.azurewebsites.net\". Wildcard * is not allowed.");
}

var jwtKey = ResolveJwtSigningKey(builder.Configuration, builder.Environment);

// Issuer and audience are read from config (default: "EliteApp").
// Override via Jwt:Issuer / Jwt:Audience in appsettings or environment variables.
var jwtIssuer   = builder.Configuration["Jwt:Issuer"]?.Trim()   is { Length: > 0 } iss ? iss : "EliteApp";
var jwtAudience = builder.Configuration["Jwt:Audience"]?.Trim() is { Length: > 0 } aud ? aud : "EliteApp";

// Single source of truth for the signing key, issuer, and audience — used both here
// (JWT validation middleware) and in AuthService (token generation).  Eliminates the old
// bifurcated code path that had a hard-coded fallback key inside AuthService.
builder.Services.AddSingleton(new EliteApp.API.Services.JwtSigningKeyProvider(jwtKey, jwtIssuer, jwtAudience));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtKey)),
        RoleClaimType = System.Security.Claims.ClaimTypes.Role,
        ClockSkew = TimeSpan.FromMinutes(1) // Standard drift allowance
    };

    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            var logger = context.HttpContext.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("Microsoft.AspNetCore.Authentication.JwtBearer");
            var env = context.HttpContext.RequestServices.GetRequiredService<IHostEnvironment>();
            if (env.IsDevelopment())
                logger.LogDebug(context.Exception, "JWT authentication failed");
            else
                logger.LogWarning("JWT authentication failed");
            return Task.CompletedTask;
        }
    };
});

if (builder.Environment.IsDevelopment())
    Microsoft.IdentityModel.Logging.IdentityModelEventSource.ShowPII = true;

builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

    options.AddPolicy("ProdCors", policy =>
    {
        var originsText = builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty;
        var origins = originsText.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (origins.Length == 0)
            throw new InvalidOperationException(
                "Cors:AllowedOrigins must list allowed web origins (semicolon-separated), e.g. https://app.example.com");
        policy.WithOrigins(origins).AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
    app.UseForwardedHeaders();

// Global Exception Handler
app.Use(async (context, next) =>
{
    try { await next(); }
    catch (Exception ex)
    {
        var traceId = Activity.Current?.Id ?? context.TraceIdentifier;
        Log.Error(ex, "Unhandled Exception [TraceId: {TraceId}]", traceId);

        // Guard: if the response has already started (e.g., mid-stream file download),
        // writing more bytes would corrupt the output. Let the pipeline handle teardown.
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                message = "An internal server error occurred. Please contact support with this Trace ID.",
                traceId
            });
        }
    }
});

if (app.Environment.IsProduction() &&
    string.IsNullOrWhiteSpace(app.Configuration["Email:Smtp:Host"]))
{
    app.Logger.LogWarning(
        "Production: Email:Smtp:Host is not configured. Password reset will return 503 until SMTP is set.");
}

// Configure the HTTP request pipeline.


// app.UseHttpsRedirection(); // Disable for easier local dev with Android emulator

app.UseStaticFiles();
app.UseResponseCompression();
app.UseResponseCaching();

if (app.Environment.IsProduction())
    app.UseCors("ProdCors");
else
    app.UseCors("DevCors");

app.UseRateLimiter();

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block"); // Extra safety
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none';"); // Hardened CSP
    
    if (app.Environment.IsProduction())
        context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
        
    await next();
});

app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var context = services.GetRequiredService<EliteApp.API.Data.AppDbContext>();
    var env = services.GetRequiredService<IHostEnvironment>();
    var configuration = services.GetRequiredService<IConfiguration>();

    // Default: migrate on startup (single-instance App Service / local). For multiple replicas
    // without extra infrastructure, set Database__RunMigrations=false and apply migrations
    // once from CI or `dotnet ef database update` before rolling out new instances.
    var runMigrations = configuration.GetValue("Database:RunMigrations", true);
    if (runMigrations)
        await context.Database.MigrateAsync();
    else
        Log.Warning(
            "Database:RunMigrations is false; skipping EF migrations at startup. Apply pending migrations before serving traffic.");

    const string adminEmail = "admin@elite.com";
    // Use async query — synchronous DB calls block thread-pool threads at startup.
    var existingAdmin = await context.Users.FirstOrDefaultAsync(u => u.Email == adminEmail);

    if (!env.IsProduction())
    {
        if (existingAdmin == null)
        {
            var adminUser = new EliteApp.API.Models.User
            {
                Id = Guid.NewGuid(),
                Email = adminEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                Role = EliteApp.API.Models.UserRole.Admin.ToString(),
                Name = "Elite Admin",
                IsApproved = true,
                CreatedAt = DateTime.UtcNow
            };
            context.Users.Add(adminUser);
            await context.SaveChangesAsync();
        }
        else if (!existingAdmin.PasswordHash.StartsWith("$2"))
        {
            existingAdmin.PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123");
            await context.SaveChangesAsync();
        }
    }
    else
    {
        var bootstrapPassword = configuration["Bootstrap:AdminPassword"];
        if (existingAdmin == null && !string.IsNullOrWhiteSpace(bootstrapPassword))
        {
            var adminUser = new EliteApp.API.Models.User
            {
                Id = Guid.NewGuid(),
                Email = adminEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(bootstrapPassword),
                Role = EliteApp.API.Models.UserRole.Admin.ToString(),
                Name = "Elite Admin",
                IsApproved = true,
                CreatedAt = DateTime.UtcNow
            };
            context.Users.Add(adminUser);
            await context.SaveChangesAsync();
        }
    }
}

app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    AllowCachingResponses = false,
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var result = System.Text.Json.JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new { name = e.Key, status = e.Value.Status.ToString() }),
            duration = report.TotalDuration
        });
        await context.Response.WriteAsync(result);
    }
});

app.MapControllers();

app.Run();
