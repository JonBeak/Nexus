/**
 * Vinyl Products Routes (New Architecture)
 * Clean routes that delegate to controllers
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as vinylProductsController from '../controllers/vinyl/vinylProductsController';

const router = Router();

// All vinyl products routes require authentication
router.use(authenticateToken);

// Vinyl Products Routes
router.get('/', vinylProductsController.getVinylProducts);
router.get('/active', vinylProductsController.getActiveProducts);
router.get('/search', vinylProductsController.searchProducts);
router.get('/stats/summary', vinylProductsController.getVinylProductStats);
router.get('/autofill/suggestions', vinylProductsController.getAutofillSuggestions);
router.get('/brand/:brand', vinylProductsController.getProductsByBrand);
router.get('/:id', vinylProductsController.getVinylProductById);

router.post('/', vinylProductsController.createVinylProduct);
router.post('/bulk-update', vinylProductsController.bulkUpdateProducts);
router.post('/sync-from-inventory', vinylProductsController.syncProductFromInventory);

router.put('/:id', vinylProductsController.updateVinylProduct);
router.put('/:id/toggle-status', vinylProductsController.toggleProductStatus);

router.delete('/:id', vinylProductsController.deleteVinylProduct);

export default router;