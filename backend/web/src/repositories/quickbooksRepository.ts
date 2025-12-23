// Refactored: Nov 21, 2025 (OAuth Split + Dead Code Removal)
// Changes:
// - Extracted OAuth methods to quickbooksOAuthRepository.ts (7 methods, ~235 lines)
// - Removed dead code: getEstimateByQBId(), storeTaxCodeMapping() (unused methods)
// - Reduced from 662 → 393 lines (41% reduction)
// - OAuth-related database operations now in quickbooksOAuthRepository.ts
// - This file now focuses on: Estimates, Customer/Tax/Item Resolution, Settings
//
// Previous: Nov 15, 2025 - Complete dbManager.ts deprecation
// Previous: Nov 14, 2025 - Token management migration, query() standardization
/**
 * QuickBooks Repository
 * Data Access Layer for QuickBooks Integration (Non-OAuth Operations)
 *
 * Handles all direct database operations for:
 * - Estimate data access
 * - Customer/tax/item ID resolution and caching (single + batch)
 * - Settings and configuration
 *
 * OAuth operations (token storage, CSRF state) are in quickbooksOAuthRepository.ts
 */

import { query } from '../config/database';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2/promise';

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
    is_prepared: boolean;
    qb_estimate_id: string | null;
    job_id: number;
  } | null> {
    const rows = await query(
      `SELECT customer_id, is_draft, is_prepared, qb_estimate_id, job_id
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
      is_prepared: Boolean(rows[0].is_prepared),
      qb_estimate_id: rows[0].qb_estimate_id,
      job_id: rows[0].job_id
    };
  }

  /**
   * Save QB linkage after successful QB estimate creation
   * Does NOT set is_sent=TRUE - that happens in markEstimateAsSent after email is sent
   * This allows email failures to be retried without incorrectly showing "previously sent"
   * Uses txnDate from QuickBooks as estimate_date
   */
  async finalizeEstimate(
    estimateId: number,
    qbEstimateId: string,
    qbDocNumber: string,
    amounts: { subtotal: number; taxAmount: number; total: number; estimateDate?: string },
    userId: number
  ): Promise<void> {
    await query(
      `UPDATE job_estimates
       SET is_draft = FALSE,
           finalized_at = NOW(),
           finalized_by_user_id = ?,
           qb_estimate_id = ?,
           qb_doc_number = ?,
           sent_to_qb_at = NOW(),
           estimate_date = ?,
           subtotal = ?,
           tax_amount = ?,
           total_amount = ?
       WHERE id = ? AND (is_draft = TRUE OR is_prepared = TRUE)`,
      [userId, qbEstimateId, qbDocNumber, amounts.estimateDate || null, amounts.subtotal, amounts.taxAmount, amounts.total, estimateId]
    );
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

}

// Export singleton instance
export const quickbooksRepository = new QuickBooksRepository();
