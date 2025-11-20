// File Clean up Finished: 2025-11-15 (Architecture improvement - centralized tax rate lookup)
// Changes:
//   - Added getTaxRateByName() method in HELPER METHODS section (proper repository layer)
//   - Added tax_name to getOrderWithCustomerForPDF() SELECT query
//   - Supports estimatePdfGenerator tax calculation (moved from service to repository)
//   - Uses query() helper for consistency with codebase standards
//
// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Removed duplicate updateTaskCompleted() method (was identical to updateTaskCompletion)
//   - Migrated 14 pool.execute() calls to query() helper for consistency
//   - Kept pool import for transaction support (connection?: PoolConnection parameters)
//   - All non-transactional queries now use centralized query() helper
//   - Benefits: centralized error logging, slow query detection, performance monitoring
/**
 * Order Repository
 * Data Access Layer for Orders System
 *
 * Handles all direct database operations for orders, parts, tasks, and status history
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import {
  Order,
  OrderPart,
  OrderTask,
  OrderStatusHistory,
  CreateOrderData,
  CreateOrderPartData,
  CreateOrderTaskData,
  CreateStatusHistoryData,
  UpdateOrderData,
  OrderFilters,
  EstimateForConversion,
  EstimateItem,
  ProductTypeInfo,
  OrderPointPerson,
  CreateOrderPointPersonData
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
   * Get order folder details by order_number
   * Used for PDF generation, printing operations, and image management
   */
  async getOrderFolderDetails(orderNumber: number): Promise<{
    order_id: number;
    order_number: number;
    order_name: string;
    folder_name: string;
    folder_exists: boolean;
    folder_location: 'active' | 'finished' | 'none';
    is_migrated: boolean;
  } | null> {
    const rows = await query(
      `SELECT order_id, order_number, order_name, folder_name, folder_exists, folder_location, is_migrated
       FROM orders
       WHERE order_number = ?`,
      [orderNumber]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as {
      order_id: number;
      order_number: number;
      order_name: string;
      folder_name: string;
      folder_exists: boolean;
      folder_location: 'active' | 'finished' | 'none';
      is_migrated: boolean;
    };
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
        manufacturing_note, internal_note, invoice_email, terms,
        deposit_required, invoice_notes, cash, discount, tax_name, sign_image_path,
        status, form_version, shipping_required, created_by
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
        data.invoice_email || null,
        data.terms || null,
        data.deposit_required || false,
        data.invoice_notes || null,
        data.cash || false,
        data.discount || 0,
        data.tax_name || null,
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
        (SELECT COUNT(*) FROM order_tasks WHERE order_tasks.order_id = o.order_id) as total_tasks,
        (SELECT COUNT(*) FROM order_tasks WHERE order_tasks.order_id = o.order_id AND completed = 1) as completed_tasks
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
        c.company_name as customer_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
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
    if (data.invoice_email !== undefined) {
      updates.push('invoice_email = ?');
      params.push(data.invoice_email);
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
  // ORDER PARTS OPERATIONS
  // =============================================

  /**
   * Create order part
   */
  async createOrderPart(data: CreateOrderPartData, connection?: PoolConnection): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO order_parts (
        order_id, part_number, display_number, is_parent,
        product_type, part_scope, qb_item_name, qb_description, specs_display_name, specs_qty, product_type_id,
        channel_letter_type_id, base_product_type_id,
        quantity, specifications, production_notes,
        invoice_description, unit_price, extended_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.order_id,
        data.part_number,
        data.display_number || null,
        data.is_parent || false,
        data.product_type,
        data.part_scope || null,
        data.qb_item_name || null,
        data.qb_description || null,
        data.specs_display_name || null,
        data.specs_qty || 0,
        data.product_type_id,
        data.channel_letter_type_id || null,
        data.base_product_type_id || null,
        data.quantity,
        JSON.stringify(data.specifications || {}),
        data.production_notes || null,
        data.invoice_description || null,
        data.unit_price || null,
        data.extended_price || null
      ]
    );

    return result.insertId;
  }

  /**
   * Get parts for an order
   */
  async getOrderParts(orderId: number): Promise<OrderPart[]> {
    const rows = await query(
      `SELECT * FROM order_parts WHERE order_id = ? ORDER BY part_number`,
      [orderId]
    ) as RowDataPacket[];

    return rows.map(row => ({
      ...row,
      specifications: typeof row.specifications === 'string'
        ? JSON.parse(row.specifications)
        : row.specifications
    })) as OrderPart[];
  }

  /**
   * Get a single order part by ID
   */
  async getOrderPartById(partId: number): Promise<OrderPart | null> {
    const rows = await query(
      `SELECT * FROM order_parts WHERE part_id = ?`,
      [partId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      ...row,
      specifications: typeof row.specifications === 'string'
        ? JSON.parse(row.specifications)
        : row.specifications
    } as OrderPart;
  }

  /**
   * Update order part (Phase 1.5.c)
   * Allows updating specifications and invoice fields
   */
  async updateOrderPart(partId: number, updates: {
    product_type?: string;
    part_scope?: string;
    qb_item_name?: string;
    qb_description?: string;
    specs_display_name?: string;
    specs_qty?: number;
    specifications?: any;
    invoice_description?: string;
    quantity?: number;
    unit_price?: number;
    extended_price?: number;
    production_notes?: string;
    is_parent?: boolean;
    part_number?: number;
    display_number?: string;
  }, connection?: PoolConnection): Promise<void> {
    const conn = connection || pool;
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.product_type !== undefined) {
      updateFields.push('product_type = ?');
      params.push(updates.product_type);
    }
    if (updates.part_scope !== undefined) {
      updateFields.push('part_scope = ?');
      params.push(updates.part_scope);
    }
    if (updates.qb_item_name !== undefined) {
      updateFields.push('qb_item_name = ?');
      params.push(updates.qb_item_name);
    }
    if (updates.qb_description !== undefined) {
      updateFields.push('qb_description = ?');
      params.push(updates.qb_description);
    }
    if (updates.specs_display_name !== undefined) {
      updateFields.push('specs_display_name = ?');
      params.push(updates.specs_display_name);
    }
    if (updates.specs_qty !== undefined) {
      updateFields.push('specs_qty = ?');
      params.push(updates.specs_qty);
    }
    if (updates.specifications !== undefined) {
      updateFields.push('specifications = ?');
      params.push(JSON.stringify(updates.specifications));
    }
    if (updates.invoice_description !== undefined) {
      updateFields.push('invoice_description = ?');
      params.push(updates.invoice_description);
    }
    if (updates.quantity !== undefined) {
      updateFields.push('quantity = ?');
      params.push(updates.quantity);
    }
    if (updates.unit_price !== undefined) {
      updateFields.push('unit_price = ?');
      params.push(updates.unit_price);
    }
    if (updates.extended_price !== undefined) {
      updateFields.push('extended_price = ?');
      params.push(updates.extended_price);
    }
    if (updates.production_notes !== undefined) {
      updateFields.push('production_notes = ?');
      params.push(updates.production_notes);
    }
    if (updates.is_parent !== undefined) {
      updateFields.push('is_parent = ?');
      params.push(updates.is_parent);
    }
    if (updates.part_number !== undefined) {
      updateFields.push('part_number = ?');
      params.push(updates.part_number);
    }
    if (updates.display_number !== undefined) {
      updateFields.push('display_number = ?');
      params.push(updates.display_number);
    }

    if (updateFields.length === 0) {
      return;
    }

    params.push(partId);

    await conn.execute(
      `UPDATE order_parts SET ${updateFields.join(', ')} WHERE part_id = ?`,
      params
    );
  }

  /**
   * Get available task templates (Phase 1.5.c)
   * Returns normalized task list grouped by role
   */
  async getAvailableTasks(): Promise<{
    task_name: string;
    assigned_role: string | null;
  }[]> {
    const rows = await query(
      `SELECT DISTINCT task_name, assigned_role
       FROM order_tasks
       ORDER BY assigned_role, task_name`
    ) as RowDataPacket[];

    return rows as {
      task_name: string;
      assigned_role: string | null;
    }[];
  }

  // =============================================
  // ORDER TASKS OPERATIONS
  // =============================================

  /**
   * Create order task
   */
  async createOrderTask(data: CreateOrderTaskData, connection?: PoolConnection): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO order_tasks (
        order_id, part_id, task_name, completed, assigned_role
      ) VALUES (?, ?, ?, false, ?)`,
      [data.order_id, data.part_id || null, data.task_name, data.assigned_role || null]
    );

    return result.insertId;
  }

  /**
   * Get tasks for an order
   */
  async getOrderTasks(orderId: number): Promise<OrderTask[]> {
    const rows = await query(
      `SELECT * FROM order_tasks WHERE order_id = ? ORDER BY task_id`,
      [orderId]
    ) as RowDataPacket[];

    return rows as OrderTask[];
  }

  /**
   * Update task completion status
   */
  async updateTaskCompletion(
    taskId: number,
    completed: boolean,
    userId?: number
  ): Promise<void> {
    await query(
      `UPDATE order_tasks
       SET completed = ?,
           completed_at = ${completed ? 'NOW()' : 'NULL'},
           completed_by = ?
       WHERE task_id = ?`,
      [completed, completed ? userId : null, taskId]
    );
  }

  /**
   * Delete task (Phase 1.5.c)
   * Allows removing tasks during job_details_setup phase
   */
  async deleteTask(taskId: number): Promise<void> {
    await query(
      'DELETE FROM order_tasks WHERE task_id = ?',
      [taskId]
    );
  }

  /**
   * Get tasks by role with order/customer info
   */
  async getTasksByRole(
    role: string,
    includeCompleted: boolean,
    hoursBack: number
  ): Promise<any[]> {
    const completedFilter = includeCompleted
      ? 'AND ot.completed = 1 AND ot.completed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)'
      : 'AND ot.completed = 0';

    const params = includeCompleted ? [role, hoursBack] : [role];

    const rows = await query(
      `SELECT
        ot.task_id,
        ot.task_name,
        ot.completed,
        ot.completed_at,
        ot.started_at,
        o.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        op.product_type,
        op.part_number
       FROM order_tasks ot
       JOIN orders o ON ot.order_id = o.order_id
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       LEFT JOIN order_parts op ON ot.part_id = op.part_id
       WHERE ot.assigned_role = ? ${completedFilter}
       ORDER BY o.order_number, op.part_number, ot.task_id`,
      params
    ) as RowDataPacket[];

    return rows;
  }

  /**
   * Update task started status
   */
  async updateTaskStarted(
    taskId: number,
    started: boolean,
    userId: number
  ): Promise<void> {
    await query(
      `UPDATE order_tasks
       SET started_at = ${started ? 'NOW()' : 'NULL'},
           started_by = ?
       WHERE task_id = ?`,
      [started ? userId : null, taskId]
    );
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
        u.username as changed_by_username
      FROM order_status_history h
      LEFT JOIN users u ON h.changed_by = u.user_id
      WHERE h.order_id = ?
      ORDER BY h.changed_at DESC`,
      [orderId]
    ) as RowDataPacket[];

    return rows as OrderStatusHistory[];
  }

  // =============================================
  // ESTIMATE OPERATIONS (for conversion)
  // =============================================

  /**
   * Get estimate for conversion
   */
  async getEstimateForConversion(estimateId: number, connection?: PoolConnection): Promise<EstimateForConversion | null> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT * FROM job_estimates WHERE id = ?',
      [estimateId]
    );

    return rows.length > 0 ? (rows[0] as EstimateForConversion) : null;
  }

  /**
   * Get estimate items for conversion
   */
  async getEstimateItems(estimateId: number, connection?: PoolConnection): Promise<EstimateItem[]> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT * FROM job_estimate_items
       WHERE estimate_id = ?
       ORDER BY item_order`,
      [estimateId]
    );

    return rows.map(row => ({
      ...row,
      grid_data: typeof row.grid_data === 'string'
        ? JSON.parse(row.grid_data)
        : row.grid_data
    })) as EstimateItem[];
  }

  /**
   * Update estimate status
   */
  async updateEstimateStatus(estimateId: number, status: string, connection?: PoolConnection): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      'UPDATE job_estimates SET status = ? WHERE id = ?',
      [status, estimateId]
    );
  }

  /**
   * Update estimate status and approval flag atomically
   * Used when converting 'sent' estimates directly to 'ordered' status
   */
  async updateEstimateStatusAndApproval(estimateId: number, status: string, isApproved: boolean, connection?: PoolConnection): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      'UPDATE job_estimates SET status = ?, is_approved = ?, is_draft = 0 WHERE id = ?',
      [status, isApproved ? 1 : 0, estimateId]
    );
  }

  /**
   * Get product type info
   */
  async getProductTypeInfo(productTypeId: number, connection?: PoolConnection): Promise<ProductTypeInfo | null> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT id, name, category FROM product_types WHERE id = ?',
      [productTypeId]
    );

    if (rows.length === 0) {
      return null;
    }

    const productType = rows[0];
    return {
      id: productType.id,
      name: productType.name,
      category: productType.category,
      is_channel_letter: productType.name.toLowerCase().includes('channel letter')
    };
  }

  // =============================================
  // PHASE 1.5 METHODS
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

  // =============================================
  // ORDER POINT PERSONS METHODS
  // =============================================

  /**
   * Create order point person record
   */
  async createOrderPointPerson(
    data: import('../types/orders').CreateOrderPointPersonData,
    connection?: PoolConnection
  ): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO order_point_persons (
        order_id, contact_id, contact_email, contact_name,
        contact_phone, contact_role, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.order_id,
        data.contact_id || null,
        data.contact_email,
        data.contact_name || null,
        data.contact_phone || null,
        data.contact_role || null,
        data.display_order
      ]
    );

    return result.insertId;
  }

  /**
   * Get all point persons for an order
   */
  async getOrderPointPersons(orderId: number): Promise<import('../types/orders').OrderPointPerson[]> {
    const rows = await query(
      `SELECT * FROM order_point_persons
       WHERE order_id = ?
       ORDER BY display_order ASC`,
      [orderId]
    ) as RowDataPacket[];

    return rows as import('../types/orders').OrderPointPerson[];
  }

  /**
   * Delete all point persons for an order (used during updates)
   */
  async deleteOrderPointPersons(orderId: number, connection?: PoolConnection): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      'DELETE FROM order_point_persons WHERE order_id = ?',
      [orderId]
    );
  }

  // =============================================
  // PDF GENERATION METHODS
  // =============================================

  /**
   * Get complete order data with customer info and parts for PDF generation
   */
  async getOrderWithCustomerForPDF(orderId: number): Promise<import('../types/orders').OrderDataForPDF | null> {
    // Fetch order with customer info
    const orderRows = await query(`
      SELECT
        o.order_id,
        o.order_number,
        o.order_name,
        o.order_date,
        o.due_date,
        o.hard_due_date_time,
        o.customer_po,
        o.customer_job_number,
        o.production_notes,
        o.manufacturing_note,
        o.internal_note,
        o.status,
        o.form_version,
        o.sign_image_path,
        o.crop_top,
        o.crop_right,
        o.crop_bottom,
        o.crop_left,
        o.shipping_required,
        o.tax_name,
        o.folder_name,
        o.folder_location,
        o.is_migrated,
        o.customer_id,
        c.company_name,
        c.contact_first_name,
        c.contact_last_name,
        c.phone,
        c.email,
        c.pattern_yes_or_no,
        c.pattern_type,
        c.wiring_diagram_yes_or_no
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = ?
    `, [orderId]) as RowDataPacket[];

    if (orderRows.length === 0) {
      return null;
    }

    const order = orderRows[0];

    // Fetch order parts
    const parts = await query(`
      SELECT
        part_id,
        order_id,
        part_number,
        display_number,
        is_parent,
        product_type,
        part_scope,
        specs_display_name,
        product_type_id,
        quantity,
        specifications,
        production_notes,
        qb_item_name,
        invoice_description,
        unit_price,
        extended_price
      FROM order_parts
      WHERE order_id = ?
      ORDER BY part_number
    `, [orderId]) as RowDataPacket[];

    return {
      ...order,
      parts
    } as import('../types/orders').OrderDataForPDF;
  }

  /**
   * Update order form version number
   */
  async updateOrderFormVersion(orderId: number, version: number): Promise<void> {
    await query(
      'UPDATE orders SET form_version = ? WHERE order_id = ?',
      [version, orderId]
    );
  }

  /**
   * Insert or update order form paths (upsert)
   */
  async upsertOrderFormPaths(
    orderId: number,
    version: number,
    paths: import('../types/orders').FormPaths,
    dataHash: string,
    userId?: number
  ): Promise<void> {
    // Check if version record exists
    const existing = await query(
      'SELECT version_id FROM order_form_versions WHERE order_id = ? AND version_number = ?',
      [orderId, version]
    ) as RowDataPacket[];

    if (existing.length > 0) {
      // Update existing record
      await query(
        `UPDATE order_form_versions
         SET master_form_path = ?, estimate_form_path = ?, shop_form_path = ?, customer_form_path = ?, packing_list_path = ?, data_hash = ?
         WHERE order_id = ? AND version_number = ?`,
        [paths.masterForm, paths.estimateForm, paths.shopForm, paths.customerForm, paths.packingList, dataHash, orderId, version]
      );
    } else {
      // Insert new record
      await query(
        `INSERT INTO order_form_versions
         (order_id, version_number, master_form_path, estimate_form_path, shop_form_path, customer_form_path, packing_list_path, data_hash, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, version, paths.masterForm, paths.estimateForm, paths.shopForm, paths.customerForm, paths.packingList, dataHash, userId || null]
      );
    }
  }

  /**
   * Get order form paths by order ID and optional version
   */
  async getOrderFormPaths(orderId: number, version?: number): Promise<import('../types/orders').FormPaths | null> {
    let sql = `
      SELECT master_form_path, estimate_form_path, shop_form_path, customer_form_path, packing_list_path
      FROM order_form_versions
      WHERE order_id = ?
    `;

    const params: any[] = [orderId];

    if (version) {
      sql += ' AND version_number = ?';
      params.push(version);
    } else {
      // Get latest version
      sql += ' ORDER BY version_number DESC LIMIT 1';
    }

    const rows = await query(sql, params) as RowDataPacket[];

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      masterForm: row.master_form_path,
      estimateForm: row.estimate_form_path,
      shopForm: row.shop_form_path,
      customerForm: row.customer_form_path,
      packingList: row.packing_list_path
    };
  }

  /**
   * Check if order forms exist for an order
   */
  async orderFormsExist(orderId: number): Promise<boolean> {
    const rows = await query(
      'SELECT COUNT(*) as count FROM order_form_versions WHERE order_id = ?',
      [orderId]
    ) as RowDataPacket[];

    return rows[0].count > 0;
  }

  /**
   * Check if production tasks are stale (order data changed since tasks were generated)
   * Returns staleness info including whether tasks exist and if they're stale
   * Uses same hash as QB estimates and PDFs - shared staleness detection
   */
  async checkTaskStaleness(orderId: number): Promise<{
    exists: boolean;
    isStale: boolean;
    tasksGeneratedAt: Date | null;
    currentHash: string | null;
    storedHash: string | null;
    taskCount: number;
  }> {
    // Get task generation info from orders table
    const orderRows = await query(
      `SELECT tasks_generated_at, tasks_data_hash
       FROM orders
       WHERE order_id = ?`,
      [orderId]
    ) as RowDataPacket[];

    if (orderRows.length === 0) {
      return {
        exists: false,
        isStale: false,
        tasksGeneratedAt: null,
        currentHash: null,
        storedHash: null,
        taskCount: 0
      };
    }

    const orderRow = orderRows[0];
    const tasksGeneratedAt = orderRow.tasks_generated_at;
    const storedHash = orderRow.tasks_data_hash;

    // If tasks haven't been generated yet
    if (!tasksGeneratedAt || !storedHash) {
      return {
        exists: false,
        isStale: false,
        tasksGeneratedAt: null,
        currentHash: null,
        storedHash: null,
        taskCount: 0
      };
    }

    // Count existing tasks
    const taskCountRows = await query(
      `SELECT COUNT(*) as count FROM order_tasks WHERE order_id = ?`,
      [orderId]
    ) as RowDataPacket[];
    const taskCount = taskCountRows[0].count;

    // Calculate current hash from order data (shared with QB/PDFs)
    const { calculateOrderDataHash } = await import('../services/orderDataHashService');
    const currentHash = await calculateOrderDataHash(orderId);

    // Check if stale: current data hash differs from stored hash
    const isStale = currentHash !== storedHash;

    return {
      exists: true,
      isStale,
      tasksGeneratedAt,
      currentHash,
      storedHash,
      taskCount
    };
  }

  /**
   * Check if order form PDFs are stale (order data changed since PDFs were generated)
   * Returns staleness info including whether PDFs exist and if they're stale
   */
  async checkOrderFormStaleness(orderId: number): Promise<{
    exists: boolean;
    isStale: boolean;
    pdfGeneratedAt: Date | null;
    currentHash: string | null;
    storedHash: string | null;
    formPaths: import('../types/orders').FormPaths | null;
  }> {
    // Get latest form version info
    const formRows = await query(
      `SELECT
        created_at,
        data_hash,
        master_form_path,
        estimate_form_path,
        shop_form_path,
        customer_form_path,
        packing_list_path
      FROM order_form_versions
      WHERE order_id = ?
      ORDER BY version_number DESC
      LIMIT 1`,
      [orderId]
    ) as RowDataPacket[];

    // No PDFs exist
    if (formRows.length === 0) {
      return {
        exists: false,
        isStale: false,
        pdfGeneratedAt: null,
        currentHash: null,
        storedHash: null,
        formPaths: null
      };
    }

    const formRow = formRows[0];
    const pdfGeneratedAt = formRow.created_at;
    const storedHash = formRow.data_hash;

    // Calculate current hash from order data
    const { calculateOrderDataHash } = await import('../services/orderDataHashService');
    const currentHash = await calculateOrderDataHash(orderId);

    // Check if stale: current data hash differs from stored hash
    const isStale = currentHash !== storedHash;

    return {
      exists: true,
      isStale,
      pdfGeneratedAt,
      currentHash,
      storedHash,
      formPaths: {
        masterForm: formRow.master_form_path,
        estimateForm: formRow.estimate_form_path,
        shopForm: formRow.shop_form_path,
        customerForm: formRow.customer_form_path,
        packingList: formRow.packing_list_path
      }
    };
  }

  // =====================================================
  // FOLDER TRACKING METHODS
  // =====================================================

  /**
   * Check if folder name already exists in database (case-insensitive)
   * Used to prevent duplicate folder names before filesystem operations
   */
  async checkFolderNameConflict(folderName: string): Promise<boolean> {
    const rows = await query(
      `SELECT order_id FROM orders WHERE LOWER(folder_name) = LOWER(?) LIMIT 1`,
      [folderName]
    ) as RowDataPacket[];

    return rows.length > 0;
  }

  /**
   * Get folder location for an order
   * Returns 'active', 'finished', or 'none' based on folder_location column
   */
  async getOrderFolderLocation(orderId: number): Promise<'active' | 'finished' | 'none'> {
    const rows = await query(
      `SELECT folder_location FROM orders WHERE order_id = ?`,
      [orderId]
    ) as RowDataPacket[];

    if (rows.length === 0) {
      throw new Error('Order not found');
    }

    return rows[0].folder_location as 'active' | 'finished' | 'none';
  }

  /**
   * Update folder tracking information for an order
   * Accepts optional connection parameter for transaction support
   */
  async updateFolderTracking(
    orderId: number,
    folderName: string,
    folderExists: boolean,
    folderLocation: 'active' | 'finished' | 'none',
    connection?: PoolConnection
  ): Promise<void> {
    const db = connection || pool;
    await db.execute(
      `UPDATE orders
       SET folder_name = ?,
           folder_exists = ?,
           folder_location = ?
       WHERE order_id = ?`,
      [folderName, folderExists, folderLocation, orderId]
    );
  }

  /**
   * Delete order part
   */
  async deleteOrderPart(partId: number, connection?: PoolConnection): Promise<void> {
    const db = connection || pool;
    await db.execute(
      'DELETE FROM order_parts WHERE part_id = ?',
      [partId]
    );
  }
}

export const orderRepository = new OrderRepository();
