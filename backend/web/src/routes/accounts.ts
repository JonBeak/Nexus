/**
 * File Clean up Finished: Nov 13, 2025
 * Auditing for architectural violations related to user endpoints
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { userController } from '../controllers/userController';
import { loginLogController } from '../controllers/loginLogController';
import { vacationController } from '../controllers/vacationController';

const router = Router();

/**
 * Get all users (managers and owners only)
 *
 * DEPRECATED: This endpoint is maintained for backward compatibility.
 * New code should use GET /api/users?fields=full&includeInactive=true instead.
 *
 * Returns: All users (active + inactive) with full fields (12 fields)
 * Migration: This proxies to the new UserController with proper 3-layer architecture
 */
router.get('/users', authenticateToken, requirePermission('users.read'), async (req, res) => {
  // Proxy to new controller with backward-compatible defaults
  req.query.includeInactive = 'true';   // All users (original behavior)
  req.query.fields = 'full';            // Full fields (original behavior)

  return userController.getUsers(req, res);
});

// Create new user
// ✅ POST /accounts/users - Proxies to UserController (3-layer architecture)
router.post('/users', authenticateToken, (req, res) => userController.createUser(req, res));

// ✅ PUT /accounts/users/:userId - Proxies to UserController (3-layer architecture)
router.put('/users/:userId', authenticateToken, (req, res) => userController.updateUser(req, res));

// ✅ PUT /accounts/users/:userId/password - Proxies to UserController (3-layer architecture)
router.put('/users/:userId/password', authenticateToken, (req, res) => userController.updatePassword(req, res));

// ✅ GET /accounts/login-logs - Proxies to LoginLogController (3-layer architecture)
router.get('/login-logs', authenticateToken, (req, res) => loginLogController.getAllLogs(req, res));

// ✅ GET /accounts/login-logs/user/:userId - Proxies to LoginLogController (3-layer architecture)
router.get('/login-logs/user/:userId', authenticateToken, (req, res) => loginLogController.getUserLogs(req, res));

// ✅ GET /accounts/vacations - Proxies to VacationController (3-layer architecture)
router.get('/vacations', authenticateToken, (req, res) => vacationController.getAllVacations(req, res));

// ✅ GET /accounts/vacations/user/:userId - Proxies to VacationController (3-layer architecture)
router.get('/vacations/user/:userId', authenticateToken, (req, res) => vacationController.getUserVacations(req, res));

// ✅ POST /accounts/vacations - Proxies to VacationController (3-layer architecture)
router.post('/vacations', authenticateToken, (req, res) => vacationController.createVacation(req, res));

// ✅ DELETE /accounts/vacations/:vacationId - Proxies to VacationController (3-layer architecture)
router.delete('/vacations/:vacationId', authenticateToken, (req, res) => vacationController.deleteVacation(req, res));

export default router;