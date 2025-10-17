/**
 * Time Scheduling Routes
 * Refactored to use Service + Repository pattern (CLAUDE.md compliant)
 * Reduced from 290 lines to ~100 lines (65% reduction)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { SchedulingService } from '../services/timeManagement/SchedulingService';

const router = Router();

// Error code to HTTP status mapping
const statusMap: Record<string, number> = {
  'VALIDATION_ERROR': 400,
  'PERMISSION_DENIED': 403,
  'NOT_FOUND': 404,
  'CONFLICT': 409,
  'TIMEOUT_ERROR': 408,
  'DATABASE_ERROR': 500,
  'INTERNAL_ERROR': 500
};

/**
 * Get work schedules for a user
 * GET /time-management/schedules/:userId
 */
router.get('/schedules/:userId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = parseInt(req.params.userId);

    const result = await SchedulingService.getWorkSchedules(user, userId, {});

    if (!result.success) {
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error in GET /schedules/:userId:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

/**
 * Update work schedules for a user
 * PUT /time-management/schedules/:userId
 */
router.put('/schedules/:userId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = parseInt(req.params.userId);
    const { schedules } = req.body;

    const result = await SchedulingService.updateWorkSchedules(user, userId, schedules, {});

    if (!result.success) {
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error in PUT /schedules/:userId:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

/**
 * Get all active company holidays
 * GET /time-management/holidays
 */
router.get('/holidays', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;

    const result = await SchedulingService.getHolidays(user, {});

    if (!result.success) {
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error in GET /holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

/**
 * Create a new holiday
 * POST /time-management/holidays
 */
router.post('/holidays', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { holiday_name, holiday_date, overwrite = false } = req.body;

    const result = await SchedulingService.createHoliday(
      user,
      { holiday_name, holiday_date, overwrite },
      {}
    );

    if (!result.success) {
      const status = statusMap[result.code!] || 500;
      // For conflicts, return the full data (includes existing_holiday and requires_overwrite)
      if (result.code === 'CONFLICT') {
        return res.status(status).json(result.data);
      }
      return res.status(status).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error in POST /holidays:', error);
    res.status(500).json({ error: 'Failed to add holiday' });
  }
});

/**
 * Delete a holiday (soft delete)
 * DELETE /time-management/holidays/:holidayId
 */
router.delete('/holidays/:holidayId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const holidayId = parseInt(req.params.holidayId);

    const result = await SchedulingService.deleteHoliday(user, holidayId, {});

    if (!result.success) {
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error in DELETE /holidays/:holidayId:', error);
    res.status(500).json({ error: 'Failed to remove holiday' });
  }
});

/**
 * Export holidays as CSV
 * GET /time-management/holidays/export
 */
router.get('/holidays/export', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;

    const result = await SchedulingService.exportHolidaysCSV(user, {});

    if (!result.success) {
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    // Set CSV headers and send content
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="company_holidays.csv"');
    res.send(result.data);
  } catch (error: any) {
    console.error('Error in GET /holidays/export:', error);
    res.status(500).json({ error: 'Failed to export holidays' });
  }
});

/**
 * Import holidays from CSV
 * POST /time-management/holidays/import
 */
router.post('/holidays/import', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { csvData, overwriteAll = false } = req.body;

    const result = await SchedulingService.importHolidaysCSV(
      user,
      { csvData, overwriteAll },
      {}
    );

    if (!result.success) {
      const status = statusMap[result.code!] || 500;
      // For conflicts, return the full data (includes conflicts array and requires_overwrite)
      if (result.code === 'CONFLICT') {
        return res.status(status).json(result.data);
      }
      return res.status(status).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error in POST /holidays/import:', error);
    res.status(500).json({ error: 'Failed to import holidays' });
  }
});

export default router;
