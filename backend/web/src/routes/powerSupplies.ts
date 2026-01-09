// File Clean up Finished: 2025-11-15
// Updated: Added full CRUD endpoints for power supplies management
import { Router } from 'express';
import {
  getActivePowerSupplies,
  getAllPowerSupplies,
  createPowerSupply,
  updatePowerSupply,
  deactivatePowerSupply
} from '../controllers/powerSuppliesController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/power-supplies
 * @desc Get all active power supply types for specification dropdowns
 * @access Private
 */
router.get('/', authenticateToken, getActivePowerSupplies);

/**
 * @route GET /api/power-supplies/all
 * @desc Get all power supplies including inactive (for management UI)
 * @access Manager+
 */
router.get('/all', authenticateToken, requireRole('manager', 'owner'), getAllPowerSupplies);

/**
 * @route POST /api/power-supplies
 * @desc Create a new power supply
 * @access Manager+
 */
router.post('/', authenticateToken, requireRole('manager', 'owner'), createPowerSupply);

/**
 * @route PUT /api/power-supplies/:powerSupplyId
 * @desc Update an existing power supply
 * @access Manager+
 */
router.put('/:powerSupplyId', authenticateToken, requireRole('manager', 'owner'), updatePowerSupply);

/**
 * @route DELETE /api/power-supplies/:powerSupplyId
 * @desc Deactivate a power supply (soft delete)
 * @access Manager+
 */
router.delete('/:powerSupplyId', authenticateToken, requireRole('manager', 'owner'), deactivatePowerSupply);

export default router;
