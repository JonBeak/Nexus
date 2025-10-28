/**
 * QuickBooks Database Manager
 * Handles storage and retrieval of QB OAuth tokens and entity ID mappings
 */

import { pool } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// =============================================
// TYPES
// =============================================

export interface QBTokenData {
  realm_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: Date;
  refresh_token_expires_at: Date;
  id_token?: string;
}

export interface QBCustomerMapping {
  customer_id: number;
  qb_customer_id: string;
  qb_customer_name: string;
  sync_token?: string;
}

export interface QBTaxCodeMapping {
  tax_name: string;
  qb_tax_code_id: string;
  tax_rate?: number;
}

export interface QBItemMapping {
  item_name: string;
  qb_item_id: string;
  qb_item_type?: string;
  sync_token?: string;
}

// =============================================
// TOKEN MANAGEMENT
// =============================================

/**
 * Store or update OAuth tokens for a realm
 */
export async function storeTokens(
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

  await pool.execute(
    `INSERT INTO qb_oauth_tokens
      (realm_id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, id_token)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      access_token = VALUES(access_token),
      refresh_token = VALUES(refresh_token),
      access_token_expires_at = VALUES(access_token_expires_at),
      refresh_token_expires_at = VALUES(refresh_token_expires_at),
      id_token = VALUES(id_token),
      updated_at = CURRENT_TIMESTAMP`,
    [
      realmId,
      tokenData.access_token,
      tokenData.refresh_token,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      tokenData.id_token || null,
    ]
  );

  console.log(`✅ Tokens stored/updated for Realm ID: ${realmId}`);
}

/**
 * Get active (non-expired) access token for a realm
 */
export async function getActiveTokens(realmId: string): Promise<QBTokenData | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT realm_id, access_token, refresh_token,
            access_token_expires_at, refresh_token_expires_at, id_token
     FROM qb_oauth_tokens
     WHERE realm_id = ? AND access_token_expires_at > NOW()`,
    [realmId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as QBTokenData;
}

/**
 * Get refresh token details (even if access token is expired)
 */
export async function getRefreshTokenDetails(realmId: string): Promise<QBTokenData | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT realm_id, refresh_token, refresh_token_expires_at
     FROM qb_oauth_tokens
     WHERE realm_id = ? AND refresh_token_expires_at > NOW()`,
    [realmId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as QBTokenData;
}

/**
 * Get the default/most recent realm ID
 */
export async function getDefaultRealmId(): Promise<string | null> {
  // First check qb_settings for explicitly set default
  const [settingsRows] = await pool.execute<RowDataPacket[]>(
    `SELECT setting_value FROM qb_settings WHERE setting_key = 'default_realm_id'`
  );

  if (settingsRows.length > 0 && settingsRows[0].setting_value) {
    return settingsRows[0].setting_value as string;
  }

  // Fallback to most recently updated token
  const [tokenRows] = await pool.execute<RowDataPacket[]>(
    `SELECT realm_id FROM qb_oauth_tokens ORDER BY updated_at DESC LIMIT 1`
  );

  return tokenRows.length > 0 ? (tokenRows[0].realm_id as string) : null;
}

/**
 * Set the default realm ID
 */
export async function setDefaultRealmId(realmId: string): Promise<void> {
  await pool.execute(
    `UPDATE qb_settings SET setting_value = ? WHERE setting_key = 'default_realm_id'`,
    [realmId]
  );
}

// =============================================
// CUSTOMER MAPPING
// =============================================

/**
 * Get QB customer ID from local customer ID
 */
export async function getQBCustomerIdByLocalId(customerId: number): Promise<string | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT qb_customer_id FROM qb_customer_id_mappings WHERE customer_id = ?`,
    [customerId]
  );

  return rows.length > 0 ? (rows[0].qb_customer_id as string) : null;
}

/**
 * Get QB customer ID by customer name (fallback lookup)
 */
export async function getQBCustomerIdByName(customerName: string): Promise<string | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT qb_customer_id FROM qb_customer_id_mappings WHERE qb_customer_name = ?`,
    [customerName]
  );

  return rows.length > 0 ? (rows[0].qb_customer_id as string) : null;
}

/**
 * Store customer ID mapping
 */
export async function storeCustomerMapping(mapping: QBCustomerMapping): Promise<void> {
  await pool.execute(
    `INSERT INTO qb_customer_id_mappings
      (customer_id, qb_customer_id, qb_customer_name, sync_token, last_synced_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
      qb_customer_id = VALUES(qb_customer_id),
      qb_customer_name = VALUES(qb_customer_name),
      sync_token = VALUES(sync_token),
      last_synced_at = NOW()`,
    [mapping.customer_id, mapping.qb_customer_id, mapping.qb_customer_name, mapping.sync_token || null]
  );
}

// =============================================
// TAX CODE MAPPING
// =============================================

/**
 * Get QB tax code ID by tax name
 */
export async function getQBTaxCodeId(taxName: string): Promise<string | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT qb_tax_code_id FROM qb_tax_code_mappings WHERE tax_name = ?`,
    [taxName]
  );

  return rows.length > 0 ? (rows[0].qb_tax_code_id as string) : null;
}

/**
 * Store tax code mapping
 */
export async function storeTaxCodeMapping(mapping: QBTaxCodeMapping): Promise<void> {
  await pool.execute(
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
// ITEM MAPPING
// =============================================

/**
 * Get QB item ID by item name
 */
export async function getQBItemId(itemName: string): Promise<{ qb_item_id: string; description: string | null } | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT qb_item_id, description FROM qb_item_mappings WHERE item_name = ?`,
    [itemName]
  );

  if (rows.length > 0) {
    return {
      qb_item_id: rows[0].qb_item_id as string,
      description: (rows[0].description as string) || null
    };
  }

  return null;
}

/**
 * Store item mapping
 */
export async function storeItemMapping(mapping: QBItemMapping): Promise<void> {
  await pool.execute(
    `INSERT INTO qb_item_mappings
      (item_name, qb_item_id, qb_item_type, sync_token, last_synced_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
      qb_item_id = VALUES(qb_item_id),
      qb_item_type = VALUES(qb_item_type),
      sync_token = VALUES(sync_token),
      last_synced_at = NOW()`,
    [mapping.item_name, mapping.qb_item_id, mapping.qb_item_type || null, mapping.sync_token || null]
  );
}

// =============================================
// SETTINGS
// =============================================

/**
 * Get a setting value
 */
export async function getSetting(key: string): Promise<string | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT setting_value FROM qb_settings WHERE setting_key = ?`,
    [key]
  );

  return rows.length > 0 ? (rows[0].setting_value as string) : null;
}

/**
 * Set a setting value
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await pool.execute(
    `UPDATE qb_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?`,
    [value, key]
  );
}

// =============================================
// OAUTH STATE MANAGEMENT (CSRF Protection)
// =============================================

/**
 * Store OAuth state token for CSRF validation
 * @param stateToken - Cryptographically random state token
 * @param expiresInSeconds - Expiry time in seconds (default: 600 = 10 minutes)
 */
export async function storeOAuthState(stateToken: string, expiresInSeconds: number = 600): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await pool.execute(
    `INSERT INTO qb_oauth_states (state_token, expires_at)
     VALUES (?, ?)`,
    [stateToken, expiresAt]
  );

  console.log(`✅ OAuth state stored: ${stateToken.substring(0, 8)}... (expires in ${expiresInSeconds}s)`);
}

/**
 * Validate and consume OAuth state token
 * Returns true if valid, false if invalid/expired/not found
 * @param stateToken - The state token to validate
 */
export async function validateAndConsumeOAuthState(stateToken: string): Promise<boolean> {
  // Check if state exists and is not expired
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM qb_oauth_states
     WHERE state_token = ? AND expires_at > NOW()`,
    [stateToken]
  );

  if (rows.length === 0) {
    console.warn(`⚠️ Invalid or expired OAuth state: ${stateToken.substring(0, 8)}...`);
    return false;
  }

  // Delete the state token (one-time use)
  await pool.execute(
    `DELETE FROM qb_oauth_states WHERE state_token = ?`,
    [stateToken]
  );

  console.log(`✅ OAuth state validated and consumed: ${stateToken.substring(0, 8)}...`);
  return true;
}

/**
 * Clean up expired OAuth state tokens
 * Should be called periodically (e.g., via cron job or on server start)
 */
export async function cleanupExpiredOAuthStates(): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM qb_oauth_states WHERE expires_at < NOW()`
  );

  const deletedCount = result.affectedRows;
  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} expired OAuth state token(s)`);
  }

  return deletedCount;
}
