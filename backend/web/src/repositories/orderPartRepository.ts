/**
 * Order Part Repository
 * Data Access Layer for Order Parts and Tasks
 *
 * Extracted from orderRepository.ts - 2025-11-21
 * Handles all direct database operations for order parts and production tasks
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import {
  OrderPart,
  OrderTask,
  CreateOrderPartData,
  CreateOrderTaskData
} from '../types/orders';

export class OrderPartRepository {

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
   * Delete order part
   */
  async deleteOrderPart(partId: number, connection?: PoolConnection): Promise<void> {
    const db = connection || pool;
    await db.execute(
      'DELETE FROM order_parts WHERE part_id = ?',
      [partId]
    );
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
      `SELECT * FROM order_tasks WHERE order_id = ? ORDER BY sort_order, task_id`,
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
   * Update task notes
   */
  async updateTaskNotes(taskId: number, notes: string | null): Promise<void> {
    await query(
      'UPDATE order_tasks SET notes = ? WHERE task_id = ?',
      [notes, taskId]
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
        ot.notes as task_notes,
        o.order_id,
        o.order_number,
        o.order_name,
        c.company_name as customer_name,
        op.specs_display_name,
        op.part_scope,
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

  /**
   * Get available task templates (Phase 1.5.c)
   * Returns all defined tasks from TASK_ROLE_MAP, sorted by TASK_ORDER
   */
  async getAvailableTasks(): Promise<{
    task_name: string;
    assigned_role: string | null;
  }[]> {
    const { TASK_ROLE_MAP, TASK_ORDER } = await import('../services/taskGeneration/taskRules');

    // Build list from static TASK_ROLE_MAP, sorted by TASK_ORDER
    const tasks = Object.entries(TASK_ROLE_MAP).map(([task_name, assigned_role]) => ({
      task_name,
      assigned_role
    }));

    // Sort by TASK_ORDER position
    tasks.sort((a, b) => {
      const orderA = TASK_ORDER.indexOf(a.task_name);
      const orderB = TASK_ORDER.indexOf(b.task_name);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    });

    return tasks;
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
    const { calculateOrderDataHash } = await import('../utils/orderDataHashService');
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
}

export const orderPartRepository = new OrderPartRepository();
