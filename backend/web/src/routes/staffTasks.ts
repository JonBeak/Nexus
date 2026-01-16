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
  getTodaySessions,
  getTaskSessions,
  updateSession,
  deleteSession,
  getSessionNotes,
  getTaskNotes,
  createSessionNote,
  updateSessionNote,
  deleteSessionNote
} from '../controllers/staff/StaffTasksController';

import {
  submitEditRequest,
  submitDeleteRequest,
  getPendingRequests,
  getPendingCount,
  processRequest,
  getPendingRequestForSession,
  updateEditRequest,
  cancelEditRequest
} from '../controllers/staff/SessionEditRequestController';

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

// Get user's completed sessions for today
// GET /api/staff/sessions/today
router.get('/sessions/today', requirePermission('jobs.read'), getTodaySessions);

// Get session history for a task
// GET /api/staff/tasks/:taskId/sessions
router.get('/tasks/:taskId/sessions', requirePermission('jobs.read'), getTaskSessions);

// Update a session (staff: notes only, managers: times + notes)
// PUT /api/staff/sessions/:sessionId
router.put('/sessions/:sessionId', requirePermission('jobs.read'), updateSession);

// Delete a session (manager only)
// DELETE /api/staff/sessions/:sessionId
router.delete('/sessions/:sessionId', requirePermission('orders.update'), deleteSession);

// =====================================================
// SESSION NOTES
// =====================================================

// Get notes for a session
// GET /api/staff/sessions/:sessionId/notes
router.get('/sessions/:sessionId/notes', requirePermission('jobs.read'), getSessionNotes);

// Create a note on a session
// POST /api/staff/sessions/:sessionId/notes
router.post('/sessions/:sessionId/notes', requirePermission('jobs.read'), createSessionNote);

// Get all notes for a task (across all sessions)
// GET /api/staff/tasks/:taskId/notes
router.get('/tasks/:taskId/notes', requirePermission('jobs.read'), getTaskNotes);

// Update a note (users can edit their own, managers can edit any)
// PUT /api/staff/notes/:noteId
router.put('/notes/:noteId', requirePermission('jobs.read'), updateSessionNote);

// Delete a note (users can delete their own, managers can delete any)
// DELETE /api/staff/notes/:noteId
router.delete('/notes/:noteId', requirePermission('jobs.read'), deleteSessionNote);

// =====================================================
// SESSION EDIT REQUESTS
// =====================================================

// Submit edit request (staff can request changes to their own sessions)
// POST /api/staff/sessions/edit-request
router.post('/sessions/edit-request', requirePermission('jobs.read'), submitEditRequest);

// Update pending edit request (staff can update their own pending requests)
// PUT /api/staff/sessions/edit-request
router.put('/sessions/edit-request', requirePermission('jobs.read'), updateEditRequest);

// Cancel pending edit request (staff can cancel their own)
// POST /api/staff/sessions/edit-request/:requestId/cancel
router.post('/sessions/edit-request/:requestId/cancel', requirePermission('jobs.read'), cancelEditRequest);

// Get pending request for a specific session (staff view their own)
// GET /api/staff/sessions/:sessionId/pending-request
router.get('/sessions/:sessionId/pending-request', requirePermission('jobs.read'), getPendingRequestForSession);

// Submit delete request (staff can request deletion of their own sessions)
// POST /api/staff/sessions/delete-request
router.post('/sessions/delete-request', requirePermission('jobs.read'), submitDeleteRequest);

// Get pending session edit requests (manager only)
// GET /api/staff/sessions/pending-requests
router.get('/sessions/pending-requests', requirePermission('orders.update'), getPendingRequests);

// Get pending request count (manager only, for badge)
// GET /api/staff/sessions/pending-count
router.get('/sessions/pending-count', requirePermission('orders.update'), getPendingCount);

// Process session edit request (manager only)
// POST /api/staff/sessions/process-request
router.post('/sessions/process-request', requirePermission('orders.update'), processRequest);

export default router;
