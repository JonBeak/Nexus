// File Clean up Finished: 2025-11-15
// Expanded service layer to support complete 3-layer architecture:
// - Added write methods: logSuccessfulLogin(), logFailedLogin()
// - Added read methods: getFailedLogs(), getAllLogsIncludingFailed()
// - All login log operations now go through service layer (architectural consistency)

/**
 * Login Log Service
 * Business logic layer for login log operations
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 */

import { loginLogRepository } from '../repositories/loginLogRepository';
import { RowDataPacket } from 'mysql2';
import { ServiceResult } from '../types/serviceResults';

export class LoginLogService {
  /**
   * Get all login logs
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Service result with array of login logs with user details
   */
  async getLogs(limit: number = 100): Promise<ServiceResult<RowDataPacket[]>> {
    try {
      // Business rule: Limit cannot exceed 1000 records
      const safeLimit = Math.min(limit, 1000);
      const logs = await loginLogRepository.getAllLogs(safeLimit);
      return { success: true, data: logs };
    } catch (error) {
      console.error('Error in getLogs service:', error);
      return {
        success: false,
        error: 'Failed to fetch login logs',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get login logs for a specific user
   * @param userId - User ID to fetch logs for
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Service result with array of login logs with user details
   */
  async getUserLogs(userId: number, limit: number = 100): Promise<ServiceResult<RowDataPacket[]>> {
    try {
      // Business rule: Limit cannot exceed 1000 records
      const safeLimit = Math.min(limit, 1000);
      const logs = await loginLogRepository.getLogsByUserId(userId, safeLimit);
      return { success: true, data: logs };
    } catch (error) {
      console.error('Error in getUserLogs service:', error);
      return {
        success: false,
        error: 'Failed to fetch user login logs',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get failed login attempts
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Service result with array of failed login logs
   */
  async getFailedLogs(limit: number = 100): Promise<ServiceResult<RowDataPacket[]>> {
    try {
      // Business rule: Limit cannot exceed 1000 records
      const safeLimit = Math.min(limit, 1000);
      const logs = await loginLogRepository.getFailedLogs(safeLimit);
      return { success: true, data: logs };
    } catch (error) {
      console.error('Error in getFailedLogs service:', error);
      return {
        success: false,
        error: 'Failed to fetch failed login logs',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get all login logs including both successful and failed attempts
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Service result with array of all login logs
   */
  async getAllLogsIncludingFailed(limit: number = 100): Promise<ServiceResult<RowDataPacket[]>> {
    try {
      // Business rule: Limit cannot exceed 1000 records
      const safeLimit = Math.min(limit, 1000);
      const logs = await loginLogRepository.getAllLogsIncludingFailed(safeLimit);
      return { success: true, data: logs };
    } catch (error) {
      console.error('Error in getAllLogsIncludingFailed service:', error);
      return {
        success: false,
        error: 'Failed to fetch all login logs',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Log a successful login attempt
   * @param userId - User ID who logged in
   * @param username - Username used for login
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent string
   * @returns The ID of the created log entry
   */
  async logSuccessfulLogin(
    userId: number,
    username: string,
    ipAddress: string,
    userAgent: string
  ): Promise<number> {
    // Business rule: Validate required fields
    if (!userId || !username) {
      throw new Error('User ID and username are required for successful login log');
    }

    return await loginLogRepository.createSuccessfulLog(userId, username, ipAddress, userAgent);
  }

  /**
   * Log a failed login attempt
   * @param username - Username attempted
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent string
   * @param failureReason - Reason for login failure
   * @param userId - Optional user ID (if user exists but password was wrong)
   * @returns The ID of the created log entry
   */
  async logFailedLogin(
    username: string,
    ipAddress: string,
    userAgent: string,
    failureReason: string,
    userId?: number
  ): Promise<number> {
    // Business rule: Validate required fields
    if (!username || !failureReason) {
      throw new Error('Username and failure reason are required for failed login log');
    }

    return await loginLogRepository.createFailedLog(username, ipAddress, userAgent, failureReason, userId);
  }
}

// Export singleton instance
export const loginLogService = new LoginLogService();
