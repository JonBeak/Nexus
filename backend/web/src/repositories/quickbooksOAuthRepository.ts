// File Created: 2025-11-21 (Extracted from quickbooksRepository.ts)
// Purpose: OAuth-related database operations for QuickBooks integration
// - OAuth State Management (CSRF protection tokens)
// - Token Management (encrypted storage with AES-256-GCM)
//
// This repository handles all authentication-related database operations
// for QuickBooks OAuth flow, keeping security concerns isolated.
/**
 * QuickBooks OAuth Repository
 * Data Access Layer for QuickBooks OAuth Operations
 *
 * Handles all direct database operations for:
 * - OAuth state management (CSRF protection)
 * - OAuth token management (encrypted storage with AES-256-GCM)
 *
 * Consumers:
 * - qbOAuthService.ts (OAuth flow orchestration)
 * - oauthClient.ts (token refresh)
 * - apiClient.ts (token retrieval for API calls)
 * - quickbooksService.ts (connection status checks)
 * - qbEstimateService.ts (PDF downloads)
 * - quickbooksCleanup.ts (scheduled cleanup job)
 * - server.ts (startup cleanup)
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { encryptionService } from '../services/encryptionService';

/**
 * QuickBooks Token Data Interface
 */
export interface QBTokenData {
  realm_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: Date;
  refresh_token_expires_at: Date;
  id_token?: string;
}

/**
 * QuickBooks OAuth Repository Class
 * All methods perform direct database queries - NO business logic
 */
export class QuickBooksOAuthRepository {

  // =============================================
  // OAUTH STATE MANAGEMENT (CSRF PROTECTION)
  // =============================================

  /**
   * Store OAuth state token for CSRF validation
   * Token expires after specified seconds (default: 600 = 10 minutes)
   */
  async storeOAuthState(stateToken: string, expiresInSeconds: number = 600): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await query(
      `INSERT INTO qb_oauth_states (state_token, expires_at)
       VALUES (?, ?)`,
      [stateToken, expiresAt]
    );
  }

  /**
   * Validate and consume OAuth state token
   * Returns true if valid and not expired, false otherwise
   * Deletes token after validation (one-time use)
   */
  async validateAndConsumeOAuthState(stateToken: string): Promise<boolean> {
    // Check if exists and not expired
    const rows = await query(
      `SELECT id FROM qb_oauth_states
       WHERE state_token = ? AND expires_at > NOW()`,
      [stateToken]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return false;
    }

    // Delete token (one-time use)
    await query(
      `DELETE FROM qb_oauth_states WHERE state_token = ?`,
      [stateToken]
    );

    return true;
  }

  /**
   * Clean up expired OAuth state tokens
   * Returns count of deleted tokens
   * Should be called by scheduled job
   */
  async cleanupExpiredOAuthStates(): Promise<number> {
    const result = await query(
      `DELETE FROM qb_oauth_states WHERE expires_at < NOW()`
    ) as ResultSetHeader;

    return result.affectedRows;
  }

  // =============================================
  // TOKEN MANAGEMENT
  // =============================================

  /**
   * Store or update OAuth tokens for a realm
   * Encrypts tokens using AES-256-GCM before storage
   */
  async storeTokens(
    realmId: string,
    tokenData: {
      access_token: string;
      refresh_token: string;
      expires_in?: number;
      x_refresh_token_expires_in?: number;
      id_token?: string;
    }
  ): Promise<void> {
    const now = new Date();
    const accessExpiresIn = tokenData.expires_in || 3600; // Default 1 hour
    const refreshExpiresIn = tokenData.x_refresh_token_expires_in || 8726400; // Default 101 days

    const accessTokenExpiresAt = new Date(now.getTime() + accessExpiresIn * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + refreshExpiresIn * 1000);

    // Encrypt the tokens
    const encryptedAccessToken = encryptionService.encrypt(tokenData.access_token);
    const encryptedRefreshToken = encryptionService.encrypt(tokenData.refresh_token);
    const encryptedIdToken = tokenData.id_token ? encryptionService.encrypt(tokenData.id_token) : null;

    await query(
      `INSERT INTO qb_oauth_tokens
        (realm_id,
         access_token, refresh_token,
         access_token_encrypted, access_token_iv, access_token_tag,
         refresh_token_encrypted, refresh_token_iv, refresh_token_tag,
         access_token_expires_at, refresh_token_expires_at,
         id_token, encryption_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
        access_token = '',
        refresh_token = '',
        access_token_encrypted = VALUES(access_token_encrypted),
        access_token_iv = VALUES(access_token_iv),
        access_token_tag = VALUES(access_token_tag),
        refresh_token_encrypted = VALUES(refresh_token_encrypted),
        refresh_token_iv = VALUES(refresh_token_iv),
        refresh_token_tag = VALUES(refresh_token_tag),
        access_token_expires_at = VALUES(access_token_expires_at),
        refresh_token_expires_at = VALUES(refresh_token_expires_at),
        id_token = VALUES(id_token),
        encryption_version = 1,
        updated_at = CURRENT_TIMESTAMP`,
      [
        realmId,
        '', // Empty string for access_token (using encrypted version)
        '', // Empty string for refresh_token (using encrypted version)
        encryptedAccessToken.encrypted,
        encryptedAccessToken.iv,
        encryptedAccessToken.authTag,
        encryptedRefreshToken.encrypted,
        encryptedRefreshToken.iv,
        encryptedRefreshToken.authTag,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        encryptedIdToken ? encryptedIdToken.encrypted : null,
      ]
    );

    console.log(`Tokens stored/updated (encrypted) for Realm ID: ${realmId}`);
  }

  /**
   * Get active (non-expired) access token for a realm
   * Decrypts tokens if they are encrypted
   */
  async getActiveTokens(realmId: string): Promise<QBTokenData | null> {
    const rows = await query(
      `SELECT realm_id,
              access_token, access_token_encrypted, access_token_iv, access_token_tag,
              refresh_token, refresh_token_encrypted, refresh_token_iv, refresh_token_tag,
              access_token_expires_at, refresh_token_expires_at, id_token,
              encryption_version
       FROM qb_oauth_tokens
       WHERE realm_id = ? AND access_token_expires_at > NOW()`,
      [realmId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    let accessToken: string;
    let refreshToken: string;

    // Check if tokens are encrypted
    if (row.encryption_version === 1) {
      // Decrypt tokens
      accessToken = encryptionService.decrypt(
        row.access_token_encrypted,
        row.access_token_iv,
        row.access_token_tag
      );
      refreshToken = encryptionService.decrypt(
        row.refresh_token_encrypted,
        row.refresh_token_iv,
        row.refresh_token_tag
      );
    } else {
      // Use plaintext tokens (during migration)
      accessToken = row.access_token;
      refreshToken = row.refresh_token;
    }

    return {
      realm_id: row.realm_id,
      access_token: accessToken,
      refresh_token: refreshToken,
      access_token_expires_at: row.access_token_expires_at,
      refresh_token_expires_at: row.refresh_token_expires_at,
      id_token: row.id_token,
    };
  }

  /**
   * Get refresh token details (even if access token is expired)
   * Decrypts refresh token if encrypted
   */
  async getRefreshTokenDetails(realmId: string): Promise<QBTokenData | null> {
    const rows = await query(
      `SELECT realm_id,
              refresh_token, refresh_token_encrypted, refresh_token_iv, refresh_token_tag,
              refresh_token_expires_at, encryption_version
       FROM qb_oauth_tokens
       WHERE realm_id = ? AND refresh_token_expires_at > NOW()`,
      [realmId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    let refreshToken: string;

    // Check if token is encrypted
    if (row.encryption_version === 1) {
      // Decrypt token
      refreshToken = encryptionService.decrypt(
        row.refresh_token_encrypted,
        row.refresh_token_iv,
        row.refresh_token_tag
      );
    } else {
      // Use plaintext token (during migration)
      refreshToken = row.refresh_token;
    }

    return {
      realm_id: row.realm_id,
      access_token: '', // Not needed for refresh
      refresh_token: refreshToken,
      refresh_token_expires_at: row.refresh_token_expires_at,
      access_token_expires_at: new Date(), // Placeholder
    };
  }

  /**
   * Delete OAuth tokens for a realm (disconnect)
   * Used when user disconnects from QuickBooks
   */
  async deleteTokens(realmId: string): Promise<void> {
    await query(
      'DELETE FROM qb_oauth_tokens WHERE realm_id = ?',
      [realmId]
    );
  }
}

// Export singleton instance
export const quickbooksOAuthRepository = new QuickBooksOAuthRepository();
