/**
 * QuickBooks Repository
 * Data Access Layer for QuickBooks Integration
 *
 * Handles all direct database operations for:
 * - Estimate data access
 * - Customer/tax/item ID resolution and caching
 * - OAuth state management (CSRF protection)
 * - Settings and configuration
 */

import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

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
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT customer_id, is_draft, qb_estimate_id, job_id
       FROM job_estimates
       WHERE id = ?`,
      [estimateId]
    );

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
    await pool.execute(
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
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM job_estimates WHERE qb_estimate_id = ?`,
      [qbEstimateId]
    );

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
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT province_state_short FROM customer_addresses
       WHERE customer_id = ? AND (is_billing = 1 AND is_primary = 1 OR is_primary = 1)
       ORDER BY is_billing DESC
       LIMIT 1`,
      [customerId]
    );

    return rows.length > 0 ? rows[0].province_state_short : null;
  }

  /**
   * Get cached QuickBooks customer ID from local customer ID
   * Returns null if not cached
   */
  async getCachedCustomerId(customerId: number): Promise<string | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT qb_customer_id FROM qb_customer_id_mappings
       WHERE customer_id = ?`,
      [customerId]
    );

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
    await pool.execute(
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
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT pt.tax_name FROM provinces_tax pt
       WHERE pt.province_short = ? AND pt.is_active = 1
       LIMIT 1`,
      [provinceShort]
    );

    return rows.length > 0 ? rows[0].tax_name : null;
  }

  /**
   * Get QuickBooks tax code ID from tax name
   * Returns QB tax code ID for API calls
   */
  async getTaxCodeIdByName(taxName: string): Promise<string | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT qtc.qb_tax_code_id FROM qb_tax_code_mappings qtc
       WHERE qtc.tax_name = ?
       LIMIT 1`,
      [taxName]
    );

    return rows.length > 0 ? rows[0].qb_tax_code_id : null;
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
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT qb_item_id, description FROM qb_item_mappings
       WHERE item_name = ?`,
      [itemName]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      qb_item_id: rows[0].qb_item_id,
      description: rows[0].description || null
    };
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
    await pool.execute(
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
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, item_name, description, qb_item_id, qb_item_type
       FROM qb_item_mappings
       ORDER BY item_name ASC`
    );

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
    const [settingsRows] = await pool.execute<RowDataPacket[]>(
      `SELECT setting_value FROM qb_settings
       WHERE setting_key = 'default_realm_id'`
    );

    if (settingsRows.length > 0 && settingsRows[0].setting_value) {
      return settingsRows[0].setting_value as string;
    }

    // Fallback to most recent token
    const [tokenRows] = await pool.execute<RowDataPacket[]>(
      `SELECT realm_id FROM qb_oauth_tokens
       ORDER BY updated_at DESC LIMIT 1`
    );

    return tokenRows.length > 0 ? tokenRows[0].realm_id : null;
  }

  /**
   * Set default QuickBooks realm ID
   * Updates qb_settings table
   */
  async setDefaultRealmId(realmId: string): Promise<void> {
    await pool.execute(
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

    await pool.execute(
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
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM qb_oauth_states
       WHERE state_token = ? AND expires_at > NOW()`,
      [stateToken]
    );

    if (rows.length === 0) {
      return false;
    }

    // Delete token (one-time use)
    await pool.execute(
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
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM qb_oauth_states WHERE expires_at < NOW()`
    );

    return result.affectedRows;
  }

  // =============================================
  // TOKEN MANAGEMENT
  // =============================================

  /**
   * Delete OAuth tokens for a realm (disconnect)
   * Used when user disconnects from QuickBooks
   */
  async deleteTokens(realmId: string): Promise<void> {
    await pool.execute(
      'DELETE FROM qb_oauth_tokens WHERE realm_id = ?',
      [realmId]
    );
  }
}

// Export singleton instance
export const quickbooksRepository = new QuickBooksRepository();
