// File Clean up Finished: Nov 14, 2025
// Changes:
//   - Migrated from direct database queries to proper 3-layer architecture
//   - Route now follows: Route → Controller → Service → Repository → Database
//   - Removed direct query() calls - business logic moved to JobService
//   - Added support for active_only parameter (required by frontend)
//   - Fixed SQL injection vulnerability (limit was concatenated, now parameterized)
//   - Reduced from 54 lines to 12 lines (pure middleware chain)

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as jobController from '../controllers/jobController';

const router = Router();

// Get all jobs with optional filtering
// Used by: Vinyl inventory, bulk operations, status change modals
router.get('/', authenticateToken, jobController.getJobs);

export default router;