/**
 * Invoice Header Row Service
 *
 * Manages the auto-generated header row in order_parts for 1:1 QB sync.
 * The header row (part_number=0, is_header_row=true) contains:
 *   "Order #X - OrderName\nPO: PO#\nJob: Job#"
 *
 * This replaces the dynamic header generation that was in qbInvoiceService.ts
 * and qbEstimateService.ts, ensuring 1:1 mapping between order_parts and QB lines.
 *
 * @module services/invoiceHeaderService
 * @created 2025-12-16
 */

import { query } from '../config/database';
import { orderPartRepository } from '../repositories/orderPartRepository';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';

/**
 * Build header text from order data
 * Format: "Order #X - OrderName\nPO: PO#\nJob: Job#"
 */
export function buildHeaderText(
  orderNumber: number,
  orderName: string,
  customerPo?: string | null,
  customerJobNumber?: string | null
): string {
  let headerText = `Order #${orderNumber} - ${orderName}`;
  if (customerPo?.trim()) {
    headerText += `\nPO #: ${customerPo}`;
  }
  if (customerJobNumber?.trim()) {
    headerText += `\nJob #: ${customerJobNumber}`;
  }
  return headerText;
}

/**
 * Create header row for a new order
 * Called during order conversion from estimate
 *
 * @param orderId - The order ID
 * @param orderNumber - The order number (e.g., 200001)
 * @param orderName - The order name
 * @param customerPo - Optional customer PO number
 * @param customerJobNumber - Optional customer job number
 * @param connection - Optional database connection for transaction support
 * @returns The created part_id
 */
export async function createHeaderRow(
  orderId: number,
  orderNumber: number,
  orderName: string,
  customerPo?: string | null,
  customerJobNumber?: string | null,
  connection?: PoolConnection
): Promise<number> {
  const headerText = buildHeaderText(orderNumber, orderName, customerPo, customerJobNumber);

  const partId = await orderPartRepository.createOrderPart({
    order_id: orderId,
    part_number: 0,
    is_header_row: true,
    display_number: '0',
    is_parent: false,
    product_type: 'Header',
    product_type_id: 'header',
    quantity: null,
    qb_description: headerText,
    specifications: {}
  }, connection);

  console.log(`[Invoice Header] Created header row for order #${orderNumber} (part_id: ${partId})`);
  return partId;
}

/**
 * Update header row when order details change
 * Called when order_name, customer_po, or customer_job_number are updated
 *
 * @param orderId - The order ID
 * @param orderNumber - The order number
 * @param orderName - The new order name
 * @param customerPo - The new customer PO (optional)
 * @param customerJobNumber - The new customer job number (optional)
 */
export async function updateHeaderRow(
  orderId: number,
  orderNumber: number,
  orderName: string,
  customerPo?: string | null,
  customerJobNumber?: string | null
): Promise<void> {
  const headerText = buildHeaderText(orderNumber, orderName, customerPo, customerJobNumber);

  // Find existing header row
  const rows = await query(
    `SELECT part_id FROM order_parts WHERE order_id = ? AND is_header_row = 1`,
    [orderId]
  ) as RowDataPacket[];

  if (rows.length > 0) {
    await orderPartRepository.updateOrderPart(rows[0].part_id, {
      qb_description: headerText
    });
    console.log(`[Invoice Header] Updated header row for order #${orderNumber}`);
  } else {
    // Create if missing (for orders created before header row feature)
    await createHeaderRow(orderId, orderNumber, orderName, customerPo, customerJobNumber);
    console.log(`[Invoice Header] Created missing header row for order #${orderNumber}`);
  }
}

/**
 * Check if header row exists for an order
 *
 * @param orderId - The order ID
 * @returns true if header row exists
 */
export async function headerRowExists(orderId: number): Promise<boolean> {
  const rows = await query(
    `SELECT 1 FROM order_parts WHERE order_id = ? AND is_header_row = 1 LIMIT 1`,
    [orderId]
  ) as RowDataPacket[];
  return rows.length > 0;
}

/**
 * Get header row for an order
 *
 * @param orderId - The order ID
 * @returns The header row part_id and qb_description, or null if not found
 */
export async function getHeaderRow(orderId: number): Promise<{
  part_id: number;
  qb_description: string;
} | null> {
  const rows = await query(
    `SELECT part_id, qb_description FROM order_parts WHERE order_id = ? AND is_header_row = 1 LIMIT 1`,
    [orderId]
  ) as RowDataPacket[];

  if (rows.length === 0) {
    return null;
  }

  return {
    part_id: rows[0].part_id,
    qb_description: rows[0].qb_description || ''
  };
}

/**
 * Ensure header row exists (create if missing)
 * Used for on-demand creation when generating invoices/estimates for older orders
 *
 * @param orderId - The order ID
 * @param orderNumber - The order number
 * @param orderName - The order name
 * @param customerPo - Optional customer PO number
 * @param customerJobNumber - Optional customer job number
 * @returns The header row part_id
 */
export async function ensureHeaderRow(
  orderId: number,
  orderNumber: number,
  orderName: string,
  customerPo?: string | null,
  customerJobNumber?: string | null
): Promise<number> {
  const existing = await getHeaderRow(orderId);

  if (existing) {
    return existing.part_id;
  }

  return await createHeaderRow(orderId, orderNumber, orderName, customerPo, customerJobNumber);
}
