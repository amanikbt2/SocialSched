const fs = require('fs');
const path = require('path');

const distDeletionDir = path.join(__dirname, '../dist/data-deletion');
const distDeletionFile = path.join(distDeletionDir, 'index.html');

console.log('Generating physical static Data Deletion instructions page at dist/data-deletion/index.html...');

// Ensure the dist/data-deletion folder exists
if (!fs.existsSync(distDeletionDir)) {
  fs.mkdirSync(distDeletionDir, { recursive: true });
}

// Clean, professional HTML Data Deletion Instructions matching the app style
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Deletion Instructions - SocialSched</title>
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
    ol, ul {
      margin: 8px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    .bold {
      font-weight: 700;
    }
    .email-box {
      background-color: #F1F5F9;
      border-left: 4px solid #3B82F6;
      padding: 16px;
      border-radius: 0 8px 8px 0;
      margin: 16px 0;
      font-family: monospace;
      font-size: 14px;
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
      <div style="font-size: 40px;">🗑️</div>
      <h1 class="title">Data Deletion Instructions</h1>
      <div class="subtitle">How to manage and delete your SocialSched data</div>
    </div>

    <div class="section">
      <h2 class="section-title">1. Introduction</h2>
      <p>SocialSched is a client-side social media scheduler utility. We prioritize your privacy and transparency. Because the App operates entirely locally on your device (storing access tokens, page details, and schedules directly inside secure local database files on your hardware), we do not run backend databases to collect or store your personal credentials or social media information.</p>
    </div>

    <div class="section">
      <h2 class="section-title">2. Deleting Connected Meta Data (Facebook/Instagram)</h2>
      <p>You can revoke the App's access to your Meta account and delete associated data at any time by following these official Facebook deauthorization steps:</p>
      <ol>
        <li>Go to your Facebook Account's <span class="bold">Settings & Privacy</span> > <span class="bold">Settings</span>.</li>
        <li>In the left sidebar, navigate to <span class="bold">Apps and Websites</span> (or <span class="bold">Business Integrations</span> depending on your account setup).</li>
        <li>Locate <span class="bold">SocialSched</span> (or <span class="bold">smartflow</span>) in the list.</li>
        <li>Click the <span class="bold">Remove</span> button next to it.</li>
        <li>Confirm the removal to revoke all active user and page access tokens.</li>
      </ol>
    </div>

    <div class="section">
      <h2 class="section-title">3. Clearing Local Storage & Offline Data</h2>
      <p>To completely wipe all cached access tokens, scheduled posts, and saved page entries from your local computer or phone:</p>
      <ul>
        <li>Launch the App, open the <span class="bold">Settings Drawer</span> (gear/menu icon in the top header), and click <span class="bold">App Storage Folders</span> or <span class="bold">Wipe Local Storage</span>.</li>
        <li>Alternatively, uninstalling the App will automatically remove its secure local database partition and all cached credentials.</li>
      </ul>
    </div>

    <div class="section">
      <h2 class="section-title">4. Manual Data Deletion Requests</h2>
      <p>If you have any queries about deauthorization, or if you want us to verify that no residual data remains, you can request support by email:</p>
      <div class="email-box">
        To: amanikbt1@gmail.com<br>
        Subject: Smartflow Data Deletion Request<br><br>
        Please let us know if you require confirmation of your account status.
      </div>
      <p>As no personal data is stored on our servers, we will confirm the client-side nature of the App and assist you in completing local database removal if needed.</p>
    </div>

    <div class="footer">
      SocialSched App &copy; 2026. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

fs.writeFileSync(distDeletionFile, htmlContent, 'utf8');
console.log('✅ Successfully wrote dist/data-deletion/index.html');
