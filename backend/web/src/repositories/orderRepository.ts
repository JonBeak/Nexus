/**
 * Order Repository
 * Data Access Layer for Orders System
 *
 * Handles all direct database operations for orders, parts, tasks, and status history
 */

import { pool } from '../config/database';
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
  ProductTypeInfo
} from '../types/orders';

export class OrderRepository {

  // =============================================
  // HELPER METHODS
  // =============================================

  /**
   * Get order_id from order_number
   */
  async getOrderIdFromOrderNumber(orderNumber: number): Promise<number | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT order_id FROM orders WHERE order_number = ?',
      [orderNumber]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0].order_id;
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
        customer_id, customer_po, point_person_email,
        order_date, due_date, production_notes, sign_image_path,
        status, form_version, shipping_required, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.order_number,
        data.version_number || 1,
        data.order_name,
        data.estimate_id || null,
        data.customer_id,
        data.customer_po || null,
        data.point_person_email || null,
        data.order_date,
        data.due_date || null,
        data.production_notes || null,
        data.sign_image_path || null,
        data.status || 'initiated',
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
        c.company_name as customer_name,
        (SELECT COUNT(*) FROM order_tasks WHERE order_tasks.order_id = o.order_id) as total_tasks,
        (SELECT COUNT(*) FROM order_tasks WHERE order_tasks.order_id = o.order_id AND completed = 1) as completed_tasks
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      WHERE 1=1
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

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as Order[];
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: number): Promise<Order | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        o.*,
        c.company_name as customer_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = ?`,
      [orderId]
    );

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
    if (data.point_person_email !== undefined) {
      updates.push('point_person_email = ?');
      params.push(data.point_person_email);
    }
    if (data.due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(data.due_date);
    }
    if (data.production_notes !== undefined) {
      updates.push('production_notes = ?');
      params.push(data.production_notes);
    }
    if (data.shipping_required !== undefined) {
      updates.push('shipping_required = ?');
      params.push(data.shipping_required);
    }

    if (updates.length === 0) {
      return;
    }

    params.push(orderId);

    await pool.execute(
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
   * Delete order
   */
  async deleteOrder(orderId: number): Promise<void> {
    await pool.execute('DELETE FROM orders WHERE order_id = ?', [orderId]);
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
        order_id, part_number, product_type, product_type_id,
        channel_letter_type_id, base_product_type_id,
        quantity, specifications, production_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.order_id,
        data.part_number,
        data.product_type,
        data.product_type_id,
        data.channel_letter_type_id || null,
        data.base_product_type_id || null,
        data.quantity,
        JSON.stringify(data.specifications || {}),
        data.production_notes || null
      ]
    );

    return result.insertId;
  }

  /**
   * Get parts for an order
   */
  async getOrderParts(orderId: number): Promise<OrderPart[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM order_parts WHERE order_id = ? ORDER BY part_number`,
      [orderId]
    );

    return rows.map(row => ({
      ...row,
      specifications: typeof row.specifications === 'string'
        ? JSON.parse(row.specifications)
        : row.specifications
    })) as OrderPart[];
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
        order_id, part_id, task_name, task_order, completed, assigned_role
      ) VALUES (?, ?, ?, ?, false, ?)`,
      [data.order_id, data.part_id || null, data.task_name, data.task_order, data.assigned_role || null]
    );

    return result.insertId;
  }

  /**
   * Get tasks for an order
   */
  async getOrderTasks(orderId: number): Promise<OrderTask[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM order_tasks WHERE order_id = ? ORDER BY task_order`,
      [orderId]
    );

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
    await pool.execute(
      `UPDATE order_tasks
       SET completed = ?,
           completed_at = ${completed ? 'NOW()' : 'NULL'},
           completed_by = ?
       WHERE task_id = ?`,
      [completed, completed ? userId : null, taskId]
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

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        ot.task_id,
        ot.task_name,
        ot.task_order,
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
       ORDER BY o.order_number, op.part_number, ot.task_order`,
      params
    );

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
    await pool.execute(
      `UPDATE order_tasks
       SET started_at = ${started ? 'NOW()' : 'NULL'},
           started_by = ?
       WHERE task_id = ?`,
      [started ? userId : null, taskId]
    );
  }

  /**
   * Update task completed status
   */
  async updateTaskCompleted(
    taskId: number,
    completed: boolean,
    userId: number
  ): Promise<void> {
    await pool.execute(
      `UPDATE order_tasks
       SET completed = ?,
           completed_at = ${completed ? 'NOW()' : 'NULL'},
           completed_by = ?
       WHERE task_id = ?`,
      [completed, completed ? userId : null, taskId]
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
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        h.*,
        u.username as changed_by_username
      FROM order_status_history h
      LEFT JOIN users u ON h.changed_by = u.user_id
      WHERE h.order_id = ?
      ORDER BY h.changed_at DESC`,
      [orderId]
    );

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
}

export const orderRepository = new OrderRepository();
