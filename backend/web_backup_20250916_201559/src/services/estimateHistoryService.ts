/**
 * Estimate History Service
 * 
 * Handles logging of all estimate management actions for comprehensive audit trail.
 * Replaces scattered timestamp fields with centralized history tracking.
 * 
 * Phase 1: Parallel logging (logs to both history table and existing fields)
 * Phase 2: Will remove redundant fields after testing
 */

import { pool } from '../config/database';
import { ResultSetHeader } from 'mysql2';

export interface EstimateHistoryEntry {
  estimateId: number;
  jobId: number;
  actionType: EstimateActionType;
  performedByUserId: number;
  oldStatus?: string;
  newStatus?: string;
  metadata?: Record<string, any>;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type EstimateActionType = 
  | 'created'
  | 'grid_data_saved'
  | 'finalized'
  | 'sent'
  | 'approved'
  | 'not_approved'
  | 'retracted'
  | 'converted_to_order'
  | 'deactivated'
  | 'version_created'
  | 'duplicated'
  | 'reset'
  | 'cleared';

export class EstimateHistoryService {

  /**
   * Log an estimate action to the history table
   */
  async logAction(entry: EstimateHistoryEntry): Promise<number> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO estimate_history 
         (estimate_id, job_id, action_type, performed_by_user_id, 
          old_status, new_status, metadata, notes, ip_address, user_agent, action_timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          entry.estimateId,
          entry.jobId,
          entry.actionType,
          entry.performedByUserId,
          entry.oldStatus || null,
          entry.newStatus || null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.notes || null,
          entry.ipAddress || null,
          entry.userAgent || null
        ]
      );

      console.log(`📝 HISTORY: Logged ${entry.actionType} for estimate ${entry.estimateId} by user ${entry.performedByUserId}`);
      return result.insertId;
    } catch (error) {
      console.error('Error logging estimate history:', error);
      throw new Error('Failed to log estimate action');
    }
  }

  /**
   * Get complete history for an estimate
   */
  async getEstimateHistory(estimateId: number): Promise<any[]> {
    try {
      const [rows] = await pool.execute(
        `SELECT h.*, u.username, u.full_name 
         FROM estimate_history h
         LEFT JOIN users u ON h.performed_by_user_id = u.user_id
         WHERE h.estimate_id = ?
         ORDER BY h.action_timestamp ASC`,
        [estimateId]
      );

      return rows as any[];
    } catch (error) {
      console.error('Error fetching estimate history:', error);
      throw new Error('Failed to fetch estimate history');
    }
  }

  /**
   * Get recent activity across all estimates
   */
  async getRecentActivity(limit: number = 50): Promise<any[]> {
    try {
      const [rows] = await pool.execute(
        `SELECT h.*, u.username, u.full_name, je.job_code, j.job_name
         FROM estimate_history h
         LEFT JOIN users u ON h.performed_by_user_id = u.user_id
         LEFT JOIN job_estimates je ON h.estimate_id = je.id
         LEFT JOIN jobs j ON h.job_id = j.job_id
         ORDER BY h.action_timestamp DESC
         LIMIT ?`,
        [limit]
      );

      return rows as any[];
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      throw new Error('Failed to fetch recent activity');
    }
  }

  /**
   * Get action count by type for an estimate
   */
  async getActionCounts(estimateId: number): Promise<Record<string, number>> {
    try {
      const [rows] = await pool.execute(
        `SELECT action_type, COUNT(*) as count
         FROM estimate_history 
         WHERE estimate_id = ?
         GROUP BY action_type`,
        [estimateId]
      ) as any[];

      const counts: Record<string, number> = {};
      for (const row of rows) {
        counts[row.action_type] = row.count;
      }

      return counts;
    } catch (error) {
      console.error('Error fetching action counts:', error);
      throw new Error('Failed to fetch action counts');
    }
  }

  /**
   * Get last action of specific type
   */
  async getLastAction(estimateId: number, actionType: EstimateActionType): Promise<any | null> {
    try {
      const [rows] = await pool.execute(
        `SELECT h.*, u.username, u.full_name
         FROM estimate_history h
         LEFT JOIN users u ON h.performed_by_user_id = u.user_id
         WHERE h.estimate_id = ? AND h.action_type = ?
         ORDER BY h.action_timestamp DESC
         LIMIT 1`,
        [estimateId, actionType]
      ) as any[];

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error fetching last action:', error);
      throw new Error('Failed to fetch last action');
    }
  }

  /**
   * Convenience methods for common queries
   */
  async getSentHistory(estimateId: number): Promise<any[]> {
    try {
      const [rows] = await pool.execute(
        `SELECT h.*, u.username, u.full_name
         FROM estimate_history h
         LEFT JOIN users u ON h.performed_by_user_id = u.user_id
         WHERE h.estimate_id = ? AND h.action_type = 'sent'
         ORDER BY h.action_timestamp DESC`,
        [estimateId]
      );

      return rows as any[];
    } catch (error) {
      console.error('Error fetching sent history:', error);
      throw new Error('Failed to fetch sent history');
    }
  }

  async getSentCount(estimateId: number): Promise<number> {
    try {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) as count
         FROM estimate_history 
         WHERE estimate_id = ? AND action_type = 'sent'`,
        [estimateId]
      ) as any[];

      return rows[0]?.count || 0;
    } catch (error) {
      console.error('Error fetching sent count:', error);
      return 0;
    }
  }

  async getLastSent(estimateId: number): Promise<Date | null> {
    try {
      const lastSent = await this.getLastAction(estimateId, 'sent');
      return lastSent ? new Date(lastSent.action_timestamp) : null;
    } catch (error) {
      console.error('Error fetching last sent:', error);
      return null;
    }
  }
}

export const estimateHistoryService = new EstimateHistoryService();