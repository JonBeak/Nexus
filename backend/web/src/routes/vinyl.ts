// File Clean up Finished: 2025-11-21
// Changes: Removed "New" suffix from filename (vinylNew.ts → vinyl.ts)
//          Updated server.ts import accordingly
//          No functional changes - purely organizational cleanup
/**
 * Vinyl Inventory Routes
 * Clean routes that delegate to controllers
 * RBAC permission middleware
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as vinylInventoryController from '../controllers/vinyl/vinylInventoryController';

const router = Router();

// All vinyl routes require authentication
router.use(authenticateToken);

// Vinyl Inventory Routes with RBAC permissions
// GET routes - require vinyl.read permission
router.get('/', requirePermission('vinyl.read'), vinylInventoryController.getVinylItems);
router.get('/stats/summary', requirePermission('vinyl.read'), vinylInventoryController.getVinylStats);
router.get('/recent/for-copying', requirePermission('vinyl.read'), vinylInventoryController.getRecentVinylForCopying);
router.get('/:id', requirePermission('vinyl.read'), vinylInventoryController.getVinylItemById);
router.get('/:id/job-links', requirePermission('vinyl.read'), vinylInventoryController.getJobLinks);

// POST routes - require vinyl.create permission
router.post('/', requirePermission('vinyl.create'), vinylInventoryController.createVinylItem);
router.post('/status-change', requirePermission('vinyl.update'), vinylInventoryController.changeVinylStatus);

// PUT routes - require vinyl.update permission
router.put('/:id', requirePermission('vinyl.update'), vinylInventoryController.updateVinylItem);
router.put('/:id/use', requirePermission('vinyl.update'), vinylInventoryController.markVinylAsUsed);
router.put('/:id/job-links', requirePermission('vinyl.update'), vinylInventoryController.updateJobLinks);

// DELETE routes - require vinyl.delete permission
router.delete('/:id', requirePermission('vinyl.delete'), vinylInventoryController.deleteVinylItem);

export default router;