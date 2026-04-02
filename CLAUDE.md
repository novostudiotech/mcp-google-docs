# MCP Google Docs

MCP server on Hono + Cloudflare Workers. Accepts markdown, creates a Google Doc in the authorized user's Drive.

## Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **MCP:** @hono/mcp + @modelcontextprotocol/sdk (Streamable HTTP transport)
- **Google APIs:** Direct REST via fetch (NOT googleapis npm)
- **Markdown:** markdown-it
- **Validation:** Zod
- **Language:** TypeScript (strict mode)
- **Storage:** Cloudflare KV (two namespaces: TOKENS and CLIENTS)

## Commands

```bash
npm run dev         # wrangler dev — local development server on :8787
npm run deploy      # wrangler deploy — deploy to Cloudflare Workers
npm run typecheck   # tsc --noEmit — type-check without emitting
```

No test runner configured. Validate changes with `npm run typecheck`.

## Project Structure

```
src/
  index.ts              Entry point. Hono app with routes:
                          GET /           Landing page
                          GET /privacy    Privacy policy
                          GET /terms      Terms of service
                          ALL *           MCP OAuth auth router (catch-all)
                          GET /auth/callback  Google OAuth callback
                          ALL /mcp        MCP transport endpoint (bearer auth)
  types.ts              Shared types: Env, GoogleTokens, DriveFileResult, OAuthState
  tools/
    create-doc.ts       MCP tool registration (create_google_doc)
  lib/
    drive.ts            Google Drive API — multipart upload (metadata + HTML)
    markdown.ts         markdown-it renderer with custom HTML/CSS template
  oauth/
    provider.ts         GoogleOAuthProvider — implements OAuthServerProvider
                        Handles: authorize, exchangeAuthorizationCode,
                        exchangeRefreshToken, verifyAccessToken, revokeToken
    google.ts           Google OAuth helpers: auth URL, code exchange,
                        token refresh, userinfo
  pages/
    landing.ts          HTML landing page
    privacy.ts          Privacy policy page
    terms.ts            Terms of service page

wrangler.toml           Worker config (account, routes, KV bindings, vars)
wrangler.toml.example   Template for new contributors
.dev.vars               Local secrets (gitignored)
.dev.vars.example       Template for .dev.vars
.github/workflows/      CI/CD (deploy on push to main)
```

## Architecture

### OAuth Flow

The server implements MCP OAuth 2.1 that wraps Google OAuth:

1. MCP client connects to `/mcp` — gets 401 with `WWW-Authenticate` header
2. Client initiates OAuth via `/.well-known/oauth-authorization-server`
3. Server redirects to Google consent screen
4. Google redirects back to `/auth/callback` with authorization code
5. Server exchanges Google code for tokens, stores in KV
6. Server generates MCP authorization code, redirects back to MCP client
7. Client exchanges MCP code for MCP tokens (which wrap Google tokens)
8. Subsequent requests use bearer auth; tokens auto-refresh

### Document Creation

1. Client calls `create_google_doc` with title + markdown
2. `markdown-it` converts markdown to styled HTML
3. HTML is uploaded via Google Drive API multipart upload
4. Drive converts HTML to native Google Doc format
5. Returns document URL and ID

## Code Patterns

### No `any` types
TypeScript strict mode is enforced. Use proper types or `unknown` with type guards.

### Google API calls via fetch
All Google API interaction uses native `fetch()`. Never import the `googleapis` npm package.

### Secrets management
- Production secrets: `wrangler secret put <NAME>`
- Local secrets: `.dev.vars` file (gitignored)
- Public vars: `wrangler.toml` `[vars]` section

### KV namespaces
- **TOKENS** — OAuth state, Google tokens, MCP auth codes, refresh token mappings
- **CLIENTS** — MCP client registrations (dynamic client registration)

### Error handling
Google API errors are caught and re-thrown with status code and message. The MCP tool returns errors as text content (no exceptions to the client).

### HTML template
`lib/markdown.ts` wraps rendered markdown in a full HTML document with inline CSS. The styles are tuned for Google Docs import (font sizes, spacing, table borders).

## Environment Variables

### Public (wrangler.toml [vars])
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `APP_URL` — Public URL of the worker (e.g., `https://google-docs-mcp.novostudio.tech`)

### Secrets (.dev.vars / wrangler secret)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `MCP_SIGNING_KEY` — Key for signing MCP tokens (used by @hono/mcp)

### KV Bindings
- `TOKENS` — KV namespace for token storage
- `CLIENTS` — KV namespace for client registrations

## Boundaries

- This is a single-tool MCP server. Keep it focused.
- No database — KV only.
- No server-side rendering framework — plain HTML strings in `pages/`.
- No googleapis npm package — direct REST calls.
- No Express/Node.js APIs — Cloudflare Workers runtime only.
- The worker is stateless per request; all state lives in KV.
- JSX is configured (Hono JSX) but currently unused; pages use template strings.

## Deployment

- **CI/CD:** GitHub Actions workflow on push to `main` runs `wrangler deploy`
- **Manual:** `npm run deploy` from local machine
- **Domain:** `google-docs-mcp.novostudio.tech` (Cloudflare custom domain)
- **KV namespaces** must be created before first deploy (see wrangler.toml for IDs)

## Reference

- MCP spec: https://modelcontextprotocol.io
- @hono/mcp: https://github.com/honojs/middleware/tree/main/packages/mcp
- Google Drive API: https://developers.google.com/drive/api/v3/reference
- Plan: PLAN.md
