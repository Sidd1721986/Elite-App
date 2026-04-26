using Microsoft.AspNetCore.Mvc;

namespace EliteApp.API.Controllers
{
    [ApiController]
    [Route("app")]
    public class AppController : ControllerBase
    {
        private readonly ILogger<AppController> _logger;

        public AppController(ILogger<AppController> logger)
        {
            _logger = logger;
        }

        [HttpGet]
        public IActionResult Download()
        {
            string userAgent = Request.Headers["User-Agent"].ToString().ToLower();
            
            // Store URLs — update iOSStoreUrl with the real App ID once the app is live on the App Store.
            // Android URL uses the correct bundle ID (com.elitehomeservicesusa.app).
            string iOSStoreUrl     = "https://apps.apple.com/app/id123456789"; // TODO: replace id123456789 with real App Store ID after first submission
            string androidStoreUrl = "https://play.google.com/store/apps/details?id=com.elitehomeservicesusa.app";
            string fallbackUrl     = "https://elitehomeservicesusa.com";

            if (userAgent.Contains("iphone") || userAgent.Contains("ipad") || userAgent.Contains("ipod"))
            {
                _logger.LogInformation("Redirecting iOS user to: {Url}", iOSStoreUrl);
                return Redirect(iOSStoreUrl);
            }

            if (userAgent.Contains("android"))
            {
                _logger.LogInformation("Redirecting Android user to: {Url}", androidStoreUrl);
                return Redirect(androidStoreUrl);
            }

            _logger.LogWarning("Unknown device (User-Agent: {UserAgent}). Redirecting to fallback.", userAgent);
            return Redirect(fallbackUrl);
        }
    }
}
