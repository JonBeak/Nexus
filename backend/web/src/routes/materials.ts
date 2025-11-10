import { Router } from 'express';
import { getActiveSubstrates } from '../controllers/materialsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/materials/substrates
 * @desc Get all active substrate materials for specification dropdowns
 * @access Private
 */
router.get('/substrates', authenticateToken, getActiveSubstrates);

export default router;
