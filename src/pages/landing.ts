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
    .copy-box { position: relative; background: #f5f5f5; border-radius: 8px; margin-bottom: 48px; cursor: pointer; transition: background 0.15s; }
    .copy-box:hover { background: #ebebeb; }
    .copy-box pre { padding: 16px 48px 16px 16px; margin: 0; overflow-x: auto; font-size: 0.9rem; background: none; }
    .copy-box .copy-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; color: #888; transition: color 0.15s; }
    .copy-box:hover .copy-icon { color: #555; }
    .copy-box.copied .copy-icon { color: #16a34a; }
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
    <div class="copy-box" onclick="copyCmd(this)">
      <pre><code>claude mcp add --transport http google-docs https://google-docs-mcp.novostudio.tech/mcp</code></pre>
      <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    </div>
    <script>
    function copyCmd(el) {
      navigator.clipboard.writeText(el.querySelector('code').textContent);
      el.classList.add('copied');
      var icon = el.querySelector('.copy-icon');
      icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
      setTimeout(function() {
        el.classList.remove('copied');
        icon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';
      }, 2000);
    }
    </script>
    <footer>
      <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>
    </footer>
  </div>
</body>
</html>`;
}
