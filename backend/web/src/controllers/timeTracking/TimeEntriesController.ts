// File Clean up Finished: 2025-11-21

/**
 * Time Entries Controller
 * HTTP request/response handling for time entries CRUD operations
 *
 * Created: Nov 21, 2025
 * Part of timeEntries.ts route refactoring - extracting inline controller logic
 *
 * Architecture: Route -> Controller -> Service -> Repository
 * Uses standardized helpers from controllerHelpers.ts
 */

import { Response } from 'express';
import { AuthRequest } from '../../types';
import { TimeEntriesService } from '../../services/timeManagement/TimeEntriesService';
import { sendErrorResponse, handleServiceResult } from '../../utils/controllerHelpers';
import { ServiceResult } from '../../types/serviceResults';

export class TimeEntriesController {
  /**
   * Get time entries with filters
   * GET /time-management/entries
   */
  async getTimeEntries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, status, users, group, search, quickFilter } = req.query;

      const result = await TimeEntriesService.getTimeEntries(
        req.user!,
        {
          startDate: startDate as string,
          endDate: endDate as string,
          status: status as string,
          users: users as string,
          group: group as string,
          search: search as string,
          quickFilter: quickFilter as string
        },
        {}
      );

      if (result.success) {
        // Custom response format for this endpoint (entries instead of data)
        res.json({ entries: result.data });
      } else {
        sendErrorResponse(res, result.error || 'Failed to fetch time entries', result.code);
      }
    } catch (error: any) {
      console.error('Error in getTimeEntries controller:', error);
      sendErrorResponse(res, 'Failed to fetch time entries', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Create new time entry
   * POST /time-management/entries
   */
  async createTimeEntry(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { user_id, clock_in, clock_out, break_minutes, notes, status } = req.body;

      const result = await TimeEntriesService.createTimeEntry(
        req.user!,
        {
          user_id,
          clock_in,
          clock_out,
          break_minutes,
          notes,
          status
        },
        {}
      );

      if (result.success) {
        // Custom response format for this endpoint
        res.json({
          message: 'Time entry created successfully',
          entry_id: result.data!.entry_id
        });
      } else {
        sendErrorResponse(res, result.error || 'Failed to create time entry', result.code);
      }
    } catch (error: any) {
      console.error('Error in createTimeEntry controller:', error);
      sendErrorResponse(res, 'Failed to create time entry', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Update single time entry
   * PUT /time-management/entries/:entryId
   */
  async updateTimeEntry(req: AuthRequest, res: Response): Promise<void> {
    try {
      const entryId = parseInt(req.params.entryId);

      if (isNaN(entryId)) {
        return sendErrorResponse(res, 'Invalid entry ID', 'VALIDATION_ERROR');
      }

      const { clock_in, clock_out, break_minutes } = req.body;

      const result = await TimeEntriesService.updateTimeEntry(
        req.user!,
        entryId,
        {
          clock_in,
          clock_out,
          break_minutes
        },
        {}
      );

      if (result.success) {
        res.json({ message: 'Entry updated successfully' });
      } else {
        sendErrorResponse(res, result.error || 'Failed to update time entry', result.code);
      }
    } catch (error: any) {
      console.error('Error in updateTimeEntry controller:', error);
      sendErrorResponse(res, 'Failed to update time entry', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Delete individual time entry
   * DELETE /time-management/entries/:entryId
   */
  async deleteTimeEntry(req: AuthRequest, res: Response): Promise<void> {
    try {
      const entryId = parseInt(req.params.entryId);

      if (isNaN(entryId)) {
        return sendErrorResponse(res, 'Invalid entry ID', 'VALIDATION_ERROR');
      }

      const result = await TimeEntriesService.deleteTimeEntry(
        req.user!,
        entryId,
        {}
      );

      if (result.success) {
        res.json({ message: 'Entry deleted successfully' });
      } else {
        sendErrorResponse(res, result.error || 'Failed to delete time entry', result.code);
      }
    } catch (error: any) {
      console.error('Error in deleteTimeEntry controller:', error);
      sendErrorResponse(res, 'Failed to delete time entry', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Bulk edit time entries
   * PUT /time-management/bulk-edit
   */
  async bulkUpdateEntries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { entryIds, updates } = req.body;

      const result = await TimeEntriesService.bulkUpdateEntries(
        req.user!,
        entryIds,
        updates,
        {}
      );

      if (result.success) {
        res.json({ message: 'Entries updated successfully' });
      } else {
        sendErrorResponse(res, result.error || 'Failed to update entries', result.code);
      }
    } catch (error: any) {
      console.error('Error in bulkUpdateEntries controller:', error);
      sendErrorResponse(res, 'Failed to update entries', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Bulk delete time entries
   * DELETE /time-management/bulk-delete
   */
  async bulkDeleteEntries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { entryIds } = req.body;

      const result = await TimeEntriesService.bulkDeleteEntries(
        req.user!,
        entryIds,
        {}
      );

      if (result.success) {
        res.json({ message: `${result.data!.count} entries deleted successfully` });
      } else {
        sendErrorResponse(res, result.error || 'Failed to delete entries', result.code);
      }
    } catch (error: any) {
      console.error('Error in bulkDeleteEntries controller:', error);
      sendErrorResponse(res, 'Failed to delete entries', 'INTERNAL_ERROR', error.message);
    }
  }

  /**
   * Get users list
   * GET /time-management/users
   */
  async getActiveUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await TimeEntriesService.getActiveUsers(req.user!, {});
      handleServiceResult(res, result as ServiceResult<any>);
    } catch (error: any) {
      console.error('Error in getActiveUsers controller:', error);
      sendErrorResponse(res, 'Failed to fetch users', 'INTERNAL_ERROR', error.message);
    }
  }
}

// Export singleton instance
export const timeEntriesController = new TimeEntriesController();
