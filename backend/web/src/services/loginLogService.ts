// File Clean up Started: 2025-11-14
/**
 * Login Log Service
 * Business logic layer for login log operations
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 */

import { loginLogRepository } from '../repositories/loginLogRepository';
import { RowDataPacket } from 'mysql2';

export class LoginLogService {
  /**
   * Get all login logs
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of login logs with user details
   */
  async getLogs(limit: number = 100): Promise<RowDataPacket[]> {
    // Business rule: Limit cannot exceed 1000 records
    const safeLimit = Math.min(limit, 1000);
    return await loginLogRepository.getAllLogs(safeLimit);
  }

  /**
   * Get login logs for a specific user
   * @param userId - User ID to fetch logs for
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of login logs with user details
   */
  async getUserLogs(userId: number, limit: number = 100): Promise<RowDataPacket[]> {
    // Business rule: Limit cannot exceed 1000 records
    const safeLimit = Math.min(limit, 1000);
    return await loginLogRepository.getLogsByUserId(userId, safeLimit);
  }
}

// Export singleton instance
export const loginLogService = new LoginLogService();
