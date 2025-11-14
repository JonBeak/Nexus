// File Clean up Finished: Nov 14, 2025
// Changes:
// - Removed 4 redundant auth checks (middleware guarantees user exists)
// - Removed debug logging from clockOut function
// - Replaced error handling with sendErrorResponse() helper
// - Changed Request param to AuthRequest for type safety
// - Added non-null assertions (req.user!) since auth middleware guarantees user
// - Reduced from 117 → 78 lines (33% reduction)
import { Response } from 'express';
import { ClockService } from '../../services/timeTracking/ClockService';
import { AuthRequest } from '../../types';
import { sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Clock Controller
 * Handles HTTP requests for clock operations, status, and weekly summary
 */

/**
 * Get current clock status for a user
 * GET /api/time/status
 */
export const getClockStatus = async (req: AuthRequest, res: Response) => {
  try {
    const result = await ClockService.getClockStatus(req.user!);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching time status:', error);
    sendErrorResponse(res, 'Failed to fetch time status', 'INTERNAL_ERROR');
  }
};

/**
 * Clock in a user
 * POST /api/time/clock-in
 */
export const clockIn = async (req: AuthRequest, res: Response) => {
  try {
    const result = await ClockService.clockIn(req.user!);
    res.json(result);
  } catch (error: any) {
    console.error('Error clocking in:', error);

    if (error.message === 'Already clocked in') {
      return res.status(400).json({ error: error.message });
    }

    sendErrorResponse(res, 'Failed to clock in', 'INTERNAL_ERROR');
  }
};

/**
 * Clock out a user
 * POST /api/time/clock-out
 */
export const clockOut = async (req: AuthRequest, res: Response) => {
  try {
    const result = await ClockService.clockOut(req.user!);
    res.json(result);
  } catch (error: any) {
    console.error('Error clocking out:', error);

    if (error.message === 'Not clocked in') {
      return res.status(400).json({ error: error.message });
    }

    sendErrorResponse(res, 'Failed to clock out', 'INTERNAL_ERROR');
  }
};

/**
 * Get weekly summary for a user
 * GET /api/time/weekly-summary?weekOffset=0
 */
export const getWeeklySummary = async (req: AuthRequest, res: Response) => {
  try {
    const weekOffset = parseInt(req.query.weekOffset as string) || 0;
    const result = await ClockService.getWeeklySummary(req.user!, weekOffset);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching weekly summary:', error);
    sendErrorResponse(res, 'Failed to fetch weekly summary', 'INTERNAL_ERROR');
  }
};
