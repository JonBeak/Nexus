/**
 * Staff Tasks Routes
 * API routes for staff task and session operations
 *
 * Created: 2025-01-07
 * Base path: /api/staff
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

// Import controllers
import {
  getStaffTasks,
  getActiveTasks,
  startTask,
  stopTask,
  completeTask,
  uncompleteTask,
  getTaskSessions,
  updateSession,
  deleteSession
} from '../controllers/staff/StaffTasksController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// =====================================================
// TASK OPERATIONS
// =====================================================

// Get tasks for user's production roles
// GET /api/staff/tasks?include_completed=false&hours_back=168&search=
router.get('/tasks', requirePermission('jobs.read'), getStaffTasks);

// Get user's currently active tasks and sessions (multiple concurrent tasks supported)
// GET /api/staff/tasks/active
router.get('/tasks/active', requirePermission('jobs.read'), getActiveTasks);

// Start working on a task (create session)
// POST /api/staff/tasks/:taskId/start
router.post('/tasks/:taskId/start', requirePermission('jobs.read'), startTask);

// Stop working on a specific task (end session)
// POST /api/staff/tasks/:taskId/stop
router.post('/tasks/:taskId/stop', requirePermission('jobs.read'), stopTask);

// Complete a task (ends all sessions, marks done)
// POST /api/staff/tasks/:taskId/complete
router.post('/tasks/:taskId/complete', requirePermission('jobs.read'), completeTask);

// Uncomplete a task (reopen it)
// POST /api/staff/tasks/:taskId/uncomplete
router.post('/tasks/:taskId/uncomplete', requirePermission('jobs.read'), uncompleteTask);

// =====================================================
// SESSION MANAGEMENT
// =====================================================

// Get session history for a task
// GET /api/staff/tasks/:taskId/sessions
router.get('/tasks/:taskId/sessions', requirePermission('jobs.read'), getTaskSessions);

// Update a session (staff: notes only, managers: times + notes)
// PUT /api/staff/sessions/:sessionId
router.put('/sessions/:sessionId', requirePermission('jobs.read'), updateSession);

// Delete a session (manager only)
// DELETE /api/staff/sessions/:sessionId
router.delete('/sessions/:sessionId', requirePermission('orders.update'), deleteSession);

export default router;
