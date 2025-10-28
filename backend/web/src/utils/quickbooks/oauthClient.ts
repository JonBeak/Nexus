/**
 * QuickBooks OAuth2 Client
 * Handles authorization URL generation, token exchange, and token refresh
 */

import axios from 'axios';
import { storeTokens, getRefreshTokenDetails } from './dbManager';

// =============================================
// CONFIGURATION
// =============================================

const QB_CLIENT_ID = process.env.QB_CLIENT_ID;
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET;
const QB_REDIRECT_URI = process.env.QB_REDIRECT_URI;
const QB_ENVIRONMENT = process.env.QB_ENVIRONMENT || 'sandbox';

// OAuth endpoints (same for sandbox and production)
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

const QB_SCOPES = [
  'com.intuit.quickbooks.accounting',
  'openid',
  'profile',
  'email',
  'phone',
  'address',
].join(' ');

// =============================================
// ERROR HANDLING
// =============================================

export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthError';
  }
}

// =============================================
// OAUTH FLOW FUNCTIONS
// =============================================

/**
 * Generate QuickBooks authorization URL
 * @returns Authorization URL and state parameter
 */
export function getAuthorizationUrl(): { authUrl: string; state: string } {
  if (!QB_CLIENT_ID) {
    throw new OAuthError('QB_CLIENT_ID not configured');
  }
  if (!QB_REDIRECT_URI) {
    throw new OAuthError('QB_REDIRECT_URI not configured');
  }

  // Generate random state for CSRF protection
  const state = generateRandomState();

  const params = new URLSearchParams({
    client_id: QB_CLIENT_ID,
    redirect_uri: QB_REDIRECT_URI,
    response_type: 'code',
    scope: QB_SCOPES,
    state: state,
  });

  const authUrl = `${QB_AUTH_URL}?${params.toString()}`;

  console.log(`📋 Generated Authorization URL for ${QB_ENVIRONMENT} environment`);
  return { authUrl, state };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  authorizationCode: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
  id_token?: string;
}> {
  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
    throw new OAuthError('QB_CLIENT_ID or QB_CLIENT_SECRET not configured');
  }

  if (!authorizationCode) {
    throw new OAuthError('Authorization code is missing');
  }

  console.log('🔐 Exchanging authorization code for tokens...');

  try {
    const response = await axios.post(
      QB_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: QB_REDIRECT_URI!,
      }),
      {
        auth: {
          username: QB_CLIENT_ID,
          password: QB_CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      }
    );

    console.log('✅ Tokens fetched successfully via authorization code');
    return response.data as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      x_refresh_token_expires_in: number;
      token_type: string;
      id_token?: string;
    };
  } catch (error: any) {
    const errorMsg = error.response?.data?.error_description || error.message;
    console.error('❌ Error fetching tokens:', errorMsg);
    throw new OAuthError(`Failed to fetch tokens: ${errorMsg}`);
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(realmId: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
}> {
  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
    throw new OAuthError('QB_CLIENT_ID or QB_CLIENT_SECRET not configured');
  }

  console.log(`🔄 Refreshing access token for Realm ID: ${realmId}...`);

  // Get refresh token from database
  const tokenDetails = await getRefreshTokenDetails(realmId);
  if (!tokenDetails || !tokenDetails.refresh_token) {
    throw new OAuthError(`No valid refresh token found for realm ${realmId}`);
  }

  try {
    const response = await axios.post(
      QB_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenDetails.refresh_token,
      }),
      {
        auth: {
          username: QB_CLIENT_ID,
          password: QB_CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      }
    );

    console.log('✅ Access token refreshed successfully');

    const tokenData = response.data as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      x_refresh_token_expires_in: number;
      token_type: string;
    };

    // Store the new tokens
    await storeTokens(realmId, tokenData);

    return tokenData;
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    const errorMsg = errorData?.error_description || errorData?.error || error.message;

    console.error(`❌ Token refresh failed (${status}): ${errorMsg}`);

    if (status === 400 || status === 401) {
      console.error(`⚠️  Refresh token for Realm ID ${realmId} might be invalid or expired`);
    }

    throw new OAuthError(`Failed to refresh token (${status}): ${errorMsg}`);
  }
}

/**
 * Revoke QuickBooks access (disconnect)
 */
export async function revokeToken(token: string): Promise<void> {
  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
    throw new OAuthError('QB_CLIENT_ID or QB_CLIENT_SECRET not configured');
  }

  const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

  try {
    await axios.post(
      REVOKE_URL,
      new URLSearchParams({ token }),
      {
        auth: {
          username: QB_CLIENT_ID,
          password: QB_CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      }
    );

    console.log('✅ Token revoked successfully');
  } catch (error: any) {
    const errorMsg = error.response?.data?.error_description || error.message;
    console.error('❌ Error revoking token:', errorMsg);
    throw new OAuthError(`Failed to revoke token: ${errorMsg}`);
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Generate random state for CSRF protection
 */
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Validate QuickBooks configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!QB_CLIENT_ID) errors.push('QB_CLIENT_ID not set');
  if (!QB_CLIENT_SECRET) errors.push('QB_CLIENT_SECRET not set');
  if (!QB_REDIRECT_URI) errors.push('QB_REDIRECT_URI not set');

  return {
    valid: errors.length === 0,
    errors,
  };
}
