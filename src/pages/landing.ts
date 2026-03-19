import { html } from 'hono/html';

export function landingPage() {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCP Google Docs — Markdown to Google Docs</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.6; }
    .container { max-width: 720px; margin: 0 auto; padding: 60px 24px; }
    h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 12px; }
    .subtitle { font-size: 1.2rem; color: #555; margin-bottom: 48px; }
    .steps { margin-bottom: 48px; }
    .step { display: flex; gap: 16px; margin-bottom: 24px; }
    .step-num { width: 36px; height: 36px; background: #2563eb; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
    .step-text h3 { font-size: 1.1rem; margin-bottom: 4px; }
    .step-text p { color: #555; font-size: 0.95rem; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 0.9rem; margin-bottom: 48px; }
    code { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; }
    footer { border-top: 1px solid #e5e5e5; padding-top: 24px; font-size: 0.85rem; color: #888; }
    footer a { color: #2563eb; text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Markdown → Google Docs</h1>
    <p class="subtitle">Turn markdown into beautifully formatted Google Docs, right from Claude or Cursor.</p>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text"><h3>Connect</h3><p>Add the MCP server to your AI tool.</p></div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text"><h3>Authorize</h3><p>Sign in with Google to grant access to your Drive.</p></div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text"><h3>Create</h3><p>Use the <code>create_google_doc</code> tool to convert markdown into a Google Doc.</p></div></div>
    </div>
    <pre><code>claude mcp add google-docs https://google-docs-mcp.novostudio.tech/mcp</code></pre>
    <footer>
      <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>
    </footer>
  </div>
</body>
</html>`;
}
