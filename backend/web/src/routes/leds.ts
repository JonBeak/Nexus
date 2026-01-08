// File Clean up Finished: Nov 14, 2025 (verified route structure, consolidated duplicate LED queries across codebase)
import { Router } from 'express';
import { getActiveLEDs, getAllLEDs, createLED, updateLED, deactivateLED } from '../controllers/ledsController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/leds
 * @desc Get all active LED types for specification dropdowns
 * @access Private
 */
router.get('/', authenticateToken, getActiveLEDs);

/**
 * @route GET /api/leds/all
 * @desc Get all LED types including inactive (for management UI)
 * @access Manager+
 */
router.get('/all', authenticateToken, requireRole('manager', 'owner'), getAllLEDs);

/**
 * @route POST /api/leds
 * @desc Create a new LED type
 * @access Manager+
 */
router.post('/', authenticateToken, requireRole('manager', 'owner'), createLED);

/**
 * @route PUT /api/leds/:ledId
 * @desc Update an existing LED type
 * @access Manager+
 */
router.put('/:ledId', authenticateToken, requireRole('manager', 'owner'), updateLED);

/**
 * @route DELETE /api/leds/:ledId
 * @desc Deactivate an LED type (soft delete)
 * @access Manager+
 */
router.delete('/:ledId', authenticateToken, requireRole('manager', 'owner'), deactivateLED);

export default router;
