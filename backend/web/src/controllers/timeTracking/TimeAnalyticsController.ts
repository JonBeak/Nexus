// File Clean up Finished: 2025-11-21

/**
 * Time Analytics Controller
 * HTTP request/response handling for time analytics operations
 *
 * Created: Nov 21, 2025
 * Part of timeAnalytics.ts route refactoring - extracting inline controller logic
 *
 * Architecture: Route → Controller → Service → Repository
 * Uses standardized helpers from controllerHelpers.ts
 */

import { Response } from 'express';
import { AuthRequest } from '../../types';
import { TimeAnalyticsService } from '../../services/timeManagement/TimeAnalyticsService';
import { sendErrorResponse, handleServiceResult } from '../../utils/controllerHelpers';
import { ServiceResult } from '../../types/serviceResults';

export class TimeAnalyticsController {
  /**
   * Get weekly summary data
   * Query params:
   *   - startDate: string (required)
   *   - endDate: string (required)
   *   - group: string (optional)
   */
  async getWeeklySummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, group } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        return sendErrorResponse(res, 'Start and end dates are required', 'VALIDATION_ERROR');
      }

      // Call service
      const result = await TimeAnalyticsService.getWeeklySummary(
        req.user!,
        { startDate: startDate as string, endDate: endDate as string },
        { group: group as string },
        {}
      );

      // ServiceResponse from TimeAnalyticsService is structurally compatible with ServiceResult
      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in getWeeklySummary controller:', error);
      sendErrorResponse(res, 'Failed to fetch weekly summary', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Get analytics overview
   * Query params:
   *   - startDate: string (required)
   *   - endDate: string (required)
   *   - group: string (optional)
   */
  async getAnalyticsOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, group } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        return sendErrorResponse(res, 'Start and end dates are required', 'VALIDATION_ERROR');
      }

      // Call service
      const result = await TimeAnalyticsService.getAnalyticsOverview(
        req.user!,
        { startDate: startDate as string, endDate: endDate as string },
        { group: group as string },
        {}
      );

      // ServiceResponse from TimeAnalyticsService is structurally compatible with ServiceResult
      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in getAnalyticsOverview controller:', error);
      sendErrorResponse(res, 'Failed to fetch analytics overview', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Get analytics data for individual user
   * Query params:
   *   - userId: string (required)
   *   - startDate: string (required)
   *   - endDate: string (required)
   */
  async getUserAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId, startDate, endDate } = req.query;

      // Validate required parameters
      if (!userId || !startDate || !endDate) {
        return sendErrorResponse(res, 'User ID, start date, and end date are required', 'VALIDATION_ERROR');
      }

      // Call service
      const result = await TimeAnalyticsService.getUserAnalytics(
        req.user!,
        Number(userId),
        { startDate: startDate as string, endDate: endDate as string },
        {}
      );

      // ServiceResponse from TimeAnalyticsService is structurally compatible with ServiceResult
      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in getUserAnalytics controller:', error);
      sendErrorResponse(res, 'Failed to fetch analytics', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Get missing entries based on work schedules and holidays
   * Query params:
   *   - startDate: string (required)
   *   - endDate: string (required)
   *   - group: string (optional)
   *
   * Complex logic (300+ lines) delegated to TimeAnalyticsService → MissingEntriesService
   */
  async getMissingEntries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, group } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        return sendErrorResponse(res, 'Start and end dates are required', 'VALIDATION_ERROR');
      }

      // Call service with timeout option
      const result = await TimeAnalyticsService.getMissingEntries(
        req.user!,
        { startDate: startDate as string, endDate: endDate as string },
        { group: group as string },
        { timeout: 8000 } // 8 second timeout
      );

      // Handle special timeout error with additional details in dev mode
      if (!result.success && result.code === 'TIMEOUT_ERROR') {
        const response: any = { error: result.error };
        if (process.env.NODE_ENV === 'development' && result.details) {
          response.details = result.details;
        }
        res.status(408).json(response);
        return;
      }

      // ServiceResponse from TimeAnalyticsService is structurally compatible with ServiceResult
      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in getMissingEntries controller:', error);
      if (!res.headersSent) {
        const response: any = { error: 'Failed to fetch missing entries' };
        if (process.env.NODE_ENV === 'development') {
          response.details = error.message;
        }
        res.status(500).json(response);
      }
    }
  }
}

// Export singleton instance
export const timeAnalyticsController = new TimeAnalyticsController();
