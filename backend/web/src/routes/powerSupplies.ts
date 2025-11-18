// File Clean up Finished: 2025-11-15
// Assessment: No changes required
// - Already follows 3-layer architecture (Route → Controller → Service → Repository)
// - Controller, Service, and Repository already cleaned and using query() helper
// - No dead code, no unused imports, no architectural issues
// - File size: 15 lines (well under limit)
// - Actively used by frontend for power supply catalog
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
