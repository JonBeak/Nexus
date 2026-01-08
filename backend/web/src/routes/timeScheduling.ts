// File Clean up Finished: 2025-11-21
// Changes:
// - Migrated from inline controllers to dedicated TimeSchedulingController
// - Removed duplicated statusMap (now uses controllerHelpers.ts)
// - Reduced from 221 lines to ~45 lines (80% reduction)
// - Architecture: Route → Controller → Service → Repository

/**
 * Time Scheduling Routes
 * Clean route definitions - all logic in controller/service layers
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { timeSchedulingController } from '../controllers/timeTracking/TimeSchedulingController';

const router = Router();

/**
 * Get work schedules for a user
 * GET /time-management/schedules/:userId
 */
router.get('/schedules/:userId',
  authenticateToken,
  requirePermission('time_management.update'),
  (req, res) => timeSchedulingController.getWorkSchedules(req, res)
);

/**
 * Update work schedules for a user
 * PUT /time-management/schedules/:userId
 */
router.put('/schedules/:userId',
  authenticateToken,
  requirePermission('time_management.update'),
  (req, res) => timeSchedulingController.updateWorkSchedules(req, res)
);

/**
 * Get all active company holidays
 * GET /time-management/holidays
 * Read-only - available to all authenticated users
 */
router.get('/holidays',
  authenticateToken,
  (req, res) => timeSchedulingController.getHolidays(req, res)
);

/**
 * Create a new holiday
 * POST /time-management/holidays
 */
router.post('/holidays',
  authenticateToken,
  requirePermission('time_management.update'),
  (req, res) => timeSchedulingController.createHoliday(req, res)
);

/**
 * Delete a holiday (soft delete)
 * DELETE /time-management/holidays/:holidayId
 */
router.delete('/holidays/:holidayId',
  authenticateToken,
  requirePermission('time_management.update'),
  (req, res) => timeSchedulingController.deleteHoliday(req, res)
);

/**
 * Export holidays as CSV
 * GET /time-management/holidays/export
 */
router.get('/holidays/export',
  authenticateToken,
  requirePermission('time_management.update'),
  (req, res) => timeSchedulingController.exportHolidaysCSV(req, res)
);

/**
 * Import holidays from CSV
 * POST /time-management/holidays/import
 */
router.post('/holidays/import',
  authenticateToken,
  requirePermission('time_management.update'),
  (req, res) => timeSchedulingController.importHolidaysCSV(req, res)
);

export default router;
