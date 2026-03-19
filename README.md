# MCP Google Docs

MCP server that converts markdown into Google Docs. One tool call — markdown in, Google Doc out.

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

## Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **MCP:** @hono/mcp + @modelcontextprotocol/sdk
- **Auth:** MCP OAuth 2.1 proxying Google OAuth
- **Storage:** Cloudflare KV (tokens, client registrations)
- **Google APIs:** Direct REST via fetch

## Development

```bash
npm install
npm run dev        # wrangler dev
npm run typecheck  # tsc --noEmit
```

Requires `.dev.vars` with `GOOGLE_CLIENT_SECRET` and `MCP_SIGNING_KEY`. See `.dev.vars.example`.

## Deploy

Push to `main` triggers CI/CD via GitHub Actions. Manual deploy:

```bash
npm run deploy
```
