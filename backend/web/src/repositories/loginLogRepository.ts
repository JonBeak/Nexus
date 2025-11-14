// File Clean up Finished: Nov 14, 2025
// Analysis: File is already clean. Recently created (Nov 13, 2025) with proper 3-layer architecture.
// Using query() helper correctly, proper types, good documentation. No cleanup needed.
/**
 * Login Log Repository
 * Data access layer for login log operations
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 */

import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface LoginLogFields {
  log_id: number;
  user_id: number;
  ip_address: string;
  login_time: Date;
  user_agent: string;
  username: string;
  first_name: string;
  last_name: string;
}

export class LoginLogRepository {
  /**
   * Get all login logs with user details
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of login log records with user details
   */
  async getAllLogs(limit: number = 100): Promise<RowDataPacket[]> {
    const sql = `
      SELECT
        ll.log_id,
        ll.user_id,
        ll.ip_address,
        ll.login_time,
        ll.user_agent,
        u.username,
        u.first_name,
        u.last_name
      FROM login_logs ll
      JOIN users u ON ll.user_id = u.user_id
      ORDER BY ll.login_time DESC
      LIMIT ?
    `;

    const logs = await query(sql, [limit]) as RowDataPacket[];
    return logs;
  }

  /**
   * Get login logs for a specific user
   * @param userId - User ID to fetch logs for
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of login log records with user details
   */
  async getLogsByUserId(userId: number, limit: number = 100): Promise<RowDataPacket[]> {
    const sql = `
      SELECT
        ll.log_id,
        ll.user_id,
        ll.ip_address,
        ll.login_time,
        ll.user_agent,
        u.username,
        u.first_name,
        u.last_name
      FROM login_logs ll
      JOIN users u ON ll.user_id = u.user_id
      WHERE ll.user_id = ?
      ORDER BY ll.login_time DESC
      LIMIT ?
    `;

    const logs = await query(sql, [userId, limit]) as RowDataPacket[];
    return logs;
  }
}

// Export singleton instance
export const loginLogRepository = new LoginLogRepository();
