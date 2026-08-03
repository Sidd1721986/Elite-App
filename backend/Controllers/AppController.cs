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
            
            // Store URLs use the live App Store Connect app id and the Android bundle id.
            string iOSStoreUrl     = "https://apps.apple.com/app/id6779766867";
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
