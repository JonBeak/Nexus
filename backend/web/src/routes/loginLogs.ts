/**
 * Login Logs Route
 * RESTful endpoint for login log management
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 *
 * This is the new, properly architected endpoint for login logs.
 * Old endpoint (/accounts/login-logs) will proxy to this.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { loginLogController } from '../controllers/loginLogController';

const router = Router();

/**
 * GET /api/login-logs
 * Get all login logs
 *
 * Query Params:
 *   - limit: number (default: 100, max: 1000) - Maximum number of logs to return
 *
 * Authorization: Requires 'login_logs.read' permission
 *
 * Returns: Array of login log records with user details
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('login_logs.read'),
  (req, res) => loginLogController.getAllLogs(req, res)
);

/**
 * GET /api/login-logs/user/:userId
 * Get login logs for a specific user
 *
 * Route Params:
 *   - userId: number - User ID to fetch logs for
 *
 * Query Params:
 *   - limit: number (default: 100, max: 1000) - Maximum number of logs to return
 *
 * Authorization: Requires 'login_logs.read' permission
 *
 * Returns: Array of login log records for the specified user
 */
router.get(
  '/user/:userId',
  authenticateToken,
  requirePermission('login_logs.read'),
  (req, res) => loginLogController.getUserLogs(req, res)
);

export default router;
