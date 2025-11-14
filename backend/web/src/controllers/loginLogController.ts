/**
 * Login Log Controller
 * HTTP request/response handling for login log operations
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 */

import { Request, Response } from 'express';
import { loginLogService } from '../services/loginLogService';

export class LoginLogController {
  /**
   * Get all login logs
   * Query params:
   *   - limit: number (default: 100, max: 1000)
   */
  async getAllLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

      if (isNaN(limit) || limit < 1) {
        res.status(400).json({ error: 'Invalid limit parameter' });
        return;
      }

      const logs = await loginLogService.getLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error('Error in getAllLogs controller:', error);
      res.status(500).json({
        error: 'Failed to fetch login logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
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
      const userId = parseInt(req.params.userId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      if (isNaN(limit) || limit < 1) {
        res.status(400).json({ error: 'Invalid limit parameter' });
        return;
      }

      const logs = await loginLogService.getUserLogs(userId, limit);
      res.json(logs);
    } catch (error) {
      console.error('Error in getUserLogs controller:', error);
      res.status(500).json({
        error: 'Failed to fetch user login logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const loginLogController = new LoginLogController();
