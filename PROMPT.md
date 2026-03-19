# Task: Build MCP Server for Markdown → Google Docs

Реализуй MCP-сервер по плану в `PLAN.md`. Hono app на Cloudflare Workers: MCP-тул `create_google_doc`, Google OAuth, лендинг.

## Референсный код

Рабочая конвертация markdown → Google Doc в `../claude/.github/scripts/sync-docs.mjs`:
- `markdownToHtml()` (строки 35-63) — CSS стили, markdown-it, page break handling
- Multipart upload (строки 129-142) — Drive API HTML → Google Doc conversion
- OAuth scopes из `../claude/.github/scripts/get-refresh-token.mjs`

## Правила

1. **Читай PLAN.md** — следуй шагам 1-11 последовательно
2. **Google APIs только через `fetch`** — `googleapis` npm не работает на CF Workers
3. **TypeScript strict** — никаких `any`, все типы в `src/types.ts`
4. **Реальные пакеты** — перед использованием API пакета сверяйся с его документацией через context7 MCP или веб-поиск. НЕ ВЫДУМЫВАЙ API. Если не уверен в интерфейсе — поищи.
5. **Inline HTML** — страницы через `hono/html` tagged template, без фронтенд-фреймворков
6. **Error handling** — Google API может вернуть 401/403/400, обрабатывай и возвращай понятные ошибки

## Критические детали (из reverse thinking анализа)

- `access_type=offline` + `prompt=consent` в Google auth URL — иначе не будет refresh_token
- Token auto-refresh: access_token живёт 1 час, проверяй expires_at перед каждым вызовом
- Два KV namespace: `TOKENS` (Google refresh tokens) и `CLIENTS` (MCP dynamic clients)
- Privacy policy и Terms of Service — обязательны для Google OAuth consent screen
- `.dev.vars.example` — шаблон для локальных секретов

## Порядок работы

1. Scaffold: package.json, tsconfig.json, wrangler.toml, .dev.vars.example
2. `src/types.ts` — Env bindings, GoogleTokens, DriveFileResult
3. `src/lib/markdown.ts` — конвертер из sync-docs.mjs (TS + ESM)
4. `src/lib/drive.ts` — Google Drive API через fetch с error handling
5. `src/oauth/google.ts` — Google OAuth хелперы (auth URL, exchange, refresh, userinfo)
6. `src/oauth/provider.ts` — OAuthServerProvider/ProxyOAuthServerProvider для @hono/mcp
7. `src/tools/create-doc.ts` — MCP tool definition
8. `src/pages/landing.ts` — лендинг через hono/html
9. `src/pages/privacy.ts` — privacy policy
10. `src/pages/terms.ts` — terms of service
11. `src/index.ts` — Hono app, всё связать: pages + OAuth + MCP
12. Проверить `npm run dev` + `npm run typecheck`

## Критерий завершения

Когда `wrangler dev` запускается без ошибок, `npm run typecheck` проходит, и `curl localhost:8787/` возвращает HTML лендинг — выведи:

<promise>MCP SERVER BUILT</promise>
