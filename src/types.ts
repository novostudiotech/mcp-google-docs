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

// Stored in KV for OAuth state tracking
export interface OAuthState {
  mcpRedirectUri: string;
  mcpState?: string;
  mcpCodeChallenge: string;
  clientId: string;
}
