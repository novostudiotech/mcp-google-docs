import { html } from 'hono/html';

export function privacyPage() {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy Policy — MCP Google Docs</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.7; }
    .container { max-width: 720px; margin: 0 auto; padding: 60px 24px; }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 8px; }
    .updated { font-size: 0.85rem; color: #888; margin-bottom: 40px; }
    h2 { font-size: 1.25rem; font-weight: 600; margin-top: 32px; margin-bottom: 12px; }
    p { margin-bottom: 16px; color: #333; }
    ul { margin-bottom: 16px; padding-left: 24px; color: #333; }
    li { margin-bottom: 8px; }
    code { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer { border-top: 1px solid #e5e5e5; margin-top: 48px; padding-top: 24px; font-size: 0.85rem; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: March 2026</p>

    <h2>What We Collect</h2>
    <p>When you authorize this service, we store the following information:</p>
    <ul>
      <li>Your Google email address (used to identify your account)</li>
      <li>OAuth access and refresh tokens (used to create documents on your behalf)</li>
    </ul>

    <h2>How Data Is Stored</h2>
    <p>Your OAuth tokens are stored in Cloudflare KV, a globally distributed key-value store. All data is encrypted at rest by Cloudflare's infrastructure. We do not store the content of documents you create — content is sent directly to the Google Docs API.</p>

    <h2>No Selling or Sharing</h2>
    <p>We do not sell, share, or transfer your personal data to any third parties. Your tokens are used solely to perform the actions you request through the MCP tools.</p>

    <h2>How to Delete Your Data</h2>
    <p>You can revoke access at any time by visiting your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Google Account permissions</a> and removing this application. Once revoked, your stored tokens become invalid and are automatically cleaned up.</p>

    <h2>Contact</h2>
    <p>If you have questions about this policy, reach out at <a href="https://novostudio.tech">novostudio.tech</a>.</p>

    <footer>
      <a href="/">Home</a> · <a href="/terms">Terms of Service</a>
    </footer>
  </div>
</body>
</html>`;
}
