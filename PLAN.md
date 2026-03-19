# MCP Server: Markdown → Google Docs (Mini SaaS)

## Context

Масштабируем рабочий скрипт `sync-docs.mjs` (из `novostudio/claude`) в публичный MCP-сервер. Любой юзер подключает MCP к Claude/Cursor, авторизуется через Google, и через тул `create_google_doc` превращает markdown в Google Doc в своём Drive.

## Prerequisites (выполняет человек ДО запуска)

Эти шаги НЕ автоматизируемы — требуют браузер/интерактивный логин:

1. **GitHub repo** — https://github.com/novostudiotech/mcp-google-docs
2. **`wrangler login`** — убедиться что CLI залогинен (`wrangler whoami`)
3. **KV namespaces:**
   ```bash
   wrangler kv namespace create TOKENS
   wrangler kv namespace create TOKENS --preview
   wrangler kv namespace create CLIENTS
   wrangler kv namespace create CLIENTS --preview
   ```
   → Вписать IDs в `wrangler.toml`
4. **Google OAuth credentials** — GCP проект `novo-studio-490613`:
   - Credentials из `../claude/.env` (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
   - **Добавить redirect URI** в GCP Console → Credentials → OAuth 2.0 Client:
     - `http://localhost:8787/auth/callback` (dev)
     - `https://mcp-google-docs.<account>.workers.dev/auth/callback` (prod)
5. **`wrangler.toml`** — вписать `GOOGLE_CLIENT_ID` в `[vars]`
6. **`.dev.vars`** — создать из `.dev.vars.example`:
   ```
   GOOGLE_CLIENT_SECRET=<from ../claude/.env>
   MCP_SIGNING_KEY=<run: openssl rand -hex 32>
   ```

## Архитектура

```
Браузер → GET / → Landing page (inline HTML from Hono)
                   /privacy, /terms

Claude/Cursor ←→ MCP (Streamable HTTP, POST /mcp) ←→ Hono on CF Workers
                                                          ↓
                                                   MCP OAuth 2.1 (proxy → Google)
                                                          ↓
                                                   Google Drive API (fetch)
                                                          ↓
                                                   User's Google Doc
```

## Ключевые решения

### 1. Hono + `@hono/mcp`
- `@hono/mcp` — обёртка над `@modelcontextprotocol/sdk`
- Streamable HTTP transport + OAuth 2.1 router
- CF Workers из коробки

### 2. Google APIs через `fetch` (не `googleapis`)
`googleapis` не работает на CF Workers. Прямые REST-вызовы.

### 3. Скоуп `drive.file` (non-sensitive)
Доступ только к файлам приложения. Brand verification 2-3 дня, без security assessment.

### 4. MCP OAuth 2.1 проксирует Google OAuth
`@hono/mcp` → `ProxyOAuthServerProvider`:
- `/.well-known/oauth-authorization-server` (RFC8414)
- `/register` (RFC7591 dynamic client registration)
- `/authorize` → Google consent (`access_type=offline`, `prompt=consent`)
- `/token` → exchange + store refresh_token в KV
- `bearerAuth` на `/mcp`
- PKCE — автоматически

### 5. Inline HTML pages
`hono/html` tagged template — zero dependencies.

## Структура проекта

```
mcp-google-docs/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── .dev.vars.example
├── src/
│   ├── index.ts                # Hono app: pages + OAuth + MCP
│   ├── oauth/
│   │   ├── provider.ts         # ProxyOAuthServerProvider → Google
│   │   └── google.ts           # Google OAuth helpers
│   ├── tools/
│   │   └── create-doc.ts       # MCP tool: markdown → Google Doc
│   ├── lib/
│   │   ├── markdown.ts         # markdown-it: MD → styled HTML
│   │   └── drive.ts            # Google Drive API via fetch
│   ├── pages/
│   │   ├── landing.ts          # GET /
│   │   ├── privacy.ts          # GET /privacy
│   │   └── terms.ts            # GET /terms
│   └── types.ts                # Env bindings, shared types
```

## План реализации

### Шаг 1: Scaffold

```bash
npm init -y
npm i hono @hono/mcp @modelcontextprotocol/sdk markdown-it
npm i -D wrangler typescript @cloudflare/workers-types @types/markdown-it
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

**`wrangler.toml`** — KV IDs заполнены человеком из prerequisites:
```toml
name = "mcp-google-docs"
main = "src/index.ts"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

[vars]
GOOGLE_CLIENT_ID = "FILLED_BY_HUMAN"
APP_URL = "http://localhost:8787"

[[kv_namespaces]]
binding = "TOKENS"
id = "FILLED_BY_HUMAN"
preview_id = "FILLED_BY_HUMAN"

[[kv_namespaces]]
binding = "CLIENTS"
id = "FILLED_BY_HUMAN"
preview_id = "FILLED_BY_HUMAN"
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

### Шаг 2: Types (`src/types.ts`)

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

### Шаг 3: Markdown → HTML (`src/lib/markdown.ts`)

Адаптация из `../claude/.github/scripts/sync-docs.mjs:35-63`:
```ts
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true });

export function markdownToHtml(markdown: string): string {
  const cleaned = markdown
    .replace(/<p style="page-break-before: always">&nbsp;<\/p>/g, '%%%PAGE_BREAK%%%')
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

### Шаг 4: Google Drive API (`src/lib/drive.ts`)

- `createGoogleDoc(title, html, accessToken, folderId?)` → `DriveFileResult`
- Multipart upload через fetch (паттерн из sync-docs.mjs:129-142)
- **Error handling:** если `!res.ok` → парсить JSON ошибку → throw с понятным сообщением

### Шаг 5: Google OAuth helpers (`src/oauth/google.ts`)

- `getGoogleAuthUrl(clientId, redirectUri, state)` — consent URL с `access_type=offline`, `prompt=consent`, scope `drive.file`
- `exchangeGoogleCode(code, clientId, clientSecret, redirectUri)` → `GoogleTokens` (с `expires_at`)
- `refreshGoogleAccessToken(refreshToken, clientId, clientSecret)` → `{ access_token, expires_at }`
- `getGoogleUserInfo(accessToken)` → `{ email, sub }`

Все вызовы через `fetch` к `https://oauth2.googleapis.com/token` и `https://www.googleapis.com/oauth2/v3/userinfo`.

### Шаг 6: MCP OAuth Provider (`src/oauth/provider.ts`)

**ВАЖНО:** Перед реализацией ОБЯЗАТЕЛЬНО прочитать реальный интерфейс `@hono/mcp` через context7 MCP (`resolve-library-id` → `query-docs`). Не угадывать API!

Концепт:
- `authorize()` → redirect на Google consent
- Google callback → `exchangeGoogleCode()` → сохранить в KV `TOKENS:google:{sub}` → выдать MCP auth code
- `token()` → обменять MCP auth code → MCP access token (JWT)
- `authenticate()` → decode JWT → достать GoogleTokens из KV → auto-refresh если `expires_at < Date.now()`
- Dynamic clients → KV `CLIENTS`

### Шаг 7: MCP Tool (`src/tools/create-doc.ts`)

- Input: `{ title: string, markdown: string, folderId?: string }`
- Flow: get access_token → markdownToHtml → createGoogleDoc → return URL
- Error: если Google API fail → вернуть MCP error с понятным текстом

### Шаг 8: Pages (`src/pages/`)

**landing.ts** — `hono/html`:
- Hero: "Markdown → Google Docs via MCP"
- How it works: 3 шага
- Connect command: `claude mcp add ...`
- Links: /privacy, /terms

**privacy.ts** — privacy policy (нужна для Google OAuth consent screen):
- Данные: Google email, OAuth tokens
- Хранение: Cloudflare KV
- Удаление: revoke в Google Account

**terms.ts** — terms of service:
- As-is, лимиты, запрет abuse

### Шаг 9: Main App (`src/index.ts`)

Связать всё:
- `GET /` → landing, `GET /privacy` → privacy, `GET /terms` → terms
- MCP OAuth routes (из `@hono/mcp`)
- `POST|GET|DELETE /mcp` → MCP handler с `create_google_doc` tool

### Шаг 10: Typecheck + local test

```bash
npm run typecheck  # должен пройти без ошибок
npm run dev        # wrangler dev запускается
curl localhost:8787/  # landing HTML
```

## Референсный код

| Компонент | Файл | Строки |
|-----------|------|--------|
| markdownToHtml | `../claude/.github/scripts/sync-docs.mjs` | 35-63 |
| Multipart upload | `../claude/.github/scripts/sync-docs.mjs` | 129-142 |
| OAuth scopes | `../claude/.github/scripts/get-refresh-token.mjs` | scopes array |

## Критические детали

1. **`access_type=offline`** + **`prompt=consent`** в Google auth URL
2. **Token auto-refresh** — access_token живёт 1 час, проверять `expires_at` перед каждым вызовом
3. **`@cloudflare/workers-types`** — обязательно в devDeps (иначе TS не знает KVNamespace)
4. **Error handling** — Google API может вернуть 401/403/400
5. **KV IDs** — уже заполнены человеком, не трогать
6. **`hono/html`** — import: `import { html } from 'hono/html'`

## Лимиты

| Ресурс | Лимит |
|--------|-------|
| Drive writes | 600/мин на проект, 60/мин на юзера |
| HTML upload | 5 MB max |
| CF Workers free | 100K req/day |
| CF KV free | 100K reads/day, 1K writes/day |

## Верификация

1. `npm run typecheck` → no errors
2. `npm run dev` → starts without errors
3. `curl localhost:8787/` → HTML landing
4. `curl localhost:8787/privacy` → HTML privacy page
5. `curl localhost:8787/terms` → HTML terms page
6. `curl localhost:8787/.well-known/oauth-authorization-server` → JSON metadata
7. (Manual) `claude mcp add` → OAuth flow → create doc → verify in Drive
