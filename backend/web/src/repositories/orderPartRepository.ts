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
  CreateOrderTaskData,
  OrderPartImportInstruction
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
        order_id, part_number, is_header_row, is_order_wide, display_number, is_parent,
        product_type, part_scope, qb_item_name, qb_description, specs_display_name, specs_qty, product_type_id,
        channel_letter_type_id, base_product_type_id,
        quantity, specifications, production_notes,
        invoice_description, unit_price, extended_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.order_id,
        data.part_number,
        data.is_header_row || false,
        data.is_order_wide || false,
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
   * Get tasks for an order with session counts
   */
  async getOrderTasks(orderId: number): Promise<OrderTask[]> {
    const rows = await query(
      `SELECT
        ot.*,
        (SELECT COUNT(*) FROM task_sessions ts WHERE ts.task_id = ot.task_id AND ts.ended_at IS NULL) as active_sessions_count,
        (SELECT COUNT(*) FROM task_sessions ts WHERE ts.task_id = ot.task_id) as total_sessions_count
       FROM order_tasks ot
       WHERE ot.order_id = ?
       ORDER BY ot.sort_order, ot.task_id`,
      [orderId]
    ) as RowDataPacket[];

    return rows as OrderTask[];
  }

  /**
   * Update task completion status with optimistic locking
   * Returns the new version on success, or null if version conflict
   * If expectedVersion is not provided, skips version checking (backwards compatible)
   */
  async updateTaskCompletion(
    taskId: number,
    completed: boolean,
    userId?: number,
    expectedVersion?: number,
    connection?: PoolConnection
  ): Promise<{ success: boolean; newVersion: number | null; currentVersion?: number }> {
    const conn = connection || pool;

    // If expectedVersion provided, use optimistic locking
    if (expectedVersion !== undefined) {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE order_tasks
         SET completed = ?,
             completed_at = ${completed ? 'NOW()' : 'NULL'},
             completed_by = ?,
             version = version + 1
         WHERE task_id = ? AND version = ?`,
        [completed, completed ? userId : null, taskId, expectedVersion]
      );

      if (result.affectedRows === 0) {
        // Version mismatch - get current version for error response
        const [rows] = await conn.execute<RowDataPacket[]>(
          'SELECT version FROM order_tasks WHERE task_id = ?',
          [taskId]
        );
        const currentVersion = rows.length > 0 ? rows[0].version : null;
        return { success: false, newVersion: null, currentVersion };
      }

      // Get the new version
      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT version FROM order_tasks WHERE task_id = ?',
        [taskId]
      );

      return { success: true, newVersion: rows[0]?.version || expectedVersion + 1 };
    }

    // No version checking (backwards compatible)
    await conn.execute(
      `UPDATE order_tasks
       SET completed = ?,
           completed_at = ${completed ? 'NOW()' : 'NULL'},
           completed_by = ?,
           version = version + 1
       WHERE task_id = ?`,
      [completed, completed ? userId : null, taskId]
    );

    // Get the new version
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT version FROM order_tasks WHERE task_id = ?',
      [taskId]
    );

    return { success: true, newVersion: rows[0]?.version || 1 };
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
   * Get tasks by role with order/customer info and session data
   */
  async getTasksByRole(
    role: string,
    includeCompleted: boolean,
    hoursBack: number,
    currentUserId?: number
  ): Promise<any[]> {
    // Handle completed filter: hoursBack=0 means "all time" (no time restriction)
    const completedFilter = includeCompleted
      ? hoursBack > 0
        ? 'AND ot.completed = 1 AND ot.completed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)'
        : 'AND ot.completed = 1'
      : 'AND ot.completed = 0';

    // Build params array based on query needs
    const params: (string | number)[] = [];
    if (currentUserId) params.push(currentUserId);
    params.push(role);
    if (includeCompleted && hoursBack > 0) params.push(hoursBack);

    const rows = await query(
      `SELECT
        ot.task_id,
        ot.task_name,
        ot.part_id,
        ot.assigned_role,
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
        op.part_number,
        -- Session aggregates
        (SELECT COUNT(*) FROM task_sessions ts WHERE ts.task_id = ot.task_id AND ts.ended_at IS NULL) as active_sessions_count,
        (SELECT COUNT(*) FROM task_sessions ts WHERE ts.task_id = ot.task_id) as total_sessions_count,
        ${currentUserId ? `(SELECT session_id FROM task_sessions ts WHERE ts.task_id = ot.task_id AND ts.user_id = ? AND ts.ended_at IS NULL LIMIT 1) as my_active_session` : 'NULL as my_active_session'}
       FROM order_tasks ot
       JOIN orders o ON ot.order_id = o.order_id
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       LEFT JOIN order_parts op ON ot.part_id = op.part_id
       WHERE ot.assigned_role = ? ${completedFilter}
       ORDER BY o.order_number, COALESCE(op.part_number, 999), ot.task_id`,
      params
    ) as RowDataPacket[];

    return rows;
  }

  /**
   * Update task started status with optimistic locking
   * Returns the new version on success, or null if version conflict
   * If expectedVersion is not provided, skips version checking (backwards compatible)
   */
  async updateTaskStarted(
    taskId: number,
    started: boolean,
    userId: number,
    expectedVersion?: number
  ): Promise<{ success: boolean; newVersion: number | null; currentVersion?: number }> {
    // If expectedVersion provided, use optimistic locking
    if (expectedVersion !== undefined) {
      const rows = await query(
        `UPDATE order_tasks
         SET started_at = ${started ? 'NOW()' : 'NULL'},
             started_by = ?,
             version = version + 1
         WHERE task_id = ? AND version = ?`,
        [started ? userId : null, taskId, expectedVersion]
      ) as ResultSetHeader;

      if (rows.affectedRows === 0) {
        // Version mismatch - get current version for error response
        const versionRows = await query(
          'SELECT version FROM order_tasks WHERE task_id = ?',
          [taskId]
        ) as RowDataPacket[];
        const currentVersion = versionRows.length > 0 ? versionRows[0].version : null;
        return { success: false, newVersion: null, currentVersion };
      }

      // Get the new version
      const versionRows = await query(
        'SELECT version FROM order_tasks WHERE task_id = ?',
        [taskId]
      ) as RowDataPacket[];

      return { success: true, newVersion: versionRows[0]?.version || expectedVersion + 1 };
    }

    // No version checking (backwards compatible)
    await query(
      `UPDATE order_tasks
       SET started_at = ${started ? 'NOW()' : 'NULL'},
           started_by = ?,
           version = version + 1
       WHERE task_id = ?`,
      [started ? userId : null, taskId]
    );

    // Get the new version
    const versionRows = await query(
      'SELECT version FROM order_tasks WHERE task_id = ?',
      [taskId]
    ) as RowDataPacket[];

    return { success: true, newVersion: versionRows[0]?.version || 1 };
  }

  /**
   * Get available task templates (Phase 1.5.c)
   * Returns all active tasks from task_definitions table, sorted by display_order
   * Now database-driven instead of hardcoded TASK_ROLE_MAP
   */
  async getAvailableTasks(): Promise<{
    task_name: string;
    assigned_role: string | null;
  }[]> {
    const rows = await query(
      'SELECT task_name, assigned_role FROM task_definitions WHERE is_active = TRUE ORDER BY display_order'
    ) as RowDataPacket[];

    return rows.map(row => ({
      task_name: row.task_name,
      assigned_role: row.assigned_role
    }));
  }

  /**
   * Clean empty spec rows from a part's specifications JSON
   * Removes _template_N entries where all row{N}_ fields are empty
   * Re-indexes remaining specs to close gaps (so no empty rows appear in UI)
   * Returns true if any specs were removed
   */
  async cleanEmptySpecRows(partId: number): Promise<boolean> {
    const part = await this.getOrderPartById(partId);
    if (!part || !part.specifications) return false;

    const specs = part.specifications;
    if (!specs || typeof specs !== 'object') return false;

    // Find all template keys (both _template_N and _template formats) and sort by number
    const templateKeys = Object.keys(specs)
      .filter(key => key.match(/^_template(_\d+)?$/))
      .sort((a, b) => {
        const numA = parseInt(a.replace('_template_', '') || '0');
        const numB = parseInt(b.replace('_template_', '') || '0');
        return numA - numB;
      });

    if (templateKeys.length === 0) return false;

    // Collect valid specs (ones with values) for re-indexing
    const validSpecs: Array<{ templateName: string; fields: Record<string, any> }> = [];

    for (const templateKey of templateKeys) {
      // Handle both _template_N and _template (no number) formats
      const rowNum = templateKey === '_template' ? '' : templateKey.replace('_template_', '');
      const rowPrefix = rowNum ? `row${rowNum}_` : 'row_';
      const templateName = specs[templateKey];

      // Collect all fields for this row
      const fields: Record<string, any> = {};
      let hasValues = false;

      Object.keys(specs).forEach(key => {
        if (key.startsWith(rowPrefix)) {
          const fieldName = key.replace(rowPrefix, '');
          const value = specs[key];
          fields[fieldName] = value;
          if (value !== null && value !== undefined && value !== '') {
            hasValues = true;
          }
        }
      });

      // Only keep specs that:
      // 1. Have a template name selected (not empty/null)
      // 2. Have at least one non-empty field value
      const hasTemplateName = templateName && templateName.trim() !== '';
      if (hasTemplateName && hasValues) {
        validSpecs.push({ templateName, fields });
      }
    }

    // Check if anything was removed
    if (validSpecs.length === templateKeys.length) {
      return false; // No empty specs found
    }

    // Rebuild specs with sequential numbering (no gaps)
    const cleanedSpecs: Record<string, any> = {};

    // Copy non-spec fields (like metadata) EXCEPT _row_count which we'll recalculate
    Object.keys(specs).forEach(key => {
      if (!key.startsWith('_template_') && !key.match(/^row\d+_/) && key !== '_row_count') {
        cleanedSpecs[key] = specs[key];
      }
    });

    // Re-index valid specs starting from 1
    validSpecs.forEach((spec, index) => {
      const newRowNum = index + 1;
      cleanedSpecs[`_template_${newRowNum}`] = spec.templateName;

      Object.entries(spec.fields).forEach(([fieldName, value]) => {
        cleanedSpecs[`row${newRowNum}_${fieldName}`] = value;
      });
    });

    // Update _row_count to match actual valid spec count (minimum 1 for UI)
    cleanedSpecs._row_count = Math.max(validSpecs.length, 1);

    // Update the database
    const removedCount = templateKeys.length - validSpecs.length;
    await this.updateOrderPart(partId, { specifications: cleanedSpecs });
    console.log(`[SpecCleanup] Removed ${removedCount} empty spec row(s) from part ${partId}, re-indexed ${validSpecs.length} remaining`);

    return true;
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

  // =============================================
  // IMPORT FROM ESTIMATE OPERATIONS
  // =============================================

  /**
   * Batch import fields from estimate preparation items to order parts
   * Updates specified fields on each target part
   * Auto-calculates extended_price if quantity or unit_price changes
   */
  async batchImportToOrderParts(
    orderId: number,
    imports: OrderPartImportInstruction[]
  ): Promise<{ updated: number }> {
    if (imports.length === 0) {
      return { updated: 0 };
    }

    let updated = 0;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const instruction of imports) {
        // Verify part belongs to this order
        const [partRows] = await connection.execute<RowDataPacket[]>(
          'SELECT part_id, quantity, unit_price FROM order_parts WHERE part_id = ? AND order_id = ?',
          [instruction.targetPartId, orderId]
        );

        if (partRows.length === 0) {
          console.warn(`[ImportToOrder] Part ${instruction.targetPartId} not found for order ${orderId}, skipping`);
          continue;
        }

        const currentPart = partRows[0];
        const updates: string[] = [];
        const params: any[] = [];

        // Build update query based on provided fields
        if (instruction.qb_item_name !== undefined) {
          updates.push('qb_item_name = ?');
          params.push(instruction.qb_item_name);
        }

        if (instruction.qb_description !== undefined) {
          updates.push('qb_description = ?');
          params.push(instruction.qb_description);
        }

        if (instruction.quantity !== undefined) {
          updates.push('quantity = ?');
          params.push(instruction.quantity);
        }

        if (instruction.unit_price !== undefined) {
          updates.push('unit_price = ?');
          params.push(instruction.unit_price);
        }

        // Auto-calculate extended_price if qty or unit_price provided
        const newQty = instruction.quantity ?? currentPart.quantity;
        const newPrice = instruction.unit_price ?? currentPart.unit_price;
        if (instruction.quantity !== undefined || instruction.unit_price !== undefined) {
          if (newQty !== null && newPrice !== null) {
            updates.push('extended_price = ?');
            params.push(newQty * newPrice);
          }
        }

        if (updates.length === 0) {
          continue; // No fields to update
        }

        params.push(instruction.targetPartId);

        await connection.execute(
          `UPDATE order_parts SET ${updates.join(', ')} WHERE part_id = ?`,
          params
        );

        updated++;
      }

      await connection.commit();
      console.log(`[ImportToOrder] Successfully imported ${updated} parts for order ${orderId}`);

      return { updated };
    } catch (error) {
      await connection.rollback();
      console.error('[ImportToOrder] Error during batch import:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const orderPartRepository = new OrderPartRepository();
