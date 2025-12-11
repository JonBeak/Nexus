/**
 * Order Parts Tasks Repository
 * Data Access Layer for fetching parts with their tasks for the Tasks Table
 * Phase 2.a - Tasks Table Feature
 */

import { query } from '../config/database';
import { RowDataPacket } from 'mysql2/promise';
import { OrderStatus, ProductionRole } from '../types/orders';

/**
 * Raw row from the database query (flat structure from JOIN)
 */
export interface PartWithTaskRow {
  part_id: number;
  order_id: number;
  order_number: number;
  order_name: string;
  customer_name: string | null;
  display_number: string;
  product_type: string;
  specs_display_name: string | null;
  part_scope: string | null;
  due_date: Date | null;
  hard_due_date_time: string | null;  // TIME field for hard due dates
  order_status: OrderStatus;
  is_parent: boolean;
  task_id: number | null;
  task_name: string | null;
  assigned_role: ProductionRole | null;
  completed: boolean;
  completed_at: Date | null;
  completed_by: number | null;
  notes: string | null;
}

/**
 * Tasks that are now tracked via order status, not per-part tasks
 * Filter these out from the Tasks Table display
 */
const STATUS_BASED_TASKS = [
  'Design Files',
  'Design Approval',
  'Quality Control',
  'Packing',
  'QC & Packing'
];

export interface PartsWithTasksQueryParams {
  status?: OrderStatus;
  hideCompleted?: boolean;
  search?: string;
}

export class OrderPartsTasksRepository {
  /**
   * Get all parts with their tasks for the Tasks Table
   * Returns flat rows that will be aggregated by the service layer
   */
  async getPartsWithTasks(params: PartsWithTasksQueryParams = {}): Promise<PartWithTaskRow[]> {
    const conditions: string[] = [
      // Only show orders in production-related statuses
      "o.status IN ('production_queue', 'in_production', 'overdue', 'qc_packing')",
      // Only show parent parts (child parts don't have tasks)
      "op.is_parent = 1"
    ];
    const queryParams: any[] = [];

    // Filter by specific status if provided
    if (params.status) {
      conditions.push('o.status = ?');
      queryParams.push(params.status);
    }

    // Search filter
    if (params.search) {
      conditions.push(`(
        o.order_number LIKE ? OR
        op.product_type LIKE ? OR
        op.specs_display_name LIKE ? OR
        op.part_scope LIKE ?
      )`);
      const searchPattern = `%${params.search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Build task exclusion clause for status-based tasks
    const taskExclusionPlaceholders = STATUS_BASED_TASKS.map(() => '?').join(', ');

    const sql = `
      SELECT
        op.part_id,
        op.order_id,
        o.order_number,
        o.order_name,
        c.company_name AS customer_name,
        op.display_number,
        op.product_type,
        op.specs_display_name,
        op.part_scope,
        o.due_date,
        o.hard_due_date_time,
        o.status AS order_status,
        op.is_parent,
        ot.task_id,
        ot.task_name,
        ot.assigned_role,
        ot.completed,
        ot.completed_at,
        ot.completed_by,
        ot.notes
      FROM order_parts op
      JOIN orders o ON op.order_id = o.order_id
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN order_tasks ot ON op.part_id = ot.part_id
        AND (ot.task_name IS NULL OR ot.task_name NOT IN (${taskExclusionPlaceholders}))
      ${whereClause}
      ORDER BY
        o.due_date ASC,
        o.order_number ASC,
        op.part_number ASC,
        ot.sort_order ASC,
        ot.task_id ASC
    `;

    // Add status-based task names to beginning of params for the LEFT JOIN filter
    const fullParams = [...STATUS_BASED_TASKS, ...queryParams];

    const rows = await query(sql, fullParams) as RowDataPacket[];
    return rows as PartWithTaskRow[];
  }

  /**
   * Get the list of all task names that exist in active orders
   * Used for determining which columns to show in the Tasks Table
   */
  async getActiveTaskNames(): Promise<string[]> {
    const sql = `
      SELECT DISTINCT ot.task_name
      FROM order_tasks ot
      JOIN orders o ON ot.order_id = o.order_id
      WHERE o.status NOT IN ('completed', 'cancelled')
        AND ot.task_name IS NOT NULL
      ORDER BY ot.task_name
    `;

    const rows = await query(sql) as RowDataPacket[];
    return rows.map(row => row.task_name);
  }
}

export const orderPartsTasksRepository = new OrderPartsTasksRepository();
