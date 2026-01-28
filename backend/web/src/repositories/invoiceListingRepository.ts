/**
 * Invoice Listing Repository
 * Created: 2025-12-17
 *
 * Data access layer for the invoices page.
 * Fetches orders with invoice data, analytics, and manages cached balances.
 */

import { query, queryDynamic } from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  InvoiceListingOrder,
  InvoiceFilters,
  InvoiceListingResponse,
  InvoiceAnalytics
} from '../types/invoiceListing';

// =============================================
// INVOICE LISTING
// =============================================

/**
 * Get orders for the invoice listing page with filters and pagination
 */
export async function getOrdersForInvoiceListing(
  filters: InvoiceFilters
): Promise<InvoiceListingResponse> {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 50;
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions: string[] = [];
  const params: any[] = [];

  // Invoice status filter
  if (filters.invoiceStatus === 'invoiced') {
    conditions.push('o.qb_invoice_id IS NOT NULL AND o.cash = 0');
  } else if (filters.invoiceStatus === 'not_invoiced') {
    conditions.push('o.qb_invoice_id IS NULL AND o.cash = 0');
  } else if (filters.invoiceStatus === 'cash') {
    conditions.push('o.cash = 1');
  }

  // Balance status filter
  if (filters.balanceStatus === 'open') {
    conditions.push('o.qb_invoice_id IS NOT NULL AND (o.cached_balance IS NULL OR o.cached_balance > 0)');
  } else if (filters.balanceStatus === 'paid') {
    conditions.push('o.qb_invoice_id IS NOT NULL AND o.cached_balance = 0');
  }

  // Sent status filter
  if (filters.sentStatus === 'sent') {
    conditions.push('o.invoice_sent_at IS NOT NULL');
  } else if (filters.sentStatus === 'not_sent') {
    conditions.push('o.invoice_sent_at IS NULL');
  }

  // Deposit status filter
  if (filters.depositStatus === 'required') {
    conditions.push('o.deposit_required = 1 AND (o.cached_balance IS NULL OR o.cached_balance >= o.cached_invoice_total)');
  } else if (filters.depositStatus === 'paid') {
    conditions.push('o.deposit_required = 1 AND o.cached_balance < o.cached_invoice_total');
  } else if (filters.depositStatus === 'not_required') {
    conditions.push('o.deposit_required = 0');
  }

  // Order status filter
  if (filters.orderStatus) {
    conditions.push('o.status = ?');
    params.push(filters.orderStatus);
  }

  // Customer filter
  if (filters.customerId) {
    conditions.push('o.customer_id = ?');
    params.push(filters.customerId);
  }

  // Date range filter
  if (filters.dateFrom) {
    conditions.push('o.order_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('o.order_date <= ?');
    params.push(filters.dateTo);
  }

  // Search filter
  if (filters.search) {
    conditions.push(`(
      o.order_number LIKE ? OR
      o.order_name LIKE ? OR
      c.company_name LIKE ? OR
      o.qb_invoice_doc_number LIKE ?
    )`);
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Build ORDER BY
  const sortColumn = getSortColumn(filters.sortBy);
  const sortOrder = filters.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const orderByClause = `ORDER BY ${sortColumn} ${sortOrder}`;

  // Count total
  const countSql = `
    SELECT COUNT(*) as total
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    ${whereClause}
  `;
  const countResult = await queryDynamic(countSql, params) as RowDataPacket[];
  const total = countResult[0].total;

  // Get orders with calculated total
  const dataSql = `
    SELECT
      o.order_id,
      o.order_number,
      o.order_name,
      o.customer_id,
      c.company_name AS customer_name,
      o.status,
      o.order_date,
      o.due_date,
      o.qb_invoice_id,
      o.qb_invoice_doc_number,
      o.invoice_sent_at,
      o.cached_invoice_total,
      o.cached_balance,
      o.cached_balance_at,
      o.deposit_required,
      o.cash AS is_cash,
      COALESCE(parts.calculated_total, 0) AS calculated_total
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    LEFT JOIN (
      SELECT order_id, SUM(extended_price) AS calculated_total
      FROM order_parts
      WHERE is_header_row = 0 OR is_header_row IS NULL
      GROUP BY order_id
    ) parts ON o.order_id = parts.order_id
    ${whereClause}
    ${orderByClause}
    LIMIT ? OFFSET ?
  `;

  const dataParams = [...params, limit, offset];
  const rows = await queryDynamic(dataSql, dataParams) as RowDataPacket[];

  const orders: InvoiceListingOrder[] = rows.map(row => ({
    order_id: row.order_id,
    order_number: row.order_number,
    order_name: row.order_name,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    status: row.status,
    order_date: row.order_date,
    due_date: row.due_date,
    qb_invoice_id: row.qb_invoice_id,
    qb_invoice_doc_number: row.qb_invoice_doc_number,
    invoice_sent_at: row.invoice_sent_at,
    cached_invoice_total: row.cached_invoice_total ? parseFloat(row.cached_invoice_total) : null,
    cached_balance: row.cached_balance !== null ? parseFloat(row.cached_balance) : null,
    cached_balance_at: row.cached_balance_at,
    deposit_required: row.deposit_required === 1,
    deposit_paid: row.deposit_required === 1 &&
      row.cached_balance !== null &&
      row.cached_invoice_total !== null &&
      parseFloat(row.cached_balance) < parseFloat(row.cached_invoice_total),
    is_cash: row.is_cash === 1,
    calculated_total: parseFloat(row.calculated_total) || 0
  }));

  return {
    orders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Get analytics for the invoices page
 */
export async function getInvoiceAnalytics(): Promise<InvoiceAnalytics> {
  const currentYear = new Date().getFullYear();

  // YTD totals
  const ytdSql = `
    SELECT
      COUNT(*) AS order_count,
      COALESCE(SUM(
        COALESCE(o.cached_invoice_total, parts.calculated_total, 0)
      ), 0) AS total_sales
    FROM orders o
    LEFT JOIN (
      SELECT order_id, SUM(extended_price) AS calculated_total
      FROM order_parts
      WHERE is_header_row = 0 OR is_header_row IS NULL
      GROUP BY order_id
    ) parts ON o.order_id = parts.order_id
    WHERE YEAR(o.order_date) = ?
      AND o.status != 'cancelled'
  `;
  const ytdResult = await query(ytdSql, [currentYear]) as RowDataPacket[];

  // Uninvoiced orders (YTD)
  const uninvoicedSql = `
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(
        COALESCE(parts.calculated_total, 0)
      ), 0) AS total
    FROM orders o
    LEFT JOIN (
      SELECT order_id, SUM(extended_price) AS calculated_total
      FROM order_parts
      WHERE is_header_row = 0 OR is_header_row IS NULL
      GROUP BY order_id
    ) parts ON o.order_id = parts.order_id
    WHERE YEAR(o.order_date) = ?
      AND o.qb_invoice_id IS NULL
      AND o.status != 'cancelled'
  `;
  const uninvoicedResult = await query(uninvoicedSql, [currentYear]) as RowDataPacket[];

  // Open invoices (YTD - invoiced but balance > 0)
  const openSql = `
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(COALESCE(o.cached_invoice_total, 0)), 0) AS total,
      COALESCE(SUM(COALESCE(o.cached_balance, o.cached_invoice_total, 0)), 0) AS balance
    FROM orders o
    WHERE YEAR(o.order_date) = ?
      AND o.qb_invoice_id IS NOT NULL
      AND (o.cached_balance IS NULL OR o.cached_balance > 0)
      AND o.status != 'cancelled'
  `;
  const openResult = await query(openSql, [currentYear]) as RowDataPacket[];

  // Paid invoices (YTD - balance = 0)
  const paidSql = `
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(COALESCE(o.cached_invoice_total, 0)), 0) AS total
    FROM orders o
    WHERE YEAR(o.order_date) = ?
      AND o.qb_invoice_id IS NOT NULL
      AND o.cached_balance = 0
      AND o.status != 'cancelled'
  `;
  const paidResult = await query(paidSql, [currentYear]) as RowDataPacket[];

  // Overdue (before current year with open balance)
  const overdueSql = `
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(COALESCE(o.cached_invoice_total, 0)), 0) AS total,
      COALESCE(SUM(COALESCE(o.cached_balance, o.cached_invoice_total, 0)), 0) AS balance
    FROM orders o
    WHERE YEAR(o.order_date) < ?
      AND o.qb_invoice_id IS NOT NULL
      AND (o.cached_balance IS NULL OR o.cached_balance > 0)
      AND o.status != 'cancelled'
  `;
  const overdueResult = await query(overdueSql, [currentYear]) as RowDataPacket[];

  return {
    ytdTotalSales: parseFloat(ytdResult[0].total_sales) || 0,
    ytdOrderCount: ytdResult[0].order_count || 0,
    uninvoiced: {
      count: uninvoicedResult[0].count || 0,
      total: parseFloat(uninvoicedResult[0].total) || 0
    },
    openInvoices: {
      count: openResult[0].count || 0,
      total: parseFloat(openResult[0].total) || 0,
      balance: parseFloat(openResult[0].balance) || 0
    },
    paidInvoices: {
      count: paidResult[0].count || 0,
      total: parseFloat(paidResult[0].total) || 0
    },
    overdue: {
      count: overdueResult[0].count || 0,
      total: parseFloat(overdueResult[0].total) || 0,
      balance: parseFloat(overdueResult[0].balance) || 0
    }
  };
}

// =============================================
// BALANCE CACHE MANAGEMENT
// =============================================

/**
 * Update cached balance for an order
 */
export async function updateCachedBalance(
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
 * Get orders that need balance sync (have invoice but no cached balance, or stale cache)
 */
export async function getOrdersNeedingBalanceSync(
  limit: number = 50,
  staleHours: number = 24
): Promise<Array<{ order_id: number; order_number: number; qb_invoice_id: string }>> {
  const rows = await query(
    `SELECT order_id, order_number, qb_invoice_id
     FROM orders
     WHERE qb_invoice_id IS NOT NULL
       AND (
         cached_balance IS NULL
         OR cached_balance_at IS NULL
         OR cached_balance_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
       )
       AND (cached_balance IS NULL OR cached_balance > 0)
     ORDER BY cached_balance_at ASC NULLS FIRST
     LIMIT ?`,
    [staleHours, limit]
  ) as RowDataPacket[];

  return rows.map(row => ({
    order_id: row.order_id,
    order_number: row.order_number,
    qb_invoice_id: row.qb_invoice_id
  }));
}

/**
 * Get order by ID with invoice data for sync
 */
export async function getOrderForBalanceSync(orderId: number): Promise<{
  order_id: number;
  order_number: number;
  qb_invoice_id: string | null;
  cached_balance: number | null;
  status: string;
} | null> {
  const rows = await query(
    `SELECT order_id, order_number, qb_invoice_id, cached_balance, status
     FROM orders
     WHERE order_id = ?`,
    [orderId]
  ) as RowDataPacket[];

  if (rows.length === 0) return null;

  return {
    order_id: rows[0].order_id,
    order_number: rows[0].order_number,
    qb_invoice_id: rows[0].qb_invoice_id,
    cached_balance: rows[0].cached_balance !== null ? parseFloat(rows[0].cached_balance) : null,
    status: rows[0].status
  };
}

/**
 * Get all orders in awaiting_payment status (both QB invoices and cash jobs)
 * Used for automatic payment checking
 */
export async function getAwaitingPaymentOrders(): Promise<Array<{
  order_id: number;
  order_number: number;
  qb_invoice_id: string | null;
  is_cash: boolean;
}>> {
  const rows = await query(
    `SELECT order_id, order_number, qb_invoice_id, cash
     FROM orders
     WHERE status = 'awaiting_payment'
       AND (qb_invoice_id IS NOT NULL OR cash = 1)`,
    []
  ) as RowDataPacket[];

  return rows.map(row => ({
    order_id: row.order_id,
    order_number: row.order_number,
    qb_invoice_id: row.qb_invoice_id,
    is_cash: row.cash === 1
  }));
}

/**
 * Get order ID by QB invoice ID
 */
export async function getOrderIdByQBInvoiceId(qbInvoiceId: string): Promise<number | null> {
  const rows = await query(
    `SELECT order_id FROM orders WHERE qb_invoice_id = ?`,
    [qbInvoiceId]
  ) as RowDataPacket[];

  if (rows.length === 0) return null;
  return rows[0].order_id;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function getSortColumn(sortBy?: string): string {
  switch (sortBy) {
    case 'customer_name':
      return 'c.company_name';
    case 'order_date':
      return 'o.order_date';
    case 'due_date':
      return 'o.due_date';
    case 'total':
      // Use column alias from SELECT clause
      return 'calculated_total';
    case 'balance':
      return 'COALESCE(o.cached_balance, 0)';
    case 'invoice_number':
      return 'o.qb_invoice_doc_number';
    case 'order_number':
    default:
      return 'o.order_number';
  }
}
