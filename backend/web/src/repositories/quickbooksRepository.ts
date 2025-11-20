// File Clean up Finished: Nov 15, 2025 (Third cleanup - Complete dbManager.ts Deprecation)
// Latest Cleanup Changes (Nov 15, 2025):
// - DEPRECATED dbManager.ts completely (450 lines eliminated)
// - Updated 4 files to use quickbooksRepository.getDefaultRealmId() instead of dbManager
// - Deleted utils/quickbooks/dbManager.ts (all methods either duplicated or dead code)
// - Architecture compliance: Repository is now single source of truth for QB database access
//
// Previous Cleanup (Nov 14, 2025 - Token Management Migration):
// - Added token management methods from dbManager.ts (architectural consolidation)
// - Added storeTokens() with AES-256-GCM encryption (migrated from dbManager)
// - Added getActiveTokens() with automatic decryption (migrated from dbManager)
// - Added getRefreshTokenDetails() for OAuth refresh flow (migrated from dbManager)
// - All token methods use query() helper instead of pool.execute() (standardization)
// - Added QBTokenData interface export for type safety
// - File grew from 415 → 621 lines (token management consolidation)
// - Repository now handles ALL QuickBooks database operations (single source of truth)
//
// Previous Cleanup (Nov 14, 2025):
// - Migrated all 20 pool.execute() calls to query() helper (standardization)
// - Updated import from pool to query
// - Reduced from 434 → 415 lines (4% reduction)
// - Kept pool import for getBatchQBItemMappings() transaction support
// - No dead code found - all 19 methods actively used
//
// Previous Enhancement (Nov 14, 2025):
//   - Added getBatchQBItemMappings() method for batch fetching QB items (architecture fix)
//   - Used by orderPartCreationService to replace direct database query
//   - Supports transaction connections for atomic operations
/**
 * QuickBooks Repository
 * Data Access Layer for QuickBooks Integration
 *
 * Handles all direct database operations for:
 * - Estimate data access
 * - Customer/tax/item ID resolution and caching (single + batch)
 * - OAuth token management (encrypted storage with AES-256-GCM)
 * - OAuth state management (CSRF protection)
 * - Settings and configuration
 */

import { query } from '../config/database';
import { pool } from '../config/database';
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
 * QuickBooks Repository Class
 * All methods perform direct database queries - NO business logic
 */
export class QuickBooksRepository {

  // =============================================
  // ESTIMATE DATA ACCESS
  // =============================================

  /**
   * Get estimate details for QuickBooks creation
   * Returns null if estimate not found
   */
  async getEstimateDetails(estimateId: number): Promise<{
    customer_id: number;
    is_draft: boolean;
    qb_estimate_id: string | null;
    job_id: number;
  } | null> {
    const rows = await query(
      `SELECT customer_id, is_draft, qb_estimate_id, job_id
       FROM job_estimates
       WHERE id = ?`,
      [estimateId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    return {
      customer_id: rows[0].customer_id,
      is_draft: Boolean(rows[0].is_draft),
      qb_estimate_id: rows[0].qb_estimate_id,
      job_id: rows[0].job_id
    };
  }

  /**
   * Finalize estimate after successful QB creation
   * Sets is_draft = FALSE and updates QB linkage
   */
  async finalizeEstimate(
    estimateId: number,
    qbEstimateId: string,
    amounts: { subtotal: number; taxAmount: number; total: number },
    userId: number
  ): Promise<void> {
    await query(
      `UPDATE job_estimates
       SET is_draft = FALSE,
           status = 'sent',
           is_sent = TRUE,
           finalized_at = NOW(),
           finalized_by_user_id = ?,
           qb_estimate_id = ?,
           sent_to_qb_at = NOW(),
           subtotal = ?,
           tax_amount = ?,
           total_amount = ?
       WHERE id = ? AND is_draft = TRUE`,
      [userId, qbEstimateId, amounts.subtotal, amounts.taxAmount, amounts.total, estimateId]
    );
  }

  /**
   * Check if estimate exists by QB estimate ID
   * Used for duplicate detection
   */
  async getEstimateByQBId(qbEstimateId: string): Promise<{ id: number } | null> {
    const rows = await query(
      `SELECT id FROM job_estimates WHERE qb_estimate_id = ?`,
      [qbEstimateId]
    ) as RowDataPacket[];

    return rows.length > 0 ? { id: rows[0].id } : null;
  }

  // =============================================
  // CUSTOMER RESOLUTION
  // =============================================

  /**
   * Get customer's billing province for tax resolution
   * Returns province_state_short (e.g., "ON", "BC")
   * Priority: is_billing=1 first, then is_primary=1
   */
  async getCustomerProvince(customerId: number): Promise<string | null> {
    const rows = await query(
      `SELECT province_state_short FROM customer_addresses
       WHERE customer_id = ? AND (is_billing = 1 AND is_primary = 1 OR is_primary = 1)
       ORDER BY is_billing DESC
       LIMIT 1`,
      [customerId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].province_state_short : null;
  }

  /**
   * Get cached QuickBooks customer ID from local customer ID
   * Returns null if not cached
   */
  async getCachedCustomerId(customerId: number): Promise<string | null> {
    const rows = await query(
      `SELECT qb_customer_id FROM qb_customer_id_mappings
       WHERE customer_id = ?`,
      [customerId]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].qb_customer_id : null;
  }

  /**
   * Store customer ID mapping for future lookups
   * Updates existing mapping if already exists
   */
  async storeCustomerMapping(mapping: {
    customer_id: number;
    qb_customer_id: string;
    qb_customer_name: string;
  }): Promise<void> {
    await query(
      `INSERT INTO qb_customer_id_mappings
        (customer_id, qb_customer_id, qb_customer_name, last_synced_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        qb_customer_id = VALUES(qb_customer_id),
        qb_customer_name = VALUES(qb_customer_name),
        last_synced_at = NOW()`,
      [mapping.customer_id, mapping.qb_customer_id, mapping.qb_customer_name]
    );
  }

  // =============================================
  // TAX RESOLUTION
  // =============================================

  /**
   * Get tax name from province code
   * Returns tax_name (e.g., "HST 13%", "GST")
   */
  async getTaxNameForProvince(provinceShort: string): Promise<string | null> {
    const rows = await query(
      `SELECT pt.tax_name FROM provinces_tax pt
       WHERE pt.province_short = ? AND pt.is_active = 1
       LIMIT 1`,
      [provinceShort]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].tax_name : null;
  }

  /**
   * Get QuickBooks tax code ID from tax name
   * Returns QB tax code ID for API calls
   */
  async getTaxCodeIdByName(taxName: string): Promise<string | null> {
    const rows = await query(
      `SELECT qtc.qb_tax_code_id FROM qb_tax_code_mappings qtc
       WHERE qtc.tax_name = ?
       LIMIT 1`,
      [taxName]
    ) as RowDataPacket[];

    return rows.length > 0 ? rows[0].qb_tax_code_id : null;
  }

  /**
   * Get default tax code from qb_settings
   * Used as fallback when tax_name is NULL or not found in mappings
   * Returns: { id: string, name: string } or null if not configured
   */
  async getDefaultTaxCode(): Promise<{ id: string; name: string } | null> {
    const rows = await query(
      `SELECT setting_value
       FROM qb_settings
       WHERE setting_key IN ('default_tax_code_id', 'default_tax_code_name')
       ORDER BY setting_key`,
      []
    ) as RowDataPacket[];

    if (rows.length < 2) {
      return null; // Not configured
    }

    return {
      id: rows[0].setting_value,    // default_tax_code_id
      name: rows[1].setting_value   // default_tax_code_name
    };
  }

  /**
   * Store tax code mapping for future lookups
   * Updates existing mapping if already exists
   */
  async storeTaxCodeMapping(mapping: {
    tax_name: string;
    qb_tax_code_id: string;
    tax_rate?: number;
  }): Promise<void> {
    await query(
      `INSERT INTO qb_tax_code_mappings
        (tax_name, qb_tax_code_id, tax_rate, last_synced_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        qb_tax_code_id = VALUES(qb_tax_code_id),
        tax_rate = VALUES(tax_rate),
        last_synced_at = NOW()`,
      [mapping.tax_name, mapping.qb_tax_code_id, mapping.tax_rate || null]
    );
  }

  // =============================================
  // ITEM RESOLUTION
  // =============================================

  /**
   * Get cached QuickBooks item ID and description
   * Returns null if not cached
   */
  async getCachedItemId(itemName: string): Promise<{
    qb_item_id: string;
    description: string | null;
  } | null> {
    const rows = await query(
      `SELECT qb_item_id, description FROM qb_item_mappings
       WHERE item_name = ?`,
      [itemName]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    return {
      qb_item_id: rows[0].qb_item_id,
      description: rows[0].description || null
    };
  }

  /**
   * Get cached QuickBooks item mappings in batch (case-insensitive)
   * Returns Map with lowercase item names as keys for efficient lookups
   * Used by orderPartCreationService and qbEstimateService for batch processing
   *
   * @param itemNames - Array of item names to fetch
   * @param connection - Optional transaction connection
   * @returns Map of lowercase item names to { name, description, qb_item_id }
   */
  async getBatchQBItemMappings(
    itemNames: string[],
    connection?: any
  ): Promise<Map<string, { name: string; description: string | null; qb_item_id: string }>> {
    if (itemNames.length === 0) {
      return new Map();
    }

    const conn = connection || pool;

    const result = await conn.execute(
      `SELECT item_name, description, qb_item_id FROM qb_item_mappings
       WHERE LOWER(item_name) IN (${itemNames.map(() => 'LOWER(?)').join(', ')})`,
      itemNames
    );
    const rows = result[0] as RowDataPacket[];

    // Create case-insensitive lookup map
    return new Map(
      rows.map((row: any) => [
        row.item_name.toLowerCase(),
        { name: row.item_name, description: row.description, qb_item_id: row.qb_item_id }
      ])
    );
  }

  /**
   * Store item mapping for future lookups
   * Updates existing mapping if already exists
   */
  async storeItemMapping(mapping: {
    item_name: string;
    qb_item_id: string;
    qb_item_type?: string;
  }): Promise<void> {
    await query(
      `INSERT INTO qb_item_mappings
        (item_name, qb_item_id, qb_item_type, last_synced_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        qb_item_id = VALUES(qb_item_id),
        qb_item_type = VALUES(qb_item_type),
        last_synced_at = NOW()`,
      [mapping.item_name, mapping.qb_item_id, mapping.qb_item_type || null]
    );
  }

  /**
   * Get all QuickBooks items for dropdown population
   * Returns sorted list of items
   */
  async getAllQBItems(): Promise<Array<{
    id: number;
    name: string;
    description: string | null;
    qbItemId: string;
    qbItemType: string | null;
  }>> {
    const rows = await query(
      `SELECT id, item_name, description, qb_item_id, qb_item_type
       FROM qb_item_mappings
       ORDER BY item_name ASC`
    ) as RowDataPacket[];

    return rows.map((row: any) => ({
      id: row.id,
      name: row.item_name,
      description: row.description,
      qbItemId: row.qb_item_id,
      qbItemType: row.qb_item_type
    }));
  }

  // =============================================
  // SETTINGS & CONFIGURATION
  // =============================================

  /**
   * Get default QuickBooks realm ID
   * First checks explicit setting, then falls back to most recent token
   */
  async getDefaultRealmId(): Promise<string | null> {
    // First check explicit setting
    const settingsRows = await query(
      `SELECT setting_value FROM qb_settings
       WHERE setting_key = 'default_realm_id'`
    ) as RowDataPacket[];

    if (settingsRows.length > 0 && settingsRows[0].setting_value) {
      return settingsRows[0].setting_value as string;
    }

    // Fallback to most recent token
    const tokenRows = await query(
      `SELECT realm_id FROM qb_oauth_tokens
       ORDER BY updated_at DESC LIMIT 1`
    ) as RowDataPacket[];

    return tokenRows.length > 0 ? tokenRows[0].realm_id : null;
  }

  /**
   * Set default QuickBooks realm ID
   * Updates qb_settings table
   */
  async setDefaultRealmId(realmId: string): Promise<void> {
    await query(
      `UPDATE qb_settings
       SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = 'default_realm_id'`,
      [realmId]
    );
  }

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

    console.log(`✅ Tokens stored/updated (encrypted) for Realm ID: ${realmId}`);
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
export const quickbooksRepository = new QuickBooksRepository();
