/**
 * QuickBooks OAuth Service
 * Handles OAuth flow orchestration for QuickBooks integration
 *
 * Extracted from quickbooksService.ts for single responsibility
 */

import { quickbooksRepository } from '../../repositories/quickbooksRepository';
import { quickbooksOAuthRepository } from '../../repositories/quickbooksOAuthRepository';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  OAuthError,
} from '../../utils/quickbooks/oauthClient';

/**
 * QuickBooks OAuth Service Class
 * Manages OAuth flow: authorization, callback processing, disconnection
 */
export class QBOAuthService {

  /**
   * Initiate OAuth flow
   * Generates authorization URL and stores CSRF state token
   */
  async initiateOAuth(): Promise<{ authUrl: string; state: string }> {
    const { authUrl, state } = await getAuthorizationUrl();

    // Store state token for CSRF validation (10 minutes)
    await quickbooksOAuthRepository.storeOAuthState(state, 600);

    console.log(`OAuth flow initiated with state: ${state.substring(0, 8)}...`);

    return { authUrl, state };
  }

  /**
   * Process OAuth callback
   * Validates CSRF token, exchanges code for tokens, stores tokens
   */
  async processCallback(
    code: string,
    realmId: string,
    state: string
  ): Promise<void> {
    // CSRF Protection: Validate state token
    const isValidState = await quickbooksOAuthRepository.validateAndConsumeOAuthState(state);
    if (!isValidState) {
      throw new OAuthError('Invalid or expired state token (possible CSRF attack)');
    }

    console.log(`Processing OAuth callback for Realm ID: ${realmId}`);

    // Exchange authorization code for tokens
    const tokenData = await exchangeCodeForTokens(code);

    // Store tokens in database (encrypted)
    await quickbooksOAuthRepository.storeTokens(realmId, tokenData);

    // Set as default realm if this is first/only connection
    const currentDefault = await quickbooksRepository.getDefaultRealmId();
    if (!currentDefault) {
      await quickbooksRepository.setDefaultRealmId(realmId);
      console.log(`Set Realm ID ${realmId} as default`);
    }

    console.log(`QuickBooks connected successfully for Realm ID: ${realmId}`);
  }

  /**
   * Disconnect from QuickBooks
   * Deletes stored tokens
   * If realmId not provided, uses default realm ID
   */
  async disconnect(realmId?: string): Promise<void> {
    const targetRealmId = realmId || await quickbooksRepository.getDefaultRealmId();

    if (!targetRealmId) {
      throw new Error('Not connected to QuickBooks');
    }

    await quickbooksOAuthRepository.deleteTokens(targetRealmId);
    console.log(`Disconnected from QuickBooks (Realm ID: ${targetRealmId})`);
  }
}

// Export singleton instance
export const qbOAuthService = new QBOAuthService();
