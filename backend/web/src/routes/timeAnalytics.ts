// File Clean up Finished: 2025-11-21

/**
 * Time Analytics Routes
 * Refactored to 4-layer architecture: Route → Controller → Service → Repository
 *
 * Cleanup History:
 * - Phase 1 (Previous): Reduced from 584 lines to ~200 lines (66% reduction)
 * - Phase 2 (2025-11-21): Extracted inline controller logic to TimeAnalyticsController
 *   - Eliminated 87+ lines of duplicated error handling code
 *   - Migrated to standardized helpers (handleServiceResult, sendErrorResponse)
 *   - Reduced from 197 lines to ~80 lines (60% reduction)
 *   - Total reduction from original: 584 → 80 lines (86% reduction)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { timeAnalyticsController } from '../controllers/timeTracking/TimeAnalyticsController';

const router = Router();

/**
 * Get weekly summary data
 * GET /time-management/weekly-summary
 */
router.get('/weekly-summary',
  authenticateToken,
  requirePermission('time_management.view_reports'),
  (req, res) => timeAnalyticsController.getWeeklySummary(req, res)
);

/**
 * Get analytics overview
 * GET /time-management/analytics-overview
 */
router.get('/analytics-overview',
  authenticateToken,
  requirePermission('time_management.view_reports'),
  (req, res) => timeAnalyticsController.getAnalyticsOverview(req, res)
);

/**
 * Get analytics data for individual user
 * GET /time-management/analytics
 */
router.get('/analytics',
  authenticateToken,
  requirePermission('time_management.view_reports'),
  (req, res) => timeAnalyticsController.getUserAnalytics(req, res)
);

/**
 * Get missing entries based on work schedules and holidays
 * GET /time-management/missing-entries
 *
 * Complex logic (300+ lines) delegated to TimeAnalyticsService → MissingEntriesService
 */
router.get('/missing-entries',
  authenticateToken,
  requirePermission('time_management.view_reports'),
  (req, res) => timeAnalyticsController.getMissingEntries(req, res)
);

export default router;
