// File Clean up Finished: 2025-11-21
// Analysis: Repository for QB estimate and order preparation workflow
// Status: CLEAN - Feature IS in production (33 estimates, actively used since Nov 18)
// Changes made:
//   1. Added proper TypeScript types to all functions
//   2. Created new interfaces: OrderPartForHash, OrderDataForHash, OrderDataForQBEstimate, OrderPartForQBEstimate, BasicOrderInfo
//   3. Added getOrderDataForQBEstimate() - moved from qbEstimateService
//   4. Added getOrderPartsForQBEstimate() - moved from qbEstimateService
//   5. Updated OrderPointPerson interface to match database schema
// Findings:
//   - All 8 functions are properly used in production
//   - Already uses query() helper ✅
//   - Proper 3-layer architecture (repository handles all DB access)
// Decision: File is now type-safe and architecturally sound

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
import {
  QBEstimateRecord,
  OrderPointPerson,
  OrderPartForHash,
  OrderDataForHash,
  OrderDataForQBEstimate,
  OrderPartForQBEstimate,
  BasicOrderInfo
} from '../types/orderPreparation';

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
 * Returns ALL parts with ALL fields that affect PDFs and QB estimates
 */
export async function getOrderPartsForHash(orderId: number): Promise<OrderPartForHash[]> {
  const rows = await query(
    `SELECT
      part_id,
      part_number,
      display_number,
      is_parent,
      product_type,
      part_scope,
      qb_item_name,
      qb_description,
      specs_display_name,
      specs_qty,
      product_type_id,
      channel_letter_type_id,
      base_product_type_id,
      quantity,
      specifications,
      invoice_description,
      unit_price,
      extended_price,
      production_notes
    FROM order_parts
    WHERE order_id = ?
    ORDER BY part_number, display_number`,
    [orderId]
  ) as RowDataPacket[];

  return rows as unknown as OrderPartForHash[];
}

/**
 * Get order-level data for hash calculation (staleness detection)
 * Returns all order fields that affect PDFs and QB estimates
 */
export async function getOrderDataForHash(orderId: number): Promise<OrderDataForHash | null> {
  const rows = await query(
    `SELECT
      order_name,
      customer_po,
      customer_job_number,
      order_date,
      due_date,
      production_notes,
      manufacturing_note,
      internal_note,
      invoice_email,
      terms,
      deposit_required,
      cash,
      discount,
      tax_name,
      invoice_notes,
      shipping_required,
      sign_image_path
    FROM orders
    WHERE order_id = ?`,
    [orderId]
  ) as RowDataPacket[];

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as unknown as OrderDataForHash;
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
export async function getOrderByOrderNumber(orderNumber: number): Promise<BasicOrderInfo | null> {
  const rows = await query(
    `SELECT
      order_id,
      order_number,
      customer_id,
      order_name,
      status,
      folder_name,
      folder_location
    FROM orders
    WHERE order_number = ?`,
    [orderNumber]
  ) as RowDataPacket[];

  return rows.length > 0 ? (rows[0] as unknown as BasicOrderInfo) : null;
}

/**
 * Get order data for QB estimate creation
 * Includes customer info needed for QB API
 */
export async function getOrderDataForQBEstimate(orderId: number): Promise<OrderDataForQBEstimate | null> {
  const rows = await query(
    `SELECT
      o.order_id,
      o.order_number,
      o.customer_id,
      o.order_name,
      o.tax_name,
      o.folder_location,
      o.customer_po,
      o.customer_job_number,
      c.company_name as customer_name,
      c.quickbooks_name
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    WHERE o.order_id = ?`,
    [orderId]
  ) as RowDataPacket[];

  return rows.length > 0 ? (rows[0] as unknown as OrderDataForQBEstimate) : null;
}

/**
 * Get order parts for QB estimate creation (invoice items only)
 * Filters for parts with pricing information
 */
export async function getOrderPartsForQBEstimate(orderId: number): Promise<OrderPartForQBEstimate[]> {
  const rows = await query(
    `SELECT
      part_id,
      part_number,
      invoice_description,
      qb_item_name,
      qb_description,
      specs_display_name,
      quantity,
      unit_price,
      extended_price,
      product_type,
      (unit_price IS NOT NULL AND unit_price > 0) as is_taxable
    FROM order_parts
    WHERE order_id = ?
      AND (invoice_description IS NOT NULL OR unit_price IS NOT NULL)
    ORDER BY part_number`,
    [orderId]
  ) as RowDataPacket[];

  return rows.map(row => ({
    part_id: row.part_id,
    part_number: row.part_number,
    invoice_description: row.invoice_description,
    qb_item_name: row.qb_item_name,
    qb_description: row.qb_description,
    specs_display_name: row.specs_display_name,
    quantity: row.quantity,
    unit_price: row.unit_price,
    extended_price: row.extended_price,
    product_type: row.product_type,
    is_taxable: row.is_taxable === 1
  }));
}
