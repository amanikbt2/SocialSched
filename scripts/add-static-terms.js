const fs = require('fs');
const path = require('path');

const distTermsDir = path.join(__dirname, '../dist/terms');
const distTermsFile = path.join(distTermsDir, 'index.html');

console.log('Generating physical static Terms of Service page at dist/terms/index.html...');

// Ensure the dist/terms folder exists
if (!fs.existsSync(distTermsDir)) {
  fs.mkdirSync(distTermsDir, { recursive: true });
}

// Simple, clean HTML Terms of Service matching the app style
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - SocialSched</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      color: #334155;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 800px;
      margin: 40px auto;
      padding: 24px;
      background-color: #FFFFFF;
      border-radius: 12px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .title {
      font-size: 28px;
      font-weight: 800;
      color: #0F172A;
      margin: 12px 0 4px 0;
    }
    .subtitle {
      font-size: 12px;
      color: #64748B;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #1E293B;
      margin-bottom: 10px;
    }
    p {
      margin: 0 0 12px 0;
    }
    ul {
      margin: 8px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    .bold {
      font-weight: 700;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #E2E8F0;
      font-size: 12px;
      color: #94A3B8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 40px;">📜</div>
      <h1 class="title">Terms of Service</h1>
      <div class="subtitle">Last updated: August 15, 2026</div>
    </div>

    <div class="section">
      <h2 class="section-title">1. Agreement to Terms</h2>
      <p>By using the SocialSched desktop application ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not install or use the App.</p>
    </div>

    <div class="section">
      <h2 class="section-title">2. Use License & App Functionality</h2>
      <p>SocialSched is a local, client-side social media scheduler utility. We grant you a personal, non-transferable, non-exclusive license to use the App on your personal devices in accordance with these Terms.</p>
      <ul>
        <li><span class="bold">Local Operation:</span> All accounts, tokens, schedules, and media files are stored locally on your device. No data is stored, processed, or transferred to middle-man servers operated by us.</li>
        <li><span class="bold">API Usage:</span> The App interacts directly with Meta (Facebook/Instagram) APIs. You are solely responsible for ensuring your API keys, access tokens, and pages conform to their respective platforms' developer policies.</li>
      </ul>
    </div>

    <div class="section">
      <h2 class="section-title">3. User Responsibilities & Compliance</h2>
      <p>You agree to use the App only for lawful purposes. You must comply with all Facebook and Meta Platform Terms, Developer Policies, and Community Standards. You are solely responsible for all content, text, links, photos, and videos you schedule or publish using the App.</p>
    </div>

    <div class="section">
      <h2 class="section-title">4. Disclaimers & Limitation of Liability</h2>
      <p>The App is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the App will meet your requirements or that its operation will be uninterrupted or error-free.</p>
      <p>In no event shall we be liable for any damages (including, without limitation, damages for loss of data or profit, account suspension or termination by Meta/third parties, or business interruption) arising out of the use or inability to use the App.</p>
    </div>

    <div class="section">
      <h2 class="section-title">5. Data Privacy</h2>
      <p>Your use of the App is also governed by our Privacy Policy, which explains how we handle your local storage and access tokens. You can view the Privacy Policy at <a href="https://socialsched.onrender.com/privacy" style="color: #3B82F6; text-decoration: none;">socialsched.onrender.com/privacy</a>.</p>
    </div>

    <div class="section">
      <h2 class="section-title">6. Contact Information</h2>
      <p>If you have any questions or feedback regarding these Terms, please contact us at <span class="bold">amanikbt1@gmail.com</span>.</p>
    </div>

    <div class="footer">
      SocialSched App &copy; 2026. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

fs.writeFileSync(distTermsFile, htmlContent, 'utf8');
console.log('✅ Successfully wrote dist/terms/index.html');
