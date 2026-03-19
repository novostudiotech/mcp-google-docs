# MCP Google Docs

MCP-сервер на Hono + Cloudflare Workers. Принимает markdown, создаёт Google Doc в Drive авторизованного юзера.

## Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **MCP:** @hono/mcp + @modelcontextprotocol/sdk
- **Google APIs:** Direct REST via fetch (НЕ googleapis npm)
- **Markdown:** markdown-it
- **Language:** TypeScript (strict)

## Commands

- `npm run dev` — wrangler dev (local)
- `npm run deploy` — wrangler deploy
- `npm run typecheck` — tsc --noEmit

## Conventions

- No `any` types
- Google API calls via fetch, not googleapis package
- Secrets via wrangler secret, not .env files
- KV for token storage

## Reference

- План: PLAN.md
- Референсный sync-docs: ../claude/.github/scripts/sync-docs.mjs
