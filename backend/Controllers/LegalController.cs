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

        private string SupportEmail =>
            _configuration["Legal:SupportEmail"] ?? "support@eliteservices.com";

        [HttpGet("privacy")]
        [Produces("text/html")]
        public ContentResult GetPrivacyPolicy()
        {
            var supportEmail = SupportEmail;
            var year = DateTime.UtcNow.Year;

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
        ul {{ padding-left: 1.25rem; }}
        .footer {{ margin-top: 50px; font-size: 0.9em; color: #666; border-top: 1px solid #eee; padding-top: 20px; }}
    </style>
</head>
<body>
    <h1>Privacy Policy</h1>
    <p><strong>Effective date:</strong> {DateTime.UtcNow:MMMM dd, yyyy} (UTC)</p>

    <p>Welcome to <strong>Elite Services</strong> (""we,"" ""us,"" or ""our""). This policy describes how we collect, use, and share information when you use our mobile application and related services.</p>

    <h2>1. Information we collect</h2>
    <ul>
        <li><strong>Account and profile:</strong> Name, email address, phone number, physical or service address, account role (for example customer, vendor, or administrator), and similar details you provide when registering or updating your profile.</li>
        <li><strong>Jobs and service requests:</strong> Information you enter about service requests, assignments, status updates, and related operational data.</li>
        <li><strong>Messages:</strong> Text and attachments you send through in-app messaging between authorized participants (for example customers, vendors, and administrators) in connection with jobs.</li>
        <li><strong>Photos and files:</strong> Images or documents you upload (for example job-site photos) that are stored and shared as part of providing the service.</li>
        <li><strong>Technical data:</strong> Information such as IP address, device or app identifiers, and logs used to secure the service, troubleshoot, and improve reliability.</li>
    </ul>

    <h2>2. How we use information</h2>
    <p>We use the information above to:</p>
    <ul>
        <li>Create and manage accounts, authenticate users, and enforce role-based access.</li>
        <li>Operate, maintain, and improve the platform, including job workflows, assignments, and communications between users involved in a job.</li>
        <li>Send service-related notices, security alerts, and support responses.</li>
        <li>Meet legal obligations and respond to lawful requests.</li>
    </ul>

    <h2>3. How we share information</h2>
    <p>We share information only as needed to provide the service: for example, job details and messages may be visible to other users who are legitimately involved in the same job or administration of the platform. We may use service providers (such as hosting or email) that process data on our instructions and are bound by appropriate obligations. We do not sell your personal information.</p>

    <h2>4. Retention and account closure</h2>
    <p>We retain information for as long as your account is active and as needed to provide the service. If you deactivate your account through the app, we mark your account inactive and restrict sign-in; some records may be retained where required for legitimate business or legal purposes (for example audit, security, or unresolved disputes).</p>

    <h2>5. Security</h2>
    <p>We implement technical and organizational measures designed to protect personal information. No method of transmission or storage is completely secure; we encourage you to use a strong password and protect your credentials.</p>

    <h2>6. Your choices and rights</h2>
    <p>Depending on where you live, you may have rights to access, correct, delete, or restrict processing of your personal data, or to object to certain processing. You can update some information in the app. For other requests, contact us using the email below. You may deactivate your account from the app&apos;s account settings where that feature is available.</p>

    <h2>7. Children</h2>
    <p>The service is not directed to children under 13 (or the minimum age required in your jurisdiction), and we do not knowingly collect personal information from children.</p>

    <h2>8. International users</h2>
    <p>If you access the service from outside the country where our servers or service providers are located, your information may be processed in those countries.</p>

    <h2>9. Changes</h2>
    <p>We may update this policy from time to time. We will post the updated version and revise the effective date above. Material changes may be communicated through the app or by email where appropriate.</p>

    <h2>10. Contact</h2>
    <p>Questions about this policy: <a href=""mailto:{supportEmail}"">{supportEmail}</a></p>

    <div class=""footer"">
        &copy; {year} Elite Services. All rights reserved.
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
            var supportEmail = SupportEmail;
            var year = DateTime.UtcNow.Year;

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
        .note {{ text-align: left; max-width: 560px; margin: 24px auto; color: #555; font-size: 0.95rem; }}
    </style>
</head>
<body>
    <h1>Elite Services Support</h1>
    <p>Need help with your account, a service request, or to report a concern about another user&apos;s conduct (including in-app messages)?</p>

    <div class=""note"">
        <strong>Safety and reporting:</strong> For harassment, threats, spam, or other misuse of messaging or job features, email us with a short description and (if applicable) the job or conversation context. We review reports in line with our Terms of Service.
    </div>

    <div class=""card"">
        <h2>Contact our support team</h2>
        <p>Email us at any time:</p>
        <a href=""mailto:{supportEmail}"" class=""email-link"">{supportEmail}</a>
    </div>

    <div class=""footer"">
        &copy; {year} Elite Services. All rights reserved.
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

        [HttpGet("terms")]
        [Produces("text/html")]
        public ContentResult GetTermsOfService()
        {
            var supportEmail = SupportEmail;
            var year = DateTime.UtcNow.Year;

            string html = $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Terms of Service - Elite Services</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px 20px; }}
        h1 {{ color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 10px; }}
        h2 {{ color: #2c3e50; margin-top: 28px; }}
        ul {{ padding-left: 1.25rem; }}
        .footer {{ margin-top: 40px; font-size: 0.9em; color: #666; border-top: 1px solid #eee; padding-top: 20px; }}
    </style>
</head>
<body>
    <h1>Terms of Service</h1>
    <p><strong>Effective date:</strong> {DateTime.UtcNow:MMMM dd, yyyy} (UTC)</p>

    <h2>1. Agreement</h2>
    <p>By accessing or using the Elite Services mobile application and related services (the ""Service""), you agree to these Terms. If you do not agree, do not use the Service.</p>

    <h2>2. Eligibility</h2>
    <p>You must be able to form a binding contract in your jurisdiction and must not be barred from using the Service under applicable law. The Service is not intended for users under the age of 13.</p>

    <h2>3. Accounts</h2>
    <p>You agree to provide accurate registration information and to keep your credentials confidential. You are responsible for activity under your account. Roles (such as customer, vendor, or administrator) are assigned as part of registration or administration; contact support if you need a correction that cannot be made in the app.</p>

    <h2>4. Marketplace and independent vendors</h2>
    <p>The Service helps connect customers with independent service providers (vendors). Vendors are independent businesses or individuals, not our employees. We do not guarantee the quality, timing, or outcome of third-party work, though we provide tools for communication and job tracking.</p>

    <h2>5. Messaging and acceptable use</h2>
    <p>In-app messaging is provided for job-related communication between authorized users (for example customers, vendors, and administrators). You agree not to use the Service to send unlawful, harassing, threatening, defamatory, obscene, hateful, or spam content, or to attempt to harm others or the platform. We may investigate reports and suspend or terminate accounts that violate these rules. Concerns may be reported to <a href=""mailto:{supportEmail}"">{supportEmail}</a>.</p>

    <h2>6. Payments and invoicing</h2>
    <p>The Service facilitates coordination of jobs and may display status related to invoicing as part of your workflow. Unless we expressly state otherwise in the app for a given transaction, payment processing and collection arrangements are between you and the other party (for example customer and vendor). You are responsible for taxes, permits, and compliance applicable to your services or purchases.</p>

    <h2>7. Your content</h2>
    <p>You retain rights in content you submit (such as text, photos, or files). You grant us a limited license to host, display, and share that content as needed to operate the Service, including showing it to other users involved in the same jobs.</p>

    <h2>8. Termination</h2>
    <p>You may deactivate your account using the in-app account option where available. We may suspend or terminate access if we reasonably believe you have violated these Terms or pose a risk to the Service or other users. Provisions that by their nature should survive (including disclaimers and limits of liability) will survive termination.</p>

    <h2>9. Disclaimers and limitation of liability</h2>
    <p>The Service is provided ""as is"" without warranties of any kind, to the fullest extent permitted by law. To the maximum extent permitted by applicable law, Elite Services and its affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, arising out of your use of the Service or interactions with other users.</p>

    <h2>10. Changes</h2>
    <p>We may modify these Terms from time to time. We will post the updated Terms at this URL and update the effective date. Continued use after changes constitutes acceptance of the revised Terms.</p>

    <h2>11. Contact</h2>
    <p><a href=""mailto:{supportEmail}"">{supportEmail}</a></p>

    <div class=""footer"">
        &copy; {year} Elite Services. All rights reserved.
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
