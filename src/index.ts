import { Hono } from 'hono';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpAuthRouter, bearerAuth, StreamableHTTPTransport } from '@hono/mcp';
import type { Env, OAuthState, GoogleTokens } from './types.js';
import { GoogleOAuthProvider } from './oauth/provider.js';
import { exchangeGoogleCode, getGoogleUserInfo } from './oauth/google.js';
import { registerTools } from './tools/create-doc.js';
import { landingPage } from './pages/landing.js';
import { privacyPage } from './pages/privacy.js';
import { termsPage } from './pages/terms.js';

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

// --- Static pages ---
app.get('/', (c) => c.html(landingPage()));
app.get('/privacy', (c) => c.html(privacyPage()));
app.get('/terms', (c) => c.html(termsPage()));

// --- OAuth auth router (mounted at root) ---
app.all('*', async (c, next) => {
  const provider = new GoogleOAuthProvider(c.env);
  const authRouter = mcpAuthRouter({
    provider,
    issuerUrl: new URL(c.env.APP_URL),
    clientRegistrationOptions: {
      clientIdGeneration: true,
    },
  });

  // Try auth router first
  const authApp = new Hono<HonoEnv>();
  authApp.route('/', authRouter);
  const res = await authApp.fetch(c.req.raw, c.env);
  if (res.status !== 404) {
    return res;
  }
  await next();
});

// --- Google OAuth callback ---
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code');
  const stateKey = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.text(`Google OAuth error: ${error}`, 400);
  }
  if (!code || !stateKey) {
    return c.text('Missing code or state', 400);
  }

  // Look up saved OAuth state
  const stateData = await c.env.TOKENS.get(`state:${stateKey}`, 'json') as OAuthState | null;
  if (!stateData) {
    return c.text('Invalid or expired OAuth state', 400);
  }
  await c.env.TOKENS.delete(`state:${stateKey}`);

  // Exchange Google code for tokens
  const redirectUri = `${c.env.APP_URL}/auth/callback`;
  const googleTokens = await exchangeGoogleCode(
    code,
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  // Get Google user info
  const userInfo = await getGoogleUserInfo(googleTokens.access_token);

  // Store Google tokens keyed by Google user sub
  await c.env.TOKENS.put(`google:${userInfo.sub}`, JSON.stringify(googleTokens));

  // Generate MCP auth code
  const mcpCode = crypto.randomUUID();
  await c.env.TOKENS.put(
    `code:${mcpCode}`,
    JSON.stringify({ googleSub: userInfo.sub }),
    { expirationTtl: 300 } // 5 min
  );

  // Redirect back to MCP client
  const redirectUrl = new URL(stateData.mcpRedirectUri);
  redirectUrl.searchParams.set('code', mcpCode);
  if (stateData.mcpState) {
    redirectUrl.searchParams.set('state', stateData.mcpState);
  }
  return c.redirect(redirectUrl.toString());
});

// --- MCP endpoint ---
app.all('/mcp', async (c) => {
  // Handle OPTIONS for CORS
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const provider = new GoogleOAuthProvider(c.env);

  // Verify bearer token
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }
  const token = authHeader.slice(7);

  let authInfo;
  try {
    authInfo = await provider.verifyAccessToken(token);
  } catch {
    return c.json({ error: 'Invalid or expired access token' }, 401);
  }

  const googleAccessToken = (authInfo.extra?.googleAccessToken as string) ?? token;

  // Create MCP server for this request
  const server = new McpServer(
    { name: 'google-docs', version: '1.0.0' },
    { capabilities: {} }
  );
  registerTools(server, googleAccessToken);

  const transport = new StreamableHTTPTransport({
    sessionIdGenerator: undefined, // stateless
  });

  await server.connect(transport);
  const response = await transport.handleRequest(c);
  await server.close();
  return response;
});

export default app;
