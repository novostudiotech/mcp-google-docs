# Task: Build MCP Server for Markdown → Google Docs

Реализуй MCP-сервер по плану в `PLAN.md`. Hono app на Cloudflare Workers.

## Стратегия: максимум параллельности через субагентов

**Используй Agent tool агрессивно.** Файлы в этом проекте независимы — пиши их параллельно через субагентов.

Пример параллельных батчей:

**Batch 1** (независимые модули — запускай 3 агента параллельно):
- Agent 1: `src/types.ts` + `src/lib/markdown.ts`
- Agent 2: `src/lib/drive.ts` + `src/oauth/google.ts`
- Agent 3: `src/pages/landing.ts` + `src/pages/privacy.ts` + `src/pages/terms.ts`

**Batch 2** (зависит от Batch 1):
- Agent 4: `src/oauth/provider.ts` (зависит от types + google.ts)
- Agent 5: `src/tools/create-doc.ts` (зависит от types + markdown + drive)

**Batch 3** (финальная сборка):
- `src/index.ts` — связать всё

Перед каждым батчем проверяй что предыдущий завершился без ошибок.

## Референсный код

Рабочая конвертация в `../claude/.github/scripts/sync-docs.mjs`:
- `markdownToHtml()` (строки 35-63) — CSS стили, markdown-it
- Multipart upload (строки 129-142) — Drive API HTML → Google Doc
- OAuth scopes из `../claude/.github/scripts/get-refresh-token.mjs`

## Правила

1. **PLAN.md** — единственный источник правды, следуй шагам
2. **Google APIs только через `fetch`** — `googleapis` npm не работает на CF Workers
3. **TypeScript strict** — никаких `any`
4. **`@hono/mcp` API** — ПЕРЕД реализацией OAuth provider обязательно проверь реальный интерфейс через context7 MCP (`resolve-library-id` для `@hono/mcp` → `query-docs`). НЕ УГАДЫВАЙ.
5. **Inline HTML** — `import { html } from 'hono/html'`, без фреймворков
6. **Error handling** — Google API 401/403/400 → понятные ошибки
7. **Не трогай wrangler.toml** — KV IDs и GOOGLE_CLIENT_ID заполнены человеком
8. **`@cloudflare/workers-types`** — уже в devDeps, не забудь `"types": ["@cloudflare/workers-types"]` в tsconfig

## Порядок работы

1. Scaffold: package.json (с `npm i`), tsconfig.json, .dev.vars.example
2. **Batch 1 (параллельно):** types.ts, markdown.ts, drive.ts, google.ts, pages/*
3. **Batch 2 (параллельно):** provider.ts, create-doc.ts
4. **Batch 3:** index.ts — всё связать
5. `npm run typecheck` — исправить ошибки
6. `npm run dev` — проверить запуск

## Критерий завершения

Когда `npm run typecheck` проходит без ошибок, `wrangler dev` запускается, и `curl localhost:8787/` возвращает HTML — выведи:

<promise>MCP SERVER BUILT</promise>
