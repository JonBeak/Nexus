/**
 * Pricing Management Routes
 *
 * Generic CRUD routes for all whitelisted pricing tables.
 * All routes require manager+ role.
 */

import { Router } from 'express';
import { getRows, createRow, updateRow, deactivateRow, restoreRow } from '../controllers/pricingManagementController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// All routes require authentication + manager/owner role
const auth = [authenticateToken, requireRole('manager', 'owner')];

/** GET /api/pricing-management/:tableKey - Get all rows */
router.get('/:tableKey', ...auth, getRows);

/** POST /api/pricing-management/:tableKey - Create row */
router.post('/:tableKey', ...auth, createRow);

/** PUT /api/pricing-management/:tableKey/:id - Update row */
router.put('/:tableKey/:id', ...auth, updateRow);

/** DELETE /api/pricing-management/:tableKey/:id - Deactivate row */
router.delete('/:tableKey/:id', ...auth, deactivateRow);

/** PUT /api/pricing-management/:tableKey/:id/restore - Reactivate row */
router.put('/:tableKey/:id/restore', ...auth, restoreRow);

export default router;
