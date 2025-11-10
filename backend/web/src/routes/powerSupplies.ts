import { Router } from 'express';
import { getActivePowerSupplies } from '../controllers/powerSuppliesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/power-supplies
 * @desc Get all active power supply types for specification dropdowns
 * @access Private
 */
router.get('/', authenticateToken, getActivePowerSupplies);

export default router;
