// File Clean up Finished: 2025-11-21

/**
 * Time Scheduling Controller
 * HTTP request/response handling for work schedules and holidays
 *
 * Created: Nov 21, 2025
 * Part of timeScheduling.ts route refactoring - extracting inline controller logic
 *
 * Architecture: Route → Controller → Service → Repository
 * Uses standardized helpers from controllerHelpers.ts
 */

import { Response } from 'express';
import { AuthRequest } from '../../types';
import { SchedulingService } from '../../services/timeManagement/SchedulingService';
import { sendErrorResponse, handleServiceResult, mapErrorCodeToStatus } from '../../utils/controllerHelpers';
import { ServiceResult } from '../../types/serviceResults';

export class TimeSchedulingController {
  /**
   * Get work schedules for a user
   * GET /time-management/schedules/:userId
   */
  async getWorkSchedules(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        return sendErrorResponse(res, 'Invalid user ID', 'VALIDATION_ERROR');
      }

      const result = await SchedulingService.getWorkSchedules(req.user!, userId, {});
      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in getWorkSchedules controller:', error);
      sendErrorResponse(res, 'Failed to fetch schedules', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Update work schedules for a user
   * PUT /time-management/schedules/:userId
   */
  async updateWorkSchedules(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const { schedules } = req.body;

      if (isNaN(userId)) {
        return sendErrorResponse(res, 'Invalid user ID', 'VALIDATION_ERROR');
      }

      const result = await SchedulingService.updateWorkSchedules(req.user!, userId, schedules, {});
      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in updateWorkSchedules controller:', error);
      sendErrorResponse(res, 'Failed to update schedule', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Get all active company holidays
   * GET /time-management/holidays
   */
  async getHolidays(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await SchedulingService.getHolidays(req.user!, {});
      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in getHolidays controller:', error);
      sendErrorResponse(res, 'Failed to fetch holidays', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Create a new holiday
   * POST /time-management/holidays
   *
   * Special handling: CONFLICT returns result.data (includes existing_holiday info)
   */
  async createHoliday(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { holiday_name, holiday_date, overwrite = false } = req.body;

      const result = await SchedulingService.createHoliday(
        req.user!,
        { holiday_name, holiday_date, overwrite },
        {}
      );

      // Special handling for CONFLICT - return full data for UI to handle
      if (!result.success && result.code === 'CONFLICT') {
        const status = mapErrorCodeToStatus(result.code);
        res.status(status).json(result.data);
        return;
      }

      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in createHoliday controller:', error);
      sendErrorResponse(res, 'Failed to add holiday', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Delete a holiday (soft delete)
   * DELETE /time-management/holidays/:holidayId
   */
  async deleteHoliday(req: AuthRequest, res: Response): Promise<void> {
    try {
      const holidayId = parseInt(req.params.holidayId);

      if (isNaN(holidayId)) {
        return sendErrorResponse(res, 'Invalid holiday ID', 'VALIDATION_ERROR');
      }

      const result = await SchedulingService.deleteHoliday(req.user!, holidayId, {});
      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in deleteHoliday controller:', error);
      sendErrorResponse(res, 'Failed to remove holiday', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Export holidays as CSV
   * GET /time-management/holidays/export
   *
   * Special handling: Sets CSV headers for file download
   */
  async exportHolidaysCSV(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await SchedulingService.exportHolidaysCSV(req.user!, {});

      if (!result.success) {
        sendErrorResponse(res, result.error || 'Failed to export holidays', result.code);
        return;
      }

      // Set CSV headers and send content
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="company_holidays.csv"');
      res.send(result.data);
    } catch (error: any) {
      console.error('Error in exportHolidaysCSV controller:', error);
      sendErrorResponse(res, 'Failed to export holidays', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Import holidays from CSV
   * POST /time-management/holidays/import
   *
   * Special handling: CONFLICT returns result.data (includes conflicts array)
   */
  async importHolidaysCSV(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { csvData, overwriteAll = false } = req.body;

      const result = await SchedulingService.importHolidaysCSV(
        req.user!,
        { csvData, overwriteAll },
        {}
      );

      // Special handling for CONFLICT - return full data for UI to handle
      if (!result.success && result.code === 'CONFLICT') {
        const status = mapErrorCodeToStatus(result.code);
        res.status(status).json(result.data);
        return;
      }

      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in importHolidaysCSV controller:', error);
      sendErrorResponse(res, 'Failed to import holidays', 'INTERNAL_ERROR', error.message);
    }
  }
}

// Export singleton instance
export const timeSchedulingController = new TimeSchedulingController();
