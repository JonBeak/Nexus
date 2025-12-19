// Phase 4.c: Pricing History Repository
// Purpose: Data access layer for supplier product pricing history
// Created: 2025-12-19

import { query } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface PricingHistoryRow extends RowDataPacket {
  pricing_id: number;
  supplier_product_id: number;
  unit_price: number;
  cost_currency: string;
  effective_start_date: Date;
  effective_end_date: Date | null;
  price_change_percent: number | null;
  notes: string | null;
  created_at: Date;
  created_by: number | null;
  created_by_name?: string;
}

export class PricingHistoryRepository {
  /**
   * Create new price history entry
   */
  async create(data: {
    supplier_product_id: number;
    unit_price: number;
    cost_currency?: string;
    effective_start_date: Date;
    price_change_percent?: number | null;
    notes?: string | null;
    created_by?: number;
  }): Promise<number> {
    const sql = `
      INSERT INTO supplier_product_pricing_history
      (supplier_product_id, unit_price, cost_currency, effective_start_date, price_change_percent, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      data.supplier_product_id,
      data.unit_price,
      data.cost_currency || 'CAD',
      data.effective_start_date,
      data.price_change_percent || null,
      data.notes || null,
      data.created_by || null
    ]) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Get complete price history for a supplier product
   */
  async getHistory(supplierProductId: number): Promise<PricingHistoryRow[]> {
    const sql = `
      SELECT
        ph.*,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM supplier_product_pricing_history ph
      LEFT JOIN users u ON ph.created_by = u.user_id
      WHERE ph.supplier_product_id = ?
      ORDER BY ph.effective_start_date DESC
    `;

    return await query(sql, [supplierProductId]) as PricingHistoryRow[];
  }

  /**
   * Get current price (where effective_end_date IS NULL)
   */
  async getCurrentPrice(supplierProductId: number): Promise<PricingHistoryRow | null> {
    const sql = `
      SELECT
        ph.*,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM supplier_product_pricing_history ph
      LEFT JOIN users u ON ph.created_by = u.user_id
      WHERE ph.supplier_product_id = ? AND ph.effective_end_date IS NULL
      LIMIT 1
    `;

    const rows = await query(sql, [supplierProductId]) as PricingHistoryRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get price at specific date
   */
  async getPriceAtDate(supplierProductId: number, date: Date): Promise<PricingHistoryRow | null> {
    const sql = `
      SELECT
        ph.*,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM supplier_product_pricing_history ph
      LEFT JOIN users u ON ph.created_by = u.user_id
      WHERE ph.supplier_product_id = ?
        AND ph.effective_start_date <= ?
        AND (ph.effective_end_date IS NULL OR ph.effective_end_date >= ?)
      ORDER BY ph.effective_start_date DESC
      LIMIT 1
    `;

    const rows = await query(sql, [supplierProductId, date, date]) as PricingHistoryRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get latest prices for multiple supplier products
   */
  async getLatestPrices(supplierProductIds: number[]): Promise<Map<number, PricingHistoryRow>> {
    if (supplierProductIds.length === 0) return new Map();

    const placeholders = supplierProductIds.map(() => '?').join(',');
    const sql = `
      SELECT
        ph.*,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM supplier_product_pricing_history ph
      LEFT JOIN users u ON ph.created_by = u.user_id
      WHERE ph.supplier_product_id IN (${placeholders})
        AND ph.effective_end_date IS NULL
    `;

    const rows = await query(sql, supplierProductIds) as PricingHistoryRow[];

    const result = new Map<number, PricingHistoryRow>();
    rows.forEach(row => {
      result.set(row.supplier_product_id, row);
    });

    return result;
  }

  /**
   * End current price by setting effective_end_date
   * Used when adding a new price
   */
  async endCurrentPrice(supplierProductId: number, endDate: Date): Promise<void> {
    const sql = `
      UPDATE supplier_product_pricing_history
      SET effective_end_date = ?
      WHERE supplier_product_id = ? AND effective_end_date IS NULL
    `;

    await query(sql, [endDate, supplierProductId]);
  }

  /**
   * Delete pricing history entry (hard delete)
   */
  async delete(pricingId: number): Promise<void> {
    const sql = 'DELETE FROM supplier_product_pricing_history WHERE pricing_id = ?';
    await query(sql, [pricingId]);
  }
}
