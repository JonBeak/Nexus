// File Clean up Finished: Nov 14, 2025 (second cleanup)
// Current cleanup:
// - Instantiated BreakScheduleService (instance-based pattern)
// - Removed user parameter from getScheduledBreaks() call (no longer needed)
// - Updated to call instance methods instead of static methods
//
// Previous cleanup (earlier Nov 14, 2025):
// - Removed 2 redundant auth checks (middleware guarantees user exists)
// - Replaced ID validation with parseIntParam() helper
// - Replaced error handling with sendErrorResponse() helper
// - Changed Request param to AuthRequest for type safety
// - Added non-null assertions (req.user!) since auth middleware guarantees user
// - Reduced from 90 → 67 lines (26% reduction)
import { Response } from 'express';
import { BreakScheduleService } from '../../services/timeTracking/BreakScheduleService';
import { AuthRequest } from '../../types';
import { parseIntParam, sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Break Schedule Controller
 * Handles HTTP requests for scheduled breaks management
 */

// Instantiate service
const breakScheduleService = new BreakScheduleService();

/**
 * Get scheduled breaks (for settings page)
 * GET /api/time/scheduled-breaks
 */
export const getScheduledBreaks = async (req: AuthRequest, res: Response) => {
  try {
    const breaks = await breakScheduleService.getScheduledBreaks();
    res.json(breaks);
  } catch (error: any) {
    console.error('Error fetching scheduled breaks:', error);
    sendErrorResponse(res, 'Failed to fetch scheduled breaks', 'INTERNAL_ERROR');
  }
};

/**
 * Update scheduled break (managers only)
 * PUT /api/time/scheduled-breaks/:id
 */
export const updateScheduledBreak = async (req: AuthRequest, res: Response) => {
  try {
    const breakId = parseIntParam(req.params.id, 'break ID');
    if (breakId === null) {
      return sendErrorResponse(res, 'Invalid break ID', 'VALIDATION_ERROR');
    }

    const { start_time, end_time, duration_minutes, days_of_week } = req.body;

    const result = await breakScheduleService.updateScheduledBreak(req.user!, breakId, {
      start_time,
      end_time,
      duration_minutes,
      days_of_week
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error updating scheduled break:', error);

    if (error.message.includes('Insufficient permissions')) {
      return sendErrorResponse(res, error.message, 'PERMISSION_DENIED');
    }

    if (error.message.includes('not found')) {
      return sendErrorResponse(res, error.message, 'NOT_FOUND');
    }

    if (error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('Duration')) {
      return sendErrorResponse(res, error.message, 'VALIDATION_ERROR');
    }

    sendErrorResponse(res, 'Failed to update scheduled break', 'INTERNAL_ERROR');
  }
};
