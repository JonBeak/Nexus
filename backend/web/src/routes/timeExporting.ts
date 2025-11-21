// File Clean up Finished: 2025-11-20
// Changes:
// - Migrated from route with business logic to clean 3-layer architecture
// - Removed pool.execute() usage (moved to repository layer)
// - Removed SharedQueryBuilder import (moved to repository layer)
// - Extracted business logic to TimeExportingService
// - Extracted HTTP handling to TimeExportingController
// - Reduced from 77 lines to 16 lines (79% reduction)
// - Now follows pattern: Route → Controller → Service → Repository → Database
/**
 * Time Exporting Routes
 * Clean route definition - all logic in controller/service layers
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { exportEntries } from '../controllers/timeTracking/TimeExportingController';

const router = Router();

/**
 * Export time entries
 * GET /time-management/export
 */
router.get('/export', authenticateToken, requirePermission('time_tracking.export'), exportEntries);

export default router;
