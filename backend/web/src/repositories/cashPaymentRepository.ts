/**
 * Cash Payment Repository
 * Created: 2025-01-27
 *
 * Data access layer for cash_payments table.
 * Handles CRUD operations and balance calculations for cash job payments.
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// =============================================
// TYPES
// =============================================

export interface CashPayment {
  payment_id: number;
  order_id: number;
  amount: number;
  payment_method: 'cash' | 'e_transfer' | 'check';
  payment_date: string;
  reference_number: string | null;
  memo: string | null;
  created_by: number;
  created_at: string;
  // Joined fields
  created_by_name?: string;
}

export interface CreateCashPaymentInput {
  order_id: number;
  amount: number;
  payment_method: 'cash' | 'e_transfer' | 'check';
  payment_date: string;
  reference_number?: string;
  memo?: string;
  created_by: number;
}

// =============================================
// CRUD OPERATIONS
// =============================================

/**
 * Create a new cash payment
 */
export async function createPayment(input: CreateCashPaymentInput): Promise<number> {
  const result = await query(
    `INSERT INTO cash_payments (order_id, amount, payment_method, payment_date, reference_number, memo, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.order_id,
      input.amount,
      input.payment_method,
      input.payment_date,
      input.reference_number || null,
      input.memo || null,
      input.created_by
    ]
  ) as ResultSetHeader;

  return result.insertId;
}

/**
 * Get a payment by ID
 */
export async function getPaymentById(paymentId: number): Promise<CashPayment | null> {
  const rows = await query(
    `SELECT cp.*, CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
     FROM cash_payments cp
     LEFT JOIN users u ON cp.created_by = u.user_id
     WHERE cp.payment_id = ?`,
    [paymentId]
  ) as RowDataPacket[];

  if (rows.length === 0) return null;

  return mapRowToPayment(rows[0]);
}

/**
 * Get all payments for an order
 */
export async function getPaymentsByOrderId(orderId: number): Promise<CashPayment[]> {
  const rows = await query(
    `SELECT cp.*, CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
     FROM cash_payments cp
     LEFT JOIN users u ON cp.created_by = u.user_id
     WHERE cp.order_id = ?
     ORDER BY cp.payment_date DESC, cp.created_at DESC`,
    [orderId]
  ) as RowDataPacket[];

  return rows.map(mapRowToPayment);
}

/**
 * Delete a payment by ID
 */
export async function deletePayment(paymentId: number): Promise<boolean> {
  const result = await query(
    `DELETE FROM cash_payments WHERE payment_id = ?`,
    [paymentId]
  ) as ResultSetHeader;

  return result.affectedRows > 0;
}

// =============================================
// BALANCE CALCULATIONS
// =============================================

/**
 * Calculate the total of all cash payments for an order
 */
export async function getTotalPaymentsForOrder(orderId: number): Promise<number> {
  const rows = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM cash_payments
     WHERE order_id = ?`,
    [orderId]
  ) as RowDataPacket[];

  return parseFloat(rows[0].total_paid) || 0;
}

/**
 * Calculate the order total from order_parts (non-header rows)
 */
export async function calculateOrderTotal(orderId: number): Promise<number> {
  const rows = await query(
    `SELECT COALESCE(SUM(extended_price), 0) AS total
     FROM order_parts
     WHERE order_id = ?
       AND (is_header_row = 0 OR is_header_row IS NULL)`,
    [orderId]
  ) as RowDataPacket[];

  return parseFloat(rows[0].total) || 0;
}

/**
 * Get order cash status and balance info
 */
export async function getOrderCashInfo(orderId: number): Promise<{
  order_id: number;
  order_number: number;
  is_cash: boolean;
  status: string;
  cached_balance: number | null;
  cached_invoice_total: number | null;
} | null> {
  const rows = await query(
    `SELECT order_id, order_number, cash AS is_cash, status, cached_balance, cached_invoice_total
     FROM orders
     WHERE order_id = ?`,
    [orderId]
  ) as RowDataPacket[];

  if (rows.length === 0) return null;

  return {
    order_id: rows[0].order_id,
    order_number: rows[0].order_number,
    is_cash: rows[0].is_cash === 1,
    status: rows[0].status,
    cached_balance: rows[0].cached_balance !== null ? parseFloat(rows[0].cached_balance) : null,
    cached_invoice_total: rows[0].cached_invoice_total !== null ? parseFloat(rows[0].cached_invoice_total) : null
  };
}

/**
 * Update order's cached balance and total
 */
export async function updateOrderCachedBalance(
  orderId: number,
  balance: number,
  total: number
): Promise<void> {
  await query(
    `UPDATE orders
     SET cached_balance = ?,
         cached_invoice_total = ?,
         cached_balance_at = NOW()
     WHERE order_id = ?`,
    [balance, total, orderId]
  );
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId: number, status: string): Promise<void> {
  await query(
    `UPDATE orders SET status = ? WHERE order_id = ?`,
    [status, orderId]
  );
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function mapRowToPayment(row: RowDataPacket): CashPayment {
  return {
    payment_id: row.payment_id,
    order_id: row.order_id,
    amount: parseFloat(row.amount),
    payment_method: row.payment_method,
    payment_date: row.payment_date,
    reference_number: row.reference_number,
    memo: row.memo,
    created_by: row.created_by,
    created_at: row.created_at,
    created_by_name: row.created_by_name
  };
}
