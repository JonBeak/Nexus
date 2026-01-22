/**
 * Overdue Order Repository
 * Data Access Layer for overdue order detection and status updates
 *
 * Created: 2026-01-22
 *
 * Handles queries for finding orders past their due dates and marking them overdue.
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';

export interface OverdueOrderData {
  order_id: number;
  order_number: number;
  status: string;
  order_name: string;
  due_date: string;
  hard_due_date_time: string | null;
}

export class OverdueOrderRepository {

  /**
   * Find orders that are past their deadline and should be marked overdue
   *
   * Logic:
   * - Orders with hard_due_date_time: overdue when TIMESTAMP(due_date, hard_due_date_time) <= NOW()
   * - Orders with only due_date: overdue at 4pm (16:00) on the due date (end of workday)
   * - Orders from previous days (catch any missed): always overdue
   *
   * Only considers orders in 'production_queue' or 'in_production' status
   */
  async getOverdueOrders(): Promise<OverdueOrderData[]> {
    const rows = await query(
      `SELECT
        order_id,
        order_number,
        status,
        order_name,
        DATE_FORMAT(due_date, '%Y-%m-%d') as due_date,
        TIME_FORMAT(hard_due_date_time, '%H:%i') as hard_due_date_time
      FROM orders
      WHERE status IN ('production_queue', 'in_production')
        AND due_date IS NOT NULL
        AND (
          -- Orders with hard due time: check if datetime has passed
          (hard_due_date_time IS NOT NULL
           AND TIMESTAMP(due_date, hard_due_date_time) <= NOW())
          OR
          -- Orders with only due date: check if it's 4pm or later on due date
          (hard_due_date_time IS NULL
           AND due_date = CURDATE()
           AND HOUR(NOW()) >= 16)
          OR
          -- Orders from previous days (catch any missed)
          (due_date < CURDATE())
        )
      ORDER BY due_date ASC, hard_due_date_time ASC`
    ) as RowDataPacket[];

    return rows as OverdueOrderData[];
  }

  /**
   * Mark an order as overdue and create status history entry
   *
   * @param orderId - The order to mark overdue
   * @param notes - Notes for the status history (e.g., reason for overdue)
   * @param systemUserId - User ID (null for automated/system changes)
   */
  async markOrderOverdue(
    orderId: number,
    notes: string,
    systemUserId: number | null = null
  ): Promise<{ previousStatus: string }> {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Get current status for history
      const [currentRows] = await conn.execute<RowDataPacket[]>(
        'SELECT status FROM orders WHERE order_id = ?',
        [orderId]
      );

      if (currentRows.length === 0) {
        throw new Error(`Order ${orderId} not found`);
      }

      const previousStatus = currentRows[0].status;

      // Update order status to overdue
      await conn.execute(
        'UPDATE orders SET status = ? WHERE order_id = ?',
        ['overdue', orderId]
      );

      // Create status history entry
      await conn.execute(
        `INSERT INTO order_status_history (order_id, status, changed_by, notes)
         VALUES (?, ?, ?, ?)`,
        [orderId, 'overdue', systemUserId, notes]
      );

      await conn.commit();

      return { previousStatus };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Get order details for WebSocket broadcast
   */
  async getOrderForBroadcast(orderId: number): Promise<{ order_number: number } | null> {
    const rows = await query(
      'SELECT order_number FROM orders WHERE order_id = ?',
      [orderId]
    ) as RowDataPacket[];

    return rows.length > 0 ? { order_number: rows[0].order_number } : null;
  }
}

export const overdueOrderRepository = new OverdueOrderRepository();
