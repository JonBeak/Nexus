/**
 * Vacations Route
 * RESTful endpoint for vacation period management
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 *
 * This is the new, properly architected endpoint for vacation periods.
 * Old endpoint (/accounts/vacations) will proxy to this.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { vacationController } from '../controllers/vacationController';

const router = Router();

/**
 * GET /api/vacations
 * Get all vacation periods
 *
 * Authorization: Requires 'vacations.read' permission
 *
 * Returns: Array of vacation period records with user details
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('vacations.read'),
  (req, res) => vacationController.getAllVacations(req, res)
);

/**
 * GET /api/vacations/user/:userId
 * Get vacation periods for a specific user
 *
 * Route Params:
 *   - userId: number - User ID to fetch vacations for
 *
 * Authorization: Requires 'vacations.read' permission
 *
 * Returns: Array of vacation period records for the specified user
 */
router.get(
  '/user/:userId',
  authenticateToken,
  requirePermission('vacations.read'),
  (req, res) => vacationController.getUserVacations(req, res)
);

/**
 * POST /api/vacations
 * Create a new vacation period
 *
 * Body:
 *   - user_id: number (required)
 *   - start_date: string (required) - ISO date format
 *   - end_date: string (required) - ISO date format
 *   - description: string (optional)
 *
 * Authorization: Requires 'vacations.create' permission
 *
 * Returns: Success message with created vacation_id
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('vacations.create'),
  (req, res) => vacationController.createVacation(req, res)
);

/**
 * DELETE /api/vacations/:vacationId
 * Delete a vacation period
 *
 * Route Params:
 *   - vacationId: number - Vacation period ID to delete
 *
 * Authorization: Requires 'vacations.delete' permission
 *
 * Returns: Success message
 */
router.delete(
  '/:vacationId',
  authenticateToken,
  requirePermission('vacations.delete'),
  (req, res) => vacationController.deleteVacation(req, res)
);

export default router;
