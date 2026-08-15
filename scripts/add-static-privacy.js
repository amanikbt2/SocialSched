const fs = require("fs");
const path = require("path");

function createStaticPage(folderName, title, icon, bodyHtml) {
  const targetDir = path.join(__dirname, "../dist", folderName);
  const targetFile = path.join(targetDir, "index.html");

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - SocialSched</title>
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
    .card {
      background-color: #F8FAFC;
      padding: 16px;
      border-radius: 10px;
      border: 1px solid #E2E8F0;
      margin-top: 12px;
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
      <div style="font-size: 40px;">${icon}</div>
      <h1 class="title">${title}</h1>
      <div class="subtitle">Last updated: August 15, 2026</div>
    </div>
    ${bodyHtml}
    <div class="footer">
      SocialSched App &copy; 2026. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(targetFile, fullHtml, "utf8");
  console.log(`✅ Successfully wrote dist/${folderName}/index.html`);
}

// 1. Privacy Policy
createStaticPage(
  "privacy",
  "Privacy Policy",
  "🛡️",
  `
  <div class="section">
    <h2 class="section-title">1. Introduction</h2>
    <p>Welcome to SocialSched ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how our application processes, stores, and handles your information when you connect your Facebook and Instagram accounts.</p>
  </div>
  <div class="section">
    <h2 class="section-title">2. Information We Collect & How We Use It</h2>
    <p>Our application operates as a client-side scheduling utility. We do not run middle-man database servers to collect or store your personal social media credentials.</p>
    <ul>
      <li><span class="bold">Access Tokens:</span> Saved locally on your device using secure storage and sent directly to Meta Graph APIs.</li>
      <li><span class="bold">Media Files:</span> Stored locally on your device's hidden app directory.</li>
    </ul>
  </div>
  <div class="section">
    <h2 class="section-title">3. Contact Us</h2>
    <p>Email: <span class="bold">amanikbt1@gmail.com</span></p>
  </div>
`,
);

// 2. Terms of Service
createStaticPage(
  "terms",
  "Terms of Service",
  "📄",
  `
  <div class="section">
    <h2 class="section-title">1. Agreement to Terms</h2>
    <p>By accessing or using SocialSched, you agree to be bound by these Terms of Service.</p>
  </div>
  <div class="section">
    <h2 class="section-title">2. Platform Usage</h2>
    <p>SocialSched enables scheduling directly to Facebook and Instagram. Users agree to abide by all platform community guidelines.</p>
  </div>
  <div class="section">
    <h2 class="section-title">3. Contact Us</h2>
    <p>Email: <span class="bold">amanikbt1@gmail.com</span></p>
  </div>
`,
);

// 3. Data Deletion Instructions
const dataDeletionBody = `
  <div class="section">
    <h2 class="section-title">1. Privacy-First Architecture</h2>
    <p>SocialSched operates client-side. We do not store your credentials on any external server.</p>
  </div>
  <div class="section">
    <h2 class="section-title">2. How to Delete Your Data</h2>
    <div class="card">
      <p class="bold">Option A: Clear App Storage</p>
      <p>Go to Settings in SocialSched app → Click "Wipe & Clear Storage".</p>
    </div>
    <div class="card">
      <p class="bold">Option B: Revoke Facebook App Access</p>
      <p>Go to Facebook Settings → Business Integrations → Remove SocialSched.</p>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">3. Support Contact</h2>
    <p>Email: <span class="bold">amanikbt1@gmail.com</span></p>
  </div>
`;

// 4. Data Detection Policy
const dataDetectionBody = `
  <div class="section">
    <h2 class="section-title">1. Real-Time Client-Side Detection</h2>
    <p>SocialSched uses real-time local algorithms to identify parameters and manage formatting for your social posts. No content data is transmitted to middle-man monitoring servers.</p>
  </div>
  <div class="section">
    <h2 class="section-title">2. Attributes Detected Locally</h2>
    <div class="card">
      <p class="bold">Connection Integrity (Token Status)</p>
      <p>Asynchronously detects if your Facebook page access tokens are active or expired using direct Meta Graph API queries when opening the settings dashboard.</p>
    </div>
    <div class="card">
      <p class="bold">Hashtag & Mention Scanning</p>
      <p>Parses caption text inside the editor to identify tags and mentions to support category presets.</p>
    </div>
    <div class="card">
      <p class="bold">Media Compatibility Scanning</p>
      <p>Scans the size, dimensions, and type of uploaded photos and videos to verify compatibility before publishing.</p>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">3. Contact Us</h2>
    <p>For questions regarding our local data detection processes, contact us at: <span class="bold">amanikbt1@gmail.com</span></p>
  </div>
`;

createStaticPage(
  "data-deletion",
  "User Data Deletion Instructions",
  "🗑️",
  dataDeletionBody,
);

// Create _redirects file for Render Static Sites
const redirectsFile = path.join(__dirname, "../dist/_redirects");
fs.writeFileSync(redirectsFile, "/* /index.html 200\n", "utf8");
console.log(
  "✅ Successfully wrote dist/_redirects for Render fallback routing",
);
