# MCP Google Docs

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-7C3AED)](https://modelcontextprotocol.io/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

MCP server that converts markdown into Google Docs. One tool call -- markdown in, Google Doc out.

**Live:** https://google-docs-mcp.novostudio.tech

## Connect

```bash
claude mcp add --transport http google-docs https://google-docs-mcp.novostudio.tech/mcp
```

On first use, you'll be prompted to authorize with Google.

## Tool

### `create_google_doc`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | yes | Document title |
| `markdown` | string | yes | Markdown content |
| `folderId` | string | no | Google Drive folder ID |

Returns the document URL and ID.

## Architecture

```
Client (Claude, Cursor, etc.)
  |
  | MCP over Streamable HTTP
  v
Cloudflare Worker (Hono)
  |
  |-- /mcp          MCP transport endpoint (bearer auth)
  |-- /auth/*       MCP OAuth 2.1 flow (proxies Google OAuth)
  |-- /             Landing page
  |
  v
Google Drive API   (multipart upload, markdown -> HTML -> Google Doc)
Cloudflare KV      (OAuth tokens, client registrations)
```

**OAuth flow:** MCP OAuth 2.1 wraps Google OAuth. The worker acts as an OAuth server to MCP clients and as an OAuth client to Google. Tokens are stored in Cloudflare KV and automatically refreshed.

**Markdown conversion:** markdown-it parses markdown to HTML with custom styling (fonts, spacing, tables). Google Drive API imports the HTML as a native Google Doc via multipart upload.

## Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **MCP:** @hono/mcp + @modelcontextprotocol/sdk
- **Auth:** MCP OAuth 2.1 proxying Google OAuth
- **Storage:** Cloudflare KV (tokens, client registrations)
- **Markdown:** markdown-it
- **Google APIs:** Direct REST via fetch (no googleapis npm package)

## Development

```bash
npm install
npm run dev        # wrangler dev
npm run typecheck  # tsc --noEmit
```

Requires `.dev.vars` with secrets. See `.dev.vars.example`.

## Deploy

Push to `main` triggers CI/CD via GitHub Actions. Manual deploy:

```bash
npm run deploy
```

## License

[MIT](LICENSE)

---

Built by [Novo Studio](https://novostudio.tech)
