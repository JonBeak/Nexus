/**
 * Vinyl Products Routes (New Architecture)
 * Clean routes that delegate to controllers
 * Now with RBAC permission middleware
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import * as vinylProductsController from '../controllers/vinyl/vinylProductsController';

const router = Router();

// All vinyl products routes require authentication
router.use(authenticateToken);

// Vinyl Products Routes with RBAC permissions
// GET routes - require vinyl.read permission
router.get('/', requirePermission('vinyl.read'), vinylProductsController.getVinylProducts);
router.get('/active', requirePermission('vinyl.read'), vinylProductsController.getActiveProducts);
router.get('/search', requirePermission('vinyl.read'), vinylProductsController.searchProducts);
router.get('/stats/summary', requirePermission('vinyl.read'), vinylProductsController.getVinylProductStats);
router.get('/autofill/suggestions', requirePermission('vinyl.read'), vinylProductsController.getAutofillSuggestions);
router.get('/brand/:brand', requirePermission('vinyl.read'), vinylProductsController.getProductsByBrand);
router.get('/:id', requirePermission('vinyl.read'), vinylProductsController.getVinylProductById);

// POST routes - require vinyl.create permission (bulk update needs update permission)
router.post('/', requirePermission('vinyl.create'), vinylProductsController.createVinylProduct);
router.post('/bulk-update', requirePermission('vinyl.update'), vinylProductsController.bulkUpdateProducts);
router.post('/sync-from-inventory', requirePermission('vinyl.create'), vinylProductsController.syncProductFromInventory);

// PUT routes - require vinyl.update permission
router.put('/:id', requirePermission('vinyl.update'), vinylProductsController.updateVinylProduct);
router.put('/:id/toggle-status', requirePermission('vinyl.update'), vinylProductsController.toggleProductStatus);

// DELETE routes - require vinyl.delete permission
router.delete('/:id', requirePermission('vinyl.delete'), vinylProductsController.deleteVinylProduct);

export default router;