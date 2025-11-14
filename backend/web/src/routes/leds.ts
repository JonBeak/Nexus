// File Clean up Finished: Nov 14, 2025 (verified route structure, consolidated duplicate LED queries across codebase)
import { Router } from 'express';
import { getActiveLEDs } from '../controllers/ledsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/leds
 * @desc Get all active LED types for specification dropdowns
 * @access Private
 */
router.get('/', authenticateToken, getActiveLEDs);

export default router;
