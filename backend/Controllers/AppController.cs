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
            
            // --- REPLACE THESE WITH YOUR ACTUAL STORE URLS WHEN READY ---
            string iOSStoreUrl = "https://apps.apple.com/app/id123456789"; 
            string androidStoreUrl = "https://play.google.com/store/apps/details?id=com.multiuserauthapp";
            string fallbackUrl = "https://eliteapp-app-test-71432.azurewebsites.net/api/health"; 
            // -------------------------------------------------------------

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
