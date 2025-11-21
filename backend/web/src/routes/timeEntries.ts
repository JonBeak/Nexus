// File Clean up Finished: 2025-11-21
// Changes:
// - Migrated from inline controllers to dedicated TimeEntriesController
// - Removed 7 duplicated statusMap blocks (now uses controllerHelpers.ts)
// - Reduced from 293 lines to ~55 lines (81% reduction)
// - Architecture: Route -> Controller -> Service -> Repository

/**
 * Time Entries Routes
 * Clean route definitions - all logic in controller/service layers
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { timeEntriesController } from '../controllers/timeTracking/TimeEntriesController';

const router = Router();

/**
 * Get time entries with filters
 * GET /time-management/entries
 */
router.get('/entries',
  authenticateToken,
  requirePermission('time_tracking.list'),
  (req, res) => timeEntriesController.getTimeEntries(req, res)
);

/**
 * Create new time entry
 * POST /time-management/entries
 */
router.post('/entries',
  authenticateToken,
  requirePermission('time_tracking.create'),
  (req, res) => timeEntriesController.createTimeEntry(req, res)
);

/**
 * Update single time entry
 * PUT /time-management/entries/:entryId
 */
router.put('/entries/:entryId',
  authenticateToken,
  requirePermission('time_tracking.update'),
  (req, res) => timeEntriesController.updateTimeEntry(req, res)
);

/**
 * Delete individual time entry
 * DELETE /time-management/entries/:entryId
 */
router.delete('/entries/:entryId',
  authenticateToken,
  requirePermission('time_tracking.update'),
  (req, res) => timeEntriesController.deleteTimeEntry(req, res)
);

/**
 * Bulk edit time entries
 * PUT /time-management/bulk-edit
 */
router.put('/bulk-edit',
  authenticateToken,
  requirePermission('time_tracking.update'),
  (req, res) => timeEntriesController.bulkUpdateEntries(req, res)
);

/**
 * Bulk delete time entries
 * DELETE /time-management/bulk-delete
 */
router.delete('/bulk-delete',
  authenticateToken,
  requirePermission('time_tracking.update'),
  (req, res) => timeEntriesController.bulkDeleteEntries(req, res)
);

/**
 * Get users list
 * GET /time-management/users
 */
router.get('/users',
  authenticateToken,
  requirePermission('time_tracking.list'),
  (req, res) => timeEntriesController.getActiveUsers(req, res)
);

export default router;
