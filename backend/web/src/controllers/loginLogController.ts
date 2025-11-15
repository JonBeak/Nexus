// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: parseIntParam, handleServiceResult, sendErrorResponse (already present)
// - Replaced 2 instances of parseInt() with parseIntParam()
// - Replaced 4 instances of manual res.status().json() with helpers
// - Service layer returns ServiceResult<T>

// File Clean up Finished: 2025-11-15
// Analysis: File is already clean. Recently created (Nov 13, 2025) with proper 3-layer architecture.
// Follows Route → Controller → Service → Repository pattern correctly.
// No pool.execute() migrations needed, no redundant code, proper error handling.
// Service layer has additional methods (getFailedLogs, getAllLogsIncludingFailed) reserved for future use.

/**
 * Login Log Controller
 * HTTP request/response handling for login log operations
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 */

import { Request, Response } from 'express';
import { loginLogService } from '../services/loginLogService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';

export class LoginLogController {
  /**
   * Get all login logs
   * Query params:
   *   - limit: number (default: 100, max: 1000)
   */
  async getAllLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseIntParam(req.query.limit as string, 'limit') : 100;

      if (limit === null || limit < 1) {
        return sendErrorResponse(res, 'Invalid limit parameter', 'VALIDATION_ERROR');
      }

      const result = await loginLogService.getLogs(limit);
      return handleServiceResult(res, result);
    } catch (error) {
      console.error('Error in getAllLogs controller:', error);
      return sendErrorResponse(res, 'Failed to fetch login logs', 'INTERNAL_ERROR');
    }
  }

  /**
   * Get login logs for a specific user
   * Route param: userId
   * Query params:
   *   - limit: number (default: 100, max: 1000)
   */
  async getUserLogs(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseIntParam(req.params.userId, 'userId');
      if (userId === null) {
        return sendErrorResponse(res, 'Invalid user ID', 'VALIDATION_ERROR');
      }

      const limit = req.query.limit ? parseIntParam(req.query.limit as string, 'limit') : 100;
      if (limit === null || limit < 1) {
        return sendErrorResponse(res, 'Invalid limit parameter', 'VALIDATION_ERROR');
      }

      const result = await loginLogService.getUserLogs(userId, limit);
      return handleServiceResult(res, result);
    } catch (error) {
      console.error('Error in getUserLogs controller:', error);
      return sendErrorResponse(res, 'Failed to fetch user login logs', 'INTERNAL_ERROR');
    }
  }
}

// Export singleton instance
export const loginLogController = new LoginLogController();
