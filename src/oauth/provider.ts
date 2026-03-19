import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Context } from 'hono';
import type { Env, GoogleTokens, OAuthState } from '../types.js';
import { getGoogleAuthUrl, refreshGoogleAccessToken } from './google.js';

export class GoogleOAuthProvider implements OAuthServerProvider {
  skipLocalPkceValidation = true;

  constructor(private env: Env) {}

  get clientsStore(): OAuthRegisteredClientsStore {
    const kv = this.env.CLIENTS;
    return {
      getClient: async (clientId: string) => {
        const data = await kv.get(clientId, 'json');
        return (data as OAuthClientInformationFull | null) ?? undefined;
      },
      registerClient: async (client: OAuthClientInformationFull) => {
        await kv.put(client.client_id, JSON.stringify(client));
        return client;
      },
    };
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    c: Context // NOTE: @hono/mcp passes Hono Context, not express Response
  ): Promise<void> {
    // Generate state for Google OAuth that links back to MCP OAuth flow
    const stateKey = crypto.randomUUID();

    const oauthState: OAuthState = {
      mcpRedirectUri: params.redirectUri,
      mcpState: params.state,
      mcpCodeChallenge: params.codeChallenge,
      clientId: client.client_id,
    };

    await this.env.TOKENS.put(`state:${stateKey}`, JSON.stringify(oauthState), {
      expirationTtl: 600, // 10 min
    });

    const redirectUri = `${this.env.APP_URL}/auth/callback`;
    const url = getGoogleAuthUrl(this.env.GOOGLE_CLIENT_ID, redirectUri, stateKey);
    c.res = c.redirect(url);
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    _authorizationCode: string
  ): Promise<string> {
    // We skip local PKCE validation (skipLocalPkceValidation = true)
    return '';
  }

  async exchangeAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    _resource?: URL
  ): Promise<OAuthTokens> {
    // authorizationCode is our MCP auth code — look up stored data
    const data = await this.env.TOKENS.get(`code:${authorizationCode}`, 'json');
    if (!data) {
      throw new Error('Invalid or expired authorization code');
    }

    const { googleSub } = data as { googleSub: string };
    await this.env.TOKENS.delete(`code:${authorizationCode}`);

    // Get stored Google tokens
    const googleTokens = (await this.env.TOKENS.get(`google:${googleSub}`, 'json')) as GoogleTokens | null;
    if (!googleTokens) {
      throw new Error('Google tokens not found — please re-authorize');
    }

    // Return MCP tokens — access_token is the Google access token,
    // refresh_token is a key to look up stored Google refresh token
    const mcpRefreshToken = `refresh:${googleSub}:${crypto.randomUUID()}`;
    await this.env.TOKENS.put(mcpRefreshToken, googleSub, { expirationTtl: 86400 * 30 }); // 30 days

    return {
      access_token: googleTokens.access_token,
      token_type: 'Bearer',
      expires_in: Math.max(0, Math.floor((googleTokens.expires_at - Date.now()) / 1000)),
      refresh_token: mcpRefreshToken,
    };
  }

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    refreshToken: string,
    _scopes?: string[],
    _resource?: URL
  ): Promise<OAuthTokens> {
    // Look up Google user sub from refresh token
    const googleSub = await this.env.TOKENS.get(refreshToken);
    if (!googleSub) {
      throw new Error('Invalid or expired refresh token');
    }

    // Get stored Google tokens
    const googleTokens = (await this.env.TOKENS.get(`google:${googleSub}`, 'json')) as GoogleTokens | null;
    if (!googleTokens) {
      throw new Error('Google tokens not found — please re-authorize');
    }

    // Refresh Google access token
    const refreshed = await refreshGoogleAccessToken(
      googleTokens.refresh_token,
      this.env.GOOGLE_CLIENT_ID,
      this.env.GOOGLE_CLIENT_SECRET
    );

    // Update stored tokens
    const updatedTokens: GoogleTokens = {
      ...googleTokens,
      access_token: refreshed.access_token,
      expires_at: refreshed.expires_at,
    };
    await this.env.TOKENS.put(`google:${googleSub}`, JSON.stringify(updatedTokens));

    return {
      access_token: refreshed.access_token,
      token_type: 'Bearer',
      expires_in: Math.floor((refreshed.expires_at - Date.now()) / 1000),
      refresh_token: refreshToken, // same refresh token
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    // Token is a Google access token — verify it and auto-refresh if needed
    // First try to find the user by checking if we have a mapping
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (userInfo.ok) {
      const info = (await userInfo.json()) as { sub: string; email: string };
      return {
        token,
        clientId: 'google',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
        extra: { googleAccessToken: token, googleSub: info.sub },
      };
    }

    // Token might be expired — try to find and refresh
    // This is a fallback; normally the MCP client should use refresh_token flow
    throw new Error('Invalid or expired access token');
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    // If it's a refresh token, delete it from KV
    if (request.token.startsWith('refresh:')) {
      await this.env.TOKENS.delete(request.token);
    }
    // For Google access tokens, revoke at Google
    else {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${request.token}`, {
        method: 'POST',
      });
    }
  }
}
