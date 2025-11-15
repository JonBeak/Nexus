// File Clean up Finished: Nov 14, 2025
// Analysis: File is already clean. Recently created (Nov 13, 2025) with proper 3-layer architecture.
// Using query() helper correctly, proper types, good documentation. No cleanup needed.
// File Clean up Finished: 2025-11-15
// Expanded repository layer with write operations and additional queries:
// - Added createSuccessfulLog(), createFailedLog()
// - Added getFailedLogs(), getAllLogsIncludingFailed()
// - All methods use query() helper correctly
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
    // Validate limit parameter
    const validLimit = parseInt(String(limit));
    if (isNaN(validLimit) || validLimit < 0) {
      throw new Error('Invalid limit value');
    }

    // NOTE: Using literal value for LIMIT instead of placeholder
    // MySQL prepared statements with LIMIT ? don't work reliably in all contexts
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
      LIMIT ${validLimit}
    `;

    const logs = await query(sql, []) as RowDataPacket[];
    return logs;
  }

  /**
   * Get login logs for a specific user
   * @param userId - User ID to fetch logs for
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of login log records with user details
   */
  async getLogsByUserId(userId: number, limit: number = 100): Promise<RowDataPacket[]> {
    // Validate limit parameter
    const validLimit = parseInt(String(limit));
    if (isNaN(validLimit) || validLimit < 0) {
      throw new Error('Invalid limit value');
    }

    // NOTE: Using literal value for LIMIT instead of placeholder
    // MySQL prepared statements with LIMIT ? don't work reliably in all contexts
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
      LIMIT ${validLimit}
    `;

    const logs = await query(sql, [userId]) as RowDataPacket[];
    return logs;
  }

  /**
   * Get failed login attempts
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of failed login log records
   */
  async getFailedLogs(limit: number = 100): Promise<RowDataPacket[]> {
    // Validate limit parameter
    const validLimit = parseInt(String(limit));
    if (isNaN(validLimit) || validLimit < 0) {
      throw new Error('Invalid limit value');
    }

    const sql = `
      SELECT
        ll.log_id,
        ll.user_id,
        ll.username_attempted,
        ll.ip_address,
        ll.login_time,
        ll.user_agent,
        ll.login_successful,
        ll.failure_reason
      FROM login_logs ll
      WHERE ll.login_successful = 0
      ORDER BY ll.login_time DESC
      LIMIT ${validLimit}
    `;

    const logs = await query(sql, []) as RowDataPacket[];
    return logs;
  }

  /**
   * Get all login logs including both successful and failed attempts
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of all login log records
   */
  async getAllLogsIncludingFailed(limit: number = 100): Promise<RowDataPacket[]> {
    // Validate limit parameter
    const validLimit = parseInt(String(limit));
    if (isNaN(validLimit) || validLimit < 0) {
      throw new Error('Invalid limit value');
    }

    const sql = `
      SELECT
        ll.log_id,
        ll.user_id,
        ll.username_attempted,
        ll.ip_address,
        ll.login_time,
        ll.user_agent,
        ll.login_successful,
        ll.failure_reason,
        u.username,
        u.first_name,
        u.last_name
      FROM login_logs ll
      LEFT JOIN users u ON ll.user_id = u.user_id
      ORDER BY ll.login_time DESC
      LIMIT ${validLimit}
    `;

    const logs = await query(sql, []) as RowDataPacket[];
    return logs;
  }

  /**
   * Create a successful login log entry
   * @param userId - User ID who logged in
   * @param username - Username attempted
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent string
   * @returns The ID of the created log entry
   */
  async createSuccessfulLog(
    userId: number,
    username: string,
    ipAddress: string,
    userAgent: string
  ): Promise<number> {
    const sql = `
      INSERT INTO login_logs
      (user_id, username_attempted, ip_address, user_agent, login_time, login_successful)
      VALUES (?, ?, ?, ?, NOW(), 1)
    `;

    const result = await query(sql, [userId, username, ipAddress, userAgent]) as any;
    return result.insertId;
  }

  /**
   * Create a failed login log entry
   * @param username - Username attempted
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent string
   * @param failureReason - Reason for login failure
   * @param userId - Optional user ID (if user exists but password was wrong)
   * @returns The ID of the created log entry
   */
  async createFailedLog(
    username: string,
    ipAddress: string,
    userAgent: string,
    failureReason: string,
    userId?: number
  ): Promise<number> {
    const sql = `
      INSERT INTO login_logs
      (user_id, username_attempted, ip_address, user_agent, login_time, login_successful, failure_reason)
      VALUES (?, ?, ?, ?, NOW(), 0, ?)
    `;

    const result = await query(sql, [userId || null, username, ipAddress, userAgent, failureReason]) as any;
    return result.insertId;
  }
}

// Export singleton instance
export const loginLogRepository = new LoginLogRepository();
