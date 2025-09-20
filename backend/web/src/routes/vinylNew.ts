/**
 * Vinyl Inventory Routes (New Architecture)
 * Clean routes that delegate to controllers
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as vinylInventoryController from '../controllers/vinyl/vinylInventoryController';

const router = Router();

// All vinyl routes require authentication
router.use(authenticateToken);

// Vinyl Inventory Routes
router.get('/', vinylInventoryController.getVinylItems);
router.get('/stats/summary', vinylInventoryController.getVinylStats);
router.get('/recent/for-copying', vinylInventoryController.getRecentVinylForCopying);
router.get('/:id', vinylInventoryController.getVinylItemById);
router.get('/:id/job-links', vinylInventoryController.getJobLinks);

router.post('/', vinylInventoryController.createVinylItem);
router.post('/status-change', vinylInventoryController.changeVinylStatus);

router.put('/:id', vinylInventoryController.updateVinylItem);
router.put('/:id/use', vinylInventoryController.markVinylAsUsed);
router.put('/:id/job-links', vinylInventoryController.updateJobLinks);

router.delete('/:id', vinylInventoryController.deleteVinylItem);

export default router;