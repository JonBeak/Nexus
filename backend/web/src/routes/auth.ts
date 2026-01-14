/**
 * File Clean up Finished: Nov 13, 2025
 * Changes:
 * - Removed architectural violation: Direct database query in route
 * - Updated /users endpoint to proxy to new UserController (proper 3-layer architecture)
 * - This endpoint maintained for backward compatibility with existing frontend code
 * - Migration plan: Frontend should eventually use /api/users instead
 */
import { Router } from 'express';
import { login, getCurrentUser, refreshToken, updateThemePreference } from '../controllers/authController';
import { authenticateToken, requireProductionAccess } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { userController } from '../controllers/userController';

const router = Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/me', authenticateToken, requireProductionAccess, getCurrentUser);
router.patch('/me/theme', authenticateToken, requireProductionAccess, updateThemePreference);

/**
 * Get all users (requires users.read permission)
 *
 * DEPRECATED: This endpoint is maintained for backward compatibility.
 * New code should use GET /api/users instead.
 *
 * Returns: Active users with basic fields (7 fields)
 * Migration: This proxies to the new UserController with proper 3-layer architecture
 */
router.get('/users', authenticateToken, requireProductionAccess, requirePermission('users.read'), async (req, res) => {
  // Proxy to new controller with backward-compatible defaults
  req.query.includeInactive = 'false';  // Only active users (original behavior)
  req.query.fields = 'basic';           // Basic fields only (original behavior)

  return userController.getUsers(req, res);
});

export default router;