/**
 * Time Analytics Routes
 * Refactored to use Service + Repository pattern (CLAUDE.md compliant)
 * Reduced from 584 lines to ~200 lines (66% reduction)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { TimeAnalyticsService } from '../services/timeManagement/TimeAnalyticsService';

const router = Router();

/**
 * Get weekly summary data
 * GET /time-management/weekly-summary
 */
router.get('/weekly-summary', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate, users, group } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    // Call service
    const result = await TimeAnalyticsService.getWeeklySummary(
      user,
      { startDate: startDate as string, endDate: endDate as string },
      { group: group as string, users: users as string },
      {}
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error fetching weekly summary:', error);
    res.status(500).json({ error: 'Failed to fetch weekly summary' });
  }
});

/**
 * Get analytics overview
 * GET /time-management/analytics-overview
 */
router.get('/analytics-overview', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate, users, group } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    // Call service
    const result = await TimeAnalyticsService.getAnalyticsOverview(
      user,
      { startDate: startDate as string, endDate: endDate as string },
      { group: group as string, users: users as string },
      {}
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

/**
 * Get analytics data for individual user
 * GET /time-management/analytics
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { userId, startDate, endDate } = req.query;

    // Validate required parameters
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ error: 'User ID, start date, and end date are required' });
    }

    // Call service
    const result = await TimeAnalyticsService.getUserAnalytics(
      user,
      Number(userId),
      { startDate: startDate as string, endDate: endDate as string },
      {}
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({ error: result.error });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * Get missing entries based on work schedules and holidays
 * GET /time-management/missing-entries
 *
 * Complex logic (300+ lines) now extracted to TimeAnalyticsService
 */
router.get('/missing-entries', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate, users, group } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    // Call service with timeout option
    const result = await TimeAnalyticsService.getMissingEntries(
      user,
      { startDate: startDate as string, endDate: endDate as string },
      { group: group as string, users: users as string },
      { timeout: 8000 } // 8 second timeout
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        'VALIDATION_ERROR': 400,
        'PERMISSION_DENIED': 403,
        'NOT_FOUND': 404,
        'TIMEOUT_ERROR': 408,
        'DATABASE_ERROR': 500,
        'INTERNAL_ERROR': 500
      };
      return res.status(statusMap[result.code!] || 500).json({
        error: result.error,
        ...(process.env.NODE_ENV === 'development' && result.details && { details: result.details })
      });
    }

    res.json(result.data);
  } catch (error: any) {
    console.error('Error fetching missing entries:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to fetch missing entries',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
  }
});

export default router;
