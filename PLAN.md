# MCP Server: Markdown → Google Docs (Mini SaaS)

## Context

Сейчас в `novostudio/claude` есть рабочий скрипт `sync-docs.mjs`, который конвертит markdown → HTML → Google Doc через GitHub Actions. Масштабируем это в публичный MCP-сервер — мини SaaS, где любой пользователь подключает MCP к Claude/Cursor, авторизуется через Google, и через тул `create_google_doc` превращает markdown в Google Doc в своём Drive.

## Архитектура

```
Браузер → GET / → Landing page (inline HTML from Hono)
                   "Connect to Claude" button
                   /privacy, /terms pages

Claude/Cursor ←→ MCP (Streamable HTTP, POST /mcp) ←→ Hono on CF Workers
                                                          ↓
                                                   MCP OAuth 2.1
                                                   (/.well-known/oauth-authorization-server)
                                                   (/authorize → Google consent)
                                                   (/token → exchange + store)
                                                   (/register → dynamic client reg)
                                                          ↓
                                                   Google Drive API (fetch)
                                                          ↓
                                                   User's Google Doc created
```

## Ключевые решения

### 1. Hono + `@hono/mcp` (без Mastra)

- Пакет `@hono/mcp` — тонкая обёртка над `@modelcontextprotocol/sdk`
- Нативный Streamable HTTP transport
- Встроенный OAuth 2.1 роутер с `ProxyOAuthServerProvider` для проксирования Google OAuth
- Работает на CF Workers из коробки

### 2. Google APIs через `fetch` (без `googleapis`)

`googleapis` npm не работает на CF Workers (зависит от Node.js `crypto`). Прямые REST-вызовы:
- `POST https://oauth2.googleapis.com/token` — token exchange + refresh
- `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` — создание документа

### 3. Скоуп `drive.file` (non-sensitive)

Даёт доступ только к файлам, созданным приложением. Non-sensitive = brand verification за 2-3 дня.

### 4. MCP OAuth 2.1 проксирует Google OAuth

MCP-сервер — OAuth proxy. `@hono/mcp` предоставляет `ProxyOAuthServerProvider` и `mcpAuthRouter` которые:
- Маунтят `/.well-known/oauth-authorization-server` (RFC8414 metadata)
- Маунтят `/register` (RFC7591 dynamic client registration)
- Маунтят `/authorize` → редиректит на Google consent (с `access_type=offline` для refresh_token)
- Маунтят `/token` → обменивает Google code → tokens, сохраняет refresh_token в KV, выдаёт MCP access token
- `bearerAuth` middleware валидирует MCP Bearer token на `/mcp` endpoint

**PKCE** обрабатывается `@hono/mcp` автоматически (MCP OAuth 2.1 spec requirement).

### 5. Inline HTML pages (без фронтенд-фреймворка)

Hono `html` helper (tagged template) — встроенный в Hono, zero dependencies. Страницы:
- `GET /` — лендинг: что это, как подключить, кнопка
- `GET /privacy` — privacy policy (нужна для Google OAuth consent)
- `GET /terms` — terms of service (нужна для Google OAuth consent)

## Решения

- **Репо:** `novostudio/mcp-google-docs`
- **GCP проект:** `novo-studio-490613`
- **MVP scope:** `create_google_doc` + landing + privacy/terms
- **KV namespaces:** `TOKENS` (Google refresh tokens), `CLIENTS` (MCP dynamic client registrations)

## Структура проекта

```
mcp-google-docs/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── .dev.vars.example           # Template: GOOGLE_CLIENT_SECRET=, MCP_SIGNING_KEY=
├── src/
│   ├── index.ts                # Hono app: routes + MCP + OAuth
│   ├── oauth/
│   │   ├── provider.ts         # ProxyOAuthServerProvider → Google
│   │   └── google.ts           # Google OAuth helpers (auth URL, token exchange, refresh)
│   ├── tools/
│   │   └── create-doc.ts       # MCP tool: markdown → Google Doc
│   ├── lib/
│   │   ├── markdown.ts         # markdown-it: MD → styled HTML
│   │   └── drive.ts            # Google Drive API via fetch (with auto-refresh)
│   ├── pages/
│   │   ├── landing.ts          # GET / — landing page
│   │   ├── privacy.ts          # GET /privacy
│   │   └── terms.ts            # GET /terms
│   └── types.ts                # Env bindings, shared types
```

## Детальный план реализации

### Шаг 1: Scaffold проекта

```bash
npm init -y
npm i hono @hono/mcp @modelcontextprotocol/sdk markdown-it
npm i -D wrangler typescript @types/markdown-it
```

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

**`wrangler.toml`:**
```toml
name = "mcp-google-docs"
main = "src/index.ts"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

[vars]
GOOGLE_CLIENT_ID = ""
APP_URL = "http://localhost:8787"

[[kv_namespaces]]
binding = "TOKENS"
id = ""
preview_id = ""

[[kv_namespaces]]
binding = "CLIENTS"
id = ""
preview_id = ""
```

**`.dev.vars.example`:**
```
GOOGLE_CLIENT_SECRET=
MCP_SIGNING_KEY=
```

**`package.json` scripts:**
```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  }
}
```

### Шаг 2: Types

**`src/types.ts`:**
```ts
export interface Env {
  TOKENS: KVNamespace;
  CLIENTS: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  MCP_SIGNING_KEY: string;
  APP_URL: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // timestamp ms
}

export interface DriveFileResult {
  docId: string;
  url: string;
  title: string;
}
```

### Шаг 3: Google OAuth helpers

**`src/oauth/google.ts`:**
- `getGoogleAuthUrl(clientId, redirectUri, state)` — builds Google consent URL with:
  - `scope=https://www.googleapis.com/auth/drive.file`
  - `access_type=offline` (CRITICAL — нужен для refresh_token)
  - `prompt=consent` (force consent to always get refresh_token)
  - `state` param для MCP flow
- `exchangeGoogleCode(code, clientId, clientSecret, redirectUri)` → `GoogleTokens`
  - POST to `https://oauth2.googleapis.com/token` with `grant_type=authorization_code`
  - Вычисляет `expires_at = Date.now() + expires_in * 1000`
- `refreshGoogleAccessToken(refreshToken, clientId, clientSecret)` → `{ access_token, expires_at }`
  - POST to `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`
- `getGoogleUserInfo(accessToken)` → `{ email, sub }` для идентификации юзера
  - GET `https://www.googleapis.com/oauth2/v3/userinfo`

### Шаг 4: OAuth Provider для MCP

**`src/oauth/provider.ts`:**
Реализация `OAuthServerProvider` из `@hono/mcp`. ВАЖНО: перед реализацией прочитать реальный интерфейс через context7 или исходники `@hono/mcp`.

Ключевые моменты:
- При `authorize()` → redirect на Google consent URL (через `getGoogleAuthUrl`)
- Google callback приходит на `/auth/callback` → `exchangeGoogleCode()` → сохранить `GoogleTokens` в KV `TOKENS` под ключом `google:{userId}` → выдать MCP authorization code
- При `token()` → обменять MCP auth code на MCP access token
- При `authenticate()` → извлечь userId из MCP token → достать GoogleTokens из KV → если `expires_at < Date.now()` → auto-refresh → обновить KV → вернуть актуальный access_token

Dynamic client registration data → в KV `CLIENTS`.

### Шаг 5: Markdown → HTML конвертер

**`src/lib/markdown.ts`** — адаптация из `../claude/.github/scripts/sync-docs.mjs:35-63`:
```ts
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true });
const PAGE_BREAK_MARKER = '%%%PAGE_BREAK%%%';

export function markdownToHtml(markdown: string): string {
  const cleaned = markdown
    .replace(/<p style="page-break-before: always">&nbsp;<\/p>/g, PAGE_BREAK_MARKER)
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
  const body = md.render(cleaned);
  return `<!DOCTYPE html>
<html><head><style>
  body { font-family: 'Inter', 'Arial', sans-serif; font-size: 11pt; color: #222; line-height: 1.3; }
  h1 { font-size: 18pt; margin: 18px 0 2px 0; }
  h2 { font-size: 15pt; margin: 16px 0 2px 0; }
  h3 { font-size: 13pt; margin: 12px 0 2px 0; }
  h4 { font-size: 11pt; margin: 8px 0 2px 0; }
  p, ul, ol { margin: 2px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th, td { border: 1px solid #ddd; padding: 3px 8px; }
  th { background: #f2f2f2; font-weight: bold; }
  blockquote { border-left: 3px solid #ccc; padding-left: 12px; color: #555; }
</style></head>
<body>${body}</body></html>`;
}
```

### Шаг 6: Google Drive API via fetch

**`src/lib/drive.ts`:**
- `createGoogleDoc(title, html, accessToken, folderId?)` → `DriveFileResult`
  - Multipart upload: metadata (JSON) + content (HTML) с `mimeType: 'application/vnd.google-apps.document'`
  - **Error handling:** проверять `res.ok`, парсить ошибку, бросать понятный Error
  - Возвращать `{ docId, url, title }`

### Шаг 7: MCP Tool

**`src/tools/create-doc.ts`:**
- Input: `{ title: string, markdown: string, folderId?: string }`
- Логика:
  1. Получить Google access_token из контекста (OAuth provider уже проверил/обновил)
  2. `markdownToHtml(markdown)`
  3. `createGoogleDoc(title, html, accessToken, folderId)`
  4. Вернуть MCP text content: `Created "${title}" → ${url}`

### Шаг 8: Landing page + legal pages

**`src/pages/landing.ts`** — используя `hono/html` (tagged template literal):
- Минималистичный дизайн, system fonts, inline CSS
- Hero: "Markdown → Google Docs" + описание
- How it works: 3 шага (Connect MCP → Authorize Google → Create docs)
- Connect button: `claude mcp add google-docs --transport http https://...`
- Footer: links to /privacy, /terms

**`src/pages/privacy.ts`** — стандартная privacy policy:
- Какие данные собираем (Google email, OAuth tokens)
- Как храним (Cloudflare KV, encrypted)
- Не продаём данные
- Как удалить аккаунт (revoke in Google account settings)

**`src/pages/terms.ts`** — terms of service:
- Сервис as-is
- Лимиты использования
- Запрет abuse

### Шаг 9: Main Hono App

**`src/index.ts`:**
```ts
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// Pages
app.get('/', landingPage);
app.get('/privacy', privacyPage);
app.get('/terms', termsPage);

// MCP OAuth (/.well-known/*, /authorize, /token, /register)
// Use mcpAuthRouter or manual routes based on actual @hono/mcp API

// MCP endpoint
app.all('/mcp', mcpHandler);

export default app;
```

### Шаг 10: Local dev setup

1. `wrangler kv namespace create TOKENS` → get ID
2. `wrangler kv namespace create TOKENS --preview` → get preview ID
3. `wrangler kv namespace create CLIENTS` → get ID
4. `wrangler kv namespace create CLIENTS --preview` → get preview ID
5. Update `wrangler.toml` with IDs
6. Copy `.dev.vars.example` → `.dev.vars`, fill in secrets
7. Google Cloud Console: создать OAuth credentials с redirect URI `http://localhost:8787/auth/callback`
8. `npm run dev` → `curl localhost:8787/` → landing HTML

### Шаг 11: Deploy

```bash
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put MCP_SIGNING_KEY
wrangler deploy
```

Update Google OAuth redirect URI to production: `https://mcp-google-docs.<account>.workers.dev/auth/callback`
Update `APP_URL` var in wrangler.toml.

## Референсный код

| Компонент | Файл-источник | Что берём |
|-----------|---------------|-----------|
| `markdownToHtml()` | `../claude/.github/scripts/sync-docs.mjs:35-63` | CSS стили, markdown-it конфиг, page break handling |
| Multipart upload | `../claude/.github/scripts/sync-docs.mjs:129-142` | Drive API create с HTML → Doc conversion |
| OAuth scopes | `../claude/.github/scripts/get-refresh-token.mjs` | `drive.file` scope, token exchange pattern |

## Критические детали (не забыть!)

1. **`access_type=offline`** в Google auth URL — без этого не будет refresh_token
2. **`prompt=consent`** — force consent чтобы Google всегда отдавал refresh_token (иначе только при первом consent)
3. **Token auto-refresh** — Google access_token живёт 1 час. Перед каждым API-вызовом проверять `expires_at`, если истёк — refresh
4. **Error handling в drive.ts** — Google API может вернуть 403 (quota), 401 (bad token), 400 (bad request). Парсить и возвращать понятные ошибки в MCP response
5. **KV TTL** — refresh_token не имеет TTL (живёт пока юзер не revoke). Но можно ставить TTL 90 дней и обновлять при каждом использовании
6. **CORS** — не нужен для MCP (server-to-server), но нужен если landing делает fetch

## Лимиты и квоты

| Операция | На проект/мин | На юзера/мин |
|----------|--------------|-------------|
| Drive write | 600 | 60 |
| Drive read | 3,000 | 300 |
| Макс HTML upload | 5 MB | — |
| CF Workers free | 100K req/day | — |
| CF KV free | 100K reads/day, 1K writes/day | — |

## Верификация

1. `npm run dev` → `curl http://localhost:8787/` → HTML landing page
2. `curl http://localhost:8787/privacy` → privacy policy page
3. `curl http://localhost:8787/terms` → terms page
4. `curl http://localhost:8787/.well-known/oauth-authorization-server` → OAuth metadata JSON
5. `claude mcp add --transport http http://localhost:8787/mcp` → подключить
6. В Claude: "создай Google Doc с заголовком Test и текстом # Hello World" → должен создаться док
7. Повторный вызов без повторной авторизации → работает (refresh token в KV)
8. `npm run typecheck` → no errors
