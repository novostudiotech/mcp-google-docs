import { html } from 'hono/html';

export function termsPage() {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Terms of Service — MCP Google Docs</title>
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
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer { border-top: 1px solid #e5e5e5; margin-top: 48px; padding-top: 24px; font-size: 0.85rem; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Terms of Service</h1>
    <p class="updated">Last updated: March 2026</p>

    <h2>Service Description</h2>
    <p>MCP Google Docs is a tool that converts markdown content into Google Docs via the Model Context Protocol. The service is provided as-is, without warranties of any kind, express or implied.</p>

    <h2>Acceptable Use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Use the service for any unlawful purpose</li>
      <li>Attempt to overwhelm the service with excessive requests</li>
      <li>Reverse-engineer, exploit, or interfere with the service infrastructure</li>
      <li>Use automated systems to abuse the service beyond normal MCP tool usage</li>
    </ul>

    <h2>Rate Limits</h2>
    <p>The service enforces rate limits to ensure fair usage for all users. Excessive requests may be throttled or temporarily blocked. Current limits are subject to change without notice.</p>

    <h2>Termination</h2>
    <p>We reserve the right to suspend or terminate access to the service at any time, for any reason, including but not limited to violation of these terms or abuse of the service.</p>

    <h2>Limitation of Liability</h2>
    <p>To the fullest extent permitted by law, MCP Google Docs and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>

    <h2>Changes to Terms</h2>
    <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.</p>

    <footer>
      <a href="/">Home</a> · <a href="/privacy">Privacy Policy</a>
    </footer>
  </div>
</body>
</html>`;
}
