using Microsoft.AspNetCore.Mvc;

namespace EliteApp.API.Controllers
{
    [ApiController]
    [Route("")]
    public class LegalController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public LegalController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet("privacy")]
        [Produces("text/html")]
        public ContentResult GetPrivacyPolicy()
        {
            var supportEmail = _configuration["Legal:SupportEmail"] ?? "support@eliteservices.com";
            
            string html = $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Privacy Policy - Elite Services</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px 20px; }}
        h1 {{ color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 10px; }}
        h2 {{ color: #2c3e50; margin-top: 30px; }}
        .footer {{ margin-top: 50px; font-size: 0.9em; color: #666; border-top: 1px solid #eee; padding-top: 20px; }}
    </style>
</head>
<body>
    <h1>Privacy Policy</h1>
    <p>Last Updated: {DateTime.UtcNow:MMMM dd, yyyy}</p>
    
    <p>Welcome to <strong>Elite Services</strong>. Your privacy is critically important to us.</p>
    
    <h2>1. Data We Collect</h2>
    <p>We collect information that you provide directly to us when you create an account, such as your name, email address, phone number, and physical address. We also collect data related to service requests you create or manage through the app.</p>
    
    <h2>2. How We Use Your Data</h2>
    <p>We use the information we collect to:</p>
    <ul>
        <li>Provide, maintain, and improve our services.</li>
        <li>Process transactions and send related information.</li>
        <li>Send you technical notices, updates, and support messages.</li>
        <li>Respond to your comments and questions.</li>
    </ul>
    
    <h2>3. Data Protection</h2>
    <p>We implement a variety of security measures to maintain the safety of your personal information. Your personal information is contained behind secured networks and is only accessible by a limited number of persons who have special access rights to such systems.</p>
    
    <h2>4. Contact Us</h2>
    <p>If you have any questions about this Privacy Policy, please contact us at: <a href=""mailto:{supportEmail}"">{supportEmail}</a></p>
    
    <div class=""footer"">
        &copy; {DateTime.UtcNow.Year} Elite Services. All rights reserved.
    </div>
</body>
</html>";

            return new ContentResult
            {
                ContentType = "text/html",
                Content = html,
                StatusCode = 200
            };
        }

        [HttpGet("support")]
        [Produces("text/html")]
        public ContentResult GetSupport()
        {
            var supportEmail = _configuration["Legal:SupportEmail"] ?? "support@eliteservices.com";

            string html = $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Support - Elite Services</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px 20px; text-align: center; }}
        h1 {{ color: #1a1a1a; }}
        .card {{ background: #f9f9f9; border-radius: 8px; padding: 30px; margin-top: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .email-link {{ font-size: 1.2em; color: #007AFF; font-weight: bold; text-decoration: none; }}
        .footer {{ margin-top: 50px; font-size: 0.8em; color: #666; }}
    </style>
</head>
<body>
    <h1>Elite Services Support</h1>
    <p>Need help with your account or a service request? We are here to help!</p>
    
    <div class=""card"">
        <h2>Contact Our Support Team</h2>
        <p>Email us at any time and we will get back to you as soon as possible:</p>
        <a href=""mailto:{supportEmail}"" class=""email-link"">{supportEmail}</a>
    </div>
    
    <div class=""footer"">
        &copy; {DateTime.UtcNow.Year} Elite Services. All rights reserved.
    </div>
</body>
</html>";

            return new ContentResult
            {
                ContentType = "text/html",
                Content = html,
                StatusCode = 200
            };
        }
    }
}
