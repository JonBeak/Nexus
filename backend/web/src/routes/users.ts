/**
 * Users Route
 * RESTful endpoint for user management
 *
 * Created: Nov 13, 2025
 * Part of cleanup: Consolidating /auth/users and /accounts/users endpoints
 *
 * This is the new, properly architected endpoint for user data.
 * Old endpoints (/auth/users and /accounts/users) will proxy to this.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { userController } from '../controllers/userController';

const router = Router();

/**
 * GET /api/users
 * Get all users with optional filtering
 *
 * Query Params:
 *   - includeInactive: 'true' | 'false' (default: false) - Include inactive users
 *   - fields: 'basic' | 'full' (default: 'basic') - Field set to return
 *
 * Authorization: Requires 'users.read' permission
 *
 * Examples:
 *   GET /api/users                                  -> Active users, basic fields
 *   GET /api/users?fields=full                      -> Active users, all fields
 *   GET /api/users?includeInactive=true&fields=full -> All users, all fields
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('users.read'),
  (req, res) => userController.getUsers(req, res)
);

/**
 * GET /api/users/:userId
 * Get specific user by ID
 *
 * Authorization: Requires 'users.read' permission
 */
router.get(
  '/:userId',
  authenticateToken,
  requirePermission('users.read'),
  (req, res) => userController.getUserById(req, res)
);

/**
 * POST /api/users
 * Create a new user
 *
 * Body:
 *   - first_name: string (required)
 *   - last_name: string (required)
 *   - email: string (required)
 *   - password: string (required)
 *   - role: string (required)
 *   - user_group?: string | null
 *   - hourly_wage?: number | null
 *   - auto_clock_in?: string | null
 *   - auto_clock_out?: string | null
 *
 * Authorization: Requires 'users.create' permission
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('users.create'),
  (req, res) => userController.createUser(req, res)
);

/**
 * PUT /api/users/:userId
 * Update an existing user
 *
 * Body:
 *   - username: string (required)
 *   - first_name: string (required)
 *   - last_name: string (required)
 *   - email: string (required)
 *   - role: string (required)
 *   - user_group?: string | null
 *   - hourly_wage?: number | null
 *   - auto_clock_in?: string | null
 *   - auto_clock_out?: string | null
 *   - is_active: number (required)
 *
 * Authorization: Requires 'users.update' permission
 */
router.put(
  '/:userId',
  authenticateToken,
  requirePermission('users.update'),
  (req, res) => userController.updateUser(req, res)
);

/**
 * PUT /api/users/:userId/password
 * Update user password
 *
 * Body:
 *   - password: string (required)
 *
 * Authorization: Requires 'users.update' permission
 */
router.put(
  '/:userId/password',
  authenticateToken,
  requirePermission('users.update'),
  (req, res) => userController.updatePassword(req, res)
);

export default router;
