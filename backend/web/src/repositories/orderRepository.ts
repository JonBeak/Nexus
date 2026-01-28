/**
 * Order Repository
 * Data Access Layer for Core Order Operations
 *
 * Refactored: 2025-11-21
 * Split into focused repositories:
 * - orderRepository.ts (this file): Core order CRUD, status, helpers
 * - orderPartRepository.ts: Parts and tasks
 * - orderFormRepository.ts: PDF and folder operations
 * - orderConversionRepository.ts: Estimate conversion
 *
 * This file maintains backward compatibility by re-exporting
 * methods from the new repositories during migration.
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import {
  Order,
  OrderStatusHistory,
  CreateOrderData,
  CreateStatusHistoryData,
  UpdateOrderData,
  OrderFilters
} from '../types/orders';

export class OrderRepository {

  // =============================================
  // HELPER METHODS
  // =============================================

  /**
   * Get order_id from order_number
   */
  async getOrderIdFromOrderNumber(orderNumber: number): Promise<number | null> {
    const rows = await query(
      'SELECT order_id FROM orders WHERE order_number = ?',
      [orderNumber]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    return rows[0].order_id;
  }

  /**
   * Get customer's tax from billing address for an order
   * Used when unchecking cash job to restore proper tax
   */
  async getCustomerTaxFromBillingAddress(orderId: number): Promise<string | null> {
    const rows = await query(
      `SELECT pt.tax_name
       FROM orders o
       JOIN customer_addresses ca ON o.customer_id = ca.customer_id
       LEFT JOIN provinces_tax pt ON ca.province_state_short = pt.province_short
       WHERE o.order_id = ?
         AND ca.is_billing = 1
         AND ca.is_active = 1
         AND pt.is_active = 1
       LIMIT 1`,
      [orderId]
    ) as RowDataPacket[];

    // If no billing address, try primary address as fallback
    if (rows.length === 0) {
      const primaryRows = await query(
        `SELECT pt.tax_name
         FROM orders o
         JOIN customer_addresses ca ON o.customer_id = ca.customer_id
         LEFT JOIN provinces_tax pt ON ca.province_state_short = pt.province_short
         WHERE o.order_id = ?
           AND ca.is_primary = 1
           AND ca.is_active = 1
           AND pt.is_active = 1
         LIMIT 1`,
        [orderId]
      ) as RowDataPacket[];

      if (primaryRows.length === 0) {
        return null;
      }

      return primaryRows[0].tax_name;
    }

    return rows[0].tax_name;
  }

  /**
   * Get tax rate by tax name
   * Used by PDF generators to calculate tax amounts
   */
  async getTaxRateByName(taxName: string): Promise<number> {
    const rows = await query(
      'SELECT tax_percent FROM tax_rules WHERE tax_name = ? AND is_active = 1',
      [taxName]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      console.warn(`[OrderRepository] Tax rate not found for: ${taxName}`);
      return 0;
    }

    return Number(rows[0].tax_percent);
  }

  // =============================================
  // ORDER CRUD OPERATIONS
  // =============================================

  /**
   * Create a new order
   */
  async createOrder(data: CreateOrderData, connection?: PoolConnection): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO orders (
        order_number, version_number, order_name, estimate_id,
        customer_id, customer_po, customer_job_number,
        order_date, due_date, hard_due_date_time, production_notes,
        manufacturing_note, internal_note, terms,
        deposit_required, invoice_notes, cash, discount, tax_name, accounting_emails,
        sign_image_path, status, form_version, shipping_required, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.order_number,
        data.version_number || 1,
        data.order_name,
        data.estimate_id || null,
        data.customer_id,
        data.customer_po || null,
        data.customer_job_number || null,
        data.order_date,
        data.due_date || null,
        data.hard_due_date_time || null,
        data.production_notes || null,
        data.manufacturing_note || null,
        data.internal_note || null,
        data.terms || null,
        data.deposit_required || false,
        data.invoice_notes || null,
        data.cash || false,
        data.discount || 0,
        data.tax_name || null,
        data.accounting_emails ? JSON.stringify(data.accounting_emails) : null,
        data.sign_image_path || null,
        data.status || 'job_details_setup',
        data.form_version || 1,
        data.shipping_required || false,
        data.created_by
      ]
    );

    return result.insertId;
  }

  /**
   * Get all orders with optional filters
   * Includes progress aggregation (total_tasks, completed_tasks)
   */
  async getOrders(filters: OrderFilters): Promise<Order[]> {
    let sql = `
      SELECT
        o.*,
        TIME_FORMAT(o.hard_due_date_time, '%H:%i') as hard_due_date_time,
        c.company_name as customer_name,
        (SELECT COUNT(*) FROM order_tasks ot
         INNER JOIN order_parts op ON ot.part_id = op.part_id
         WHERE ot.order_id = o.order_id
         AND (op.is_parent = 1 OR op.is_order_wide = 1)) as total_tasks,
        (SELECT COUNT(*) FROM order_tasks ot
         INNER JOIN order_parts op ON ot.part_id = op.part_id
         WHERE ot.order_id = o.order_id AND ot.completed = 1
         AND (op.is_parent = 1 OR op.is_order_wide = 1)) as completed_tasks,
        (SELECT COUNT(*) FROM order_tasks WHERE order_tasks.order_id = o.order_id AND assigned_role = 'painter' AND completed = 0) as incomplete_painting_tasks_count
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      WHERE 1=1
        AND (o.is_migrated = 0 OR o.is_migrated IS NULL)
    `;

    const params: any[] = [];

    if (filters.status) {
      sql += ` AND o.status = ?`;
      params.push(filters.status);
    }

    if (filters.customer_id) {
      sql += ` AND o.customer_id = ?`;
      params.push(filters.customer_id);
    }

    if (filters.search) {
      sql += ` AND (o.order_number LIKE ? OR o.order_name LIKE ? OR c.company_name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += ` ORDER BY o.created_at DESC`;

    // NOTE: Using literal values for LIMIT/OFFSET instead of placeholders
    // MySQL prepared statements with LIMIT ? don't work well with correlated subqueries
    if (filters.limit !== undefined) {
      const limit = parseInt(String(filters.limit));
      if (isNaN(limit) || limit < 0) {
        throw new Error('Invalid limit value');
      }
      sql += ` LIMIT ${limit}`;

      if (filters.offset !== undefined && filters.offset > 0) {
        const offset = parseInt(String(filters.offset));
        if (isNaN(offset) || offset < 0) {
          throw new Error('Invalid offset value');
        }
        sql += ` OFFSET ${offset}`;
      }
    }

    const rows = await query(sql, params) as RowDataPacket[];
    return rows as Order[];
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: number): Promise<Order | null> {
    const rows = await query(
      `SELECT
        o.*,
        TIME_FORMAT(o.hard_due_date_time, '%H:%i') as hard_due_date_time,
        c.company_name as customer_name,
        e.qb_estimate_id,
        e.qb_estimate_number AS qb_estimate_doc_number
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN order_qb_estimates e ON o.order_id = e.order_id AND e.is_current = 1
      WHERE o.order_id = ?`,
      [orderId]
    ) as RowDataPacket[];

    return rows.length > 0 ? (rows[0] as Order) : null;
  }

  /**
   * Update order
   */
  async updateOrder(orderId: number, data: UpdateOrderData): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.order_name !== undefined) {
      updates.push('order_name = ?');
      params.push(data.order_name);
    }
    if (data.customer_po !== undefined) {
      updates.push('customer_po = ?');
      params.push(data.customer_po);
    }
    if (data.customer_job_number !== undefined) {
      updates.push('customer_job_number = ?');
      params.push(data.customer_job_number);
    }
    if (data.due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(data.due_date);
    }
    if (data.hard_due_date_time !== undefined) {
      updates.push('hard_due_date_time = ?');
      params.push(data.hard_due_date_time);
    }
    if (data.production_notes !== undefined) {
      updates.push('production_notes = ?');
      params.push(data.production_notes);
    }
    if (data.manufacturing_note !== undefined) {
      updates.push('manufacturing_note = ?');
      params.push(data.manufacturing_note);
    }
    if (data.internal_note !== undefined) {
      updates.push('internal_note = ?');
      params.push(data.internal_note);
    }
    if (data.terms !== undefined) {
      updates.push('terms = ?');
      params.push(data.terms);
    }
    if (data.deposit_required !== undefined) {
      updates.push('deposit_required = ?');
      params.push(data.deposit_required);
    }
    if (data.invoice_notes !== undefined) {
      updates.push('invoice_notes = ?');
      params.push(data.invoice_notes);
    }
    if (data.cash !== undefined) {
      updates.push('cash = ?');
      params.push(data.cash);
    }
    // Note: discount is per-customer, not per-order. It should not be updated here.
    if (data.tax_name !== undefined) {
      updates.push('tax_name = ?');
      params.push(data.tax_name);
    }
    if (data.shipping_required !== undefined) {
      updates.push('shipping_required = ?');
      params.push(data.shipping_required);
    }

    if (updates.length === 0) {
      return;
    }

    params.push(orderId);

    await query(
      `UPDATE orders SET ${updates.join(', ')} WHERE order_id = ?`,
      params
    );
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: number, status: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      'UPDATE orders SET status = ? WHERE order_id = ?',
      [status, orderId]
    );
  }

  /**
   * Update job image and crop coordinates for an order
   * Used by order image management endpoints
   */
  async updateJobImage(
    orderId: number,
    filename: string,
    cropCoords: { top: number; right: number; bottom: number; left: number }
  ): Promise<void> {
    await query(
      `UPDATE orders
       SET sign_image_path = ?,
           crop_top = ?,
           crop_right = ?,
           crop_bottom = ?,
           crop_left = ?
       WHERE order_id = ?`,
      [filename, cropCoords.top, cropCoords.right, cropCoords.bottom, cropCoords.left, orderId]
    );
  }

  /**
   * Delete order
   */
  async deleteOrder(orderId: number): Promise<void> {
    await query('DELETE FROM orders WHERE order_id = ?', [orderId]);
  }

  /**
   * Get next order number (sequential starting at 200000)
   */
  async getNextOrderNumber(connection?: PoolConnection): Promise<number> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT MAX(order_number) as max_order_number FROM orders'
    );

    const maxOrderNumber = rows[0]?.max_order_number;
    return maxOrderNumber ? maxOrderNumber + 1 : 200000;
  }

  // =============================================
  // ORDER STATUS HISTORY OPERATIONS
  // =============================================

  /**
   * Create status history entry
   */
  async createStatusHistory(data: CreateStatusHistoryData, connection?: PoolConnection): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES (?, ?, ?, ?)`,
      [data.order_id, data.status, data.changed_by, data.notes || null]
    );

    return result.insertId;
  }

  /**
   * Get status history for an order
   */
  async getStatusHistory(orderId: number): Promise<OrderStatusHistory[]> {
    const rows = await query(
      `SELECT
        h.*,
        u.username as changed_by_username,
        u.first_name as changed_by_first_name,
        u.last_name as changed_by_last_name
      FROM order_status_history h
      LEFT JOIN users u ON h.changed_by = u.user_id
      WHERE h.order_id = ?
      ORDER BY h.changed_at DESC`,
      [orderId]
    ) as RowDataPacket[];

    return rows as OrderStatusHistory[];
  }

  // =============================================
  // VALIDATION HELPERS
  // =============================================

  /**
   * Check if an order already exists for an estimate
   * Returns the order if it exists, null otherwise
   */
  async getOrderByEstimateId(estimateId: number): Promise<{ order_id: number; order_number: number } | null> {
    const rows = await query(
      'SELECT order_id, order_number FROM orders WHERE estimate_id = ? LIMIT 1',
      [estimateId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    return {
      order_id: rows[0].order_id,
      order_number: rows[0].order_number
    };
  }

  /**
   * Check if an order name is unique for a customer (case-insensitive)
   * Returns true if unique, false if duplicate exists
   */
  async isOrderNameUniqueForCustomer(orderName: string, customerId: number, excludeOrderId?: number): Promise<boolean> {
    let sql = 'SELECT COUNT(*) as count FROM orders WHERE LOWER(order_name) = LOWER(?) AND customer_id = ?';
    const params: any[] = [orderName, customerId];

    // Exclude specific order_id (for update operations)
    if (excludeOrderId) {
      sql += ' AND order_id != ?';
      params.push(excludeOrderId);
    }

    const rows = await query(sql, params) as RowDataPacket[];

    return rows[0].count === 0;
  }

  /**
   * Update order accounting emails JSON column
   */
  async updateOrderAccountingEmails(
    orderId: number,
    accountingEmails: Array<{ email: string; email_type: 'to' | 'cc' | 'bcc'; label?: string }>
  ): Promise<void> {
    await query(
      'UPDATE orders SET accounting_emails = ? WHERE order_id = ?',
      [JSON.stringify(accountingEmails), orderId]
    );
  }

  // =============================================
  // KANBAN BOARD OPTIMIZED QUERY
  // =============================================

  /**
   * Get orders optimized for Kanban board display
   * Returns orders with pre-computed fields for all statuses
   * Handles filtering for completed/cancelled columns
   */
  async getOrdersForKanban(options: {
    showAllCompleted?: boolean;
    showAllCancelled?: boolean;
  } = {}): Promise<{
    orders: any[];
    holidays: string[];
  }> {
    // Get holidays for work day calculation
    const holidayRows = await query(
      `SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date
       FROM company_holidays
       WHERE is_active = 1
         AND holiday_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         AND holiday_date <= DATE_ADD(CURDATE(), INTERVAL 365 DAY)`
    ) as RowDataPacket[];

    const holidays = holidayRows.map(h => h.holiday_date);

    // Build dynamic WHERE for completed/cancelled filtering
    let completedFilter = '';
    let cancelledFilter = '';

    if (!options.showAllCompleted) {
      // Only show completed orders with due_date in last 2 weeks
      completedFilter = `AND (o.status != 'completed' OR o.due_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) OR o.due_date IS NULL)`;
    }

    if (!options.showAllCancelled) {
      // Only show cancelled orders with due_date in last 2 weeks
      cancelledFilter = `AND (o.status != 'cancelled' OR o.due_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) OR o.due_date IS NULL)`;
    }

    const sql = `
      SELECT
        o.order_id,
        o.order_number,
        o.order_name,
        o.status,
        DATE_FORMAT(o.due_date, '%Y-%m-%d') as due_date,
        o.customer_id,
        c.company_name as customer_name,
        o.shipping_required,
        o.invoice_sent_at,
        o.sign_image_path,
        o.folder_name,
        o.folder_location,
        o.is_migrated,
        (SELECT COUNT(*) FROM order_tasks ot
         INNER JOIN order_parts op ON ot.part_id = op.part_id
         WHERE ot.order_id = o.order_id
         AND (op.is_parent = 1 OR op.is_order_wide = 1)) as total_tasks,
        (SELECT COUNT(*) FROM order_tasks ot
         INNER JOIN order_parts op ON ot.part_id = op.part_id
         WHERE ot.order_id = o.order_id AND ot.completed = 1
         AND (op.is_parent = 1 OR op.is_order_wide = 1)) as completed_tasks,
        (SELECT COUNT(*) FROM order_tasks
         WHERE order_tasks.order_id = o.order_id
         AND assigned_role = 'painter'
         AND completed = 0) as incomplete_painting_tasks_count
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      WHERE 1=1
        AND (o.is_migrated = 0 OR o.is_migrated IS NULL)
        ${completedFilter}
        ${cancelledFilter}
      ORDER BY
        CASE WHEN o.due_date IS NULL THEN 1 ELSE 0 END,
        o.due_date ASC
    `;

    const orders = await query(sql) as RowDataPacket[];

    return {
      orders: orders as any[],
      holidays
    };
  }

  /**
   * Get total counts for completed and cancelled orders
   * Used for "show all" button counts
   */
  async getKanbanStatusCounts(): Promise<{ completed: number; cancelled: number }> {
    const rows = await query(`
      SELECT
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM orders
      WHERE (is_migrated = 0 OR is_migrated IS NULL)
    `) as RowDataPacket[];

    return {
      completed: rows[0]?.completed || 0,
      cancelled: rows[0]?.cancelled || 0
    };
  }
}

export const orderRepository = new OrderRepository();
