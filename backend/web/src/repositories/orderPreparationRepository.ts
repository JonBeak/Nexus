// File Clean up Finished: 2025-11-18
// Analysis: Repository for QB estimate and order preparation workflow
// Status: FUNCTIONAL but feature not fully implemented (0 QB estimates in production)
// Findings:
//   - All 6 functions are used by qbEstimateService and orderPrepController
//   - Routes are registered and exposed (/api/order-preparation/*)
//   - Minor type safety issues (Promise<any[]>, Promise<any | null>)
//   - Some code duplication with qbEstimateService (getOrderParts)
//   - Type imports could use orders.ts version of OrderPointPerson
// Decision: Skip detailed cleanup until feature is actively used in production
//   Will revisit when QB estimate feature has actual usage (currently 0 records)

/**
 * Order Preparation Repository
 *
 * Data access layer for order preparation workflow including:
 * - QuickBooks estimate records management
 * - Order parts data for staleness detection
 * - Point persons for customer communication
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { QBEstimateRecord, OrderPointPerson } from '../types/orderPreparation';

/**
 * Get the current (most recent) QB estimate for an order
 */
export async function getCurrentQBEstimate(orderId: number): Promise<QBEstimateRecord | null> {
  const rows = await query(
    `SELECT
      id,
      order_id,
      qb_estimate_id,
      qb_estimate_number,
      created_at,
      created_by,
      is_current,
      estimate_data_hash,
      qb_estimate_url
    FROM order_qb_estimates
    WHERE order_id = ? AND is_current = 1
    ORDER BY created_at DESC
    LIMIT 1`,
    [orderId]
  ) as RowDataPacket[];

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    order_id: row.order_id,
    qb_estimate_id: row.qb_estimate_id,
    qb_estimate_number: row.qb_estimate_number,
    created_at: row.created_at,
    created_by: row.created_by,
    is_current: row.is_current === 1,
    estimate_data_hash: row.estimate_data_hash,
    qb_estimate_url: row.qb_estimate_url
  };
}

/**
 * Create a new QB estimate record
 */
export async function createQBEstimateRecord(data: {
  order_id: number;
  qb_estimate_id: string;
  qb_estimate_number: string;
  created_by: number;
  estimate_data_hash: string;
  qb_estimate_url: string | null;
}): Promise<number> {
  const result = await query(
    `INSERT INTO order_qb_estimates (
      order_id,
      qb_estimate_id,
      qb_estimate_number,
      created_by,
      is_current,
      estimate_data_hash,
      qb_estimate_url,
      created_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?, NOW())`,
    [
      data.order_id,
      data.qb_estimate_id,
      data.qb_estimate_number,
      data.created_by,
      data.estimate_data_hash,
      data.qb_estimate_url
    ]
  ) as ResultSetHeader;

  return result.insertId;
}

/**
 * Mark all previous QB estimates for an order as not current
 * Called before creating a new estimate
 */
export async function markPreviousEstimatesNotCurrent(orderId: number): Promise<void> {
  await query(
    `UPDATE order_qb_estimates
    SET is_current = 0
    WHERE order_id = ? AND is_current = 1`,
    [orderId]
  );
}

/**
 * Get order parts data for hash calculation (staleness detection)
 * Only returns parts with invoice data
 */
export async function getOrderPartsForHash(orderId: number): Promise<any[]> {
  const rows = await query(
    `SELECT
      part_id,
      part_number,
      invoice_description,
      quantity,
      unit_price,
      extended_price,
      product_type,
      is_taxable
    FROM order_parts
    WHERE order_id = ?
      AND (invoice_description IS NOT NULL OR unit_price IS NOT NULL)
    ORDER BY part_number`,
    [orderId]
  ) as RowDataPacket[];

  return rows;
}

/**
 * Get point persons for an order (for Phase 1.5.c.6.3 - Send to Customer)
 */
export async function getOrderPointPersons(orderNumber: number): Promise<OrderPointPerson[]> {
  const rows = await query(
    `SELECT
      pp.id,
      pp.order_id,
      pp.contact_name,
      pp.contact_email,
      pp.contact_phone,
      pp.contact_role,
      pp.is_primary,
      pp.created_at,
      pp.created_by
    FROM order_point_persons pp
    JOIN orders o ON o.order_id = pp.order_id
    WHERE o.order_number = ?
    ORDER BY pp.is_primary DESC, pp.created_at ASC`,
    [orderNumber]
  ) as RowDataPacket[];

  return rows.map(row => ({
    id: row.id,
    order_id: row.order_id,
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    contact_role: row.contact_role,
    is_primary: row.is_primary === 1,
    created_at: row.created_at,
    created_by: row.created_by
  }));
}

/**
 * Get basic order info by order number
 * Used for validation and data retrieval
 */
export async function getOrderByOrderNumber(orderNumber: number): Promise<any | null> {
  const rows = await query(
    `SELECT
      order_id,
      order_number,
      customer_id,
      job_name,
      status,
      folder_name,
      folder_location
    FROM orders
    WHERE order_number = ?`,
    [orderNumber]
  ) as RowDataPacket[];

  return rows.length > 0 ? rows[0] : null;
}
