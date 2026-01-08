/**
 * Staff Tasks Controller
 * HTTP Request Handlers for Staff Task Operations
 *
 * Created: 2025-01-07
 * Handles staff-specific task operations with sanitized data
 * (no customer info, internal notes, or pricing exposed)
 */

import { Response } from 'express';
import { AuthRequest } from '../../types';
import { taskSessionService } from '../../services/taskSessionService';
import { sendErrorResponse } from '../../utils/controllerHelpers';
import { StaffTaskFilters } from '../../types/taskSessions';

// =====================================================
// TASK LIST OPERATIONS
// =====================================================

/**
 * Get tasks assigned to user's production roles
 * GET /api/staff/tasks
 * Query params: include_completed, hours_back, search
 * Permission: jobs.read
 */
export const getStaffTasks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.user_id;

    const filters: StaffTaskFilters = {
      include_completed: req.query.include_completed === 'true',
      hours_back: req.query.hours_back ? parseInt(req.query.hours_back as string) : undefined,
      search: req.query.search as string | undefined
    };

    const result = await taskSessionService.getStaffTasks(userId, filters);

    // Return with nested data object for consistent interceptor handling
    res.json({
      success: true,
      data: {
        tasks: result.tasks,
        user_roles: result.user_roles
      }
    });
  } catch (error) {
    console.error('Error fetching staff tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tasks';
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Get user's currently active tasks and sessions (multiple concurrent tasks supported)
 * GET /api/staff/tasks/active
 * Permission: jobs.read
 */
export const getActiveTasks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.user_id;
    const result = await taskSessionService.getActiveTasks(userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching active tasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch active tasks';
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

// =====================================================
// SESSION OPERATIONS
// =====================================================

/**
 * Start working on a task (create session)
 * POST /api/staff/tasks/:taskId/start
 * Permission: jobs.read
 */
export const startTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.user_id;
    const taskId = parseInt(req.params.taskId);

    if (isNaN(taskId)) {
      return sendErrorResponse(res, 'Invalid task ID', 'VALIDATION_ERROR');
    }

    const result = await taskSessionService.startTaskSession(taskId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error starting task session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start task';

    if (errorMessage.includes('already have an active')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }
    if (errorMessage.includes('not found') || errorMessage.includes('completed')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }
    if (errorMessage.includes('role')) {
      return sendErrorResponse(res, errorMessage, 'FORBIDDEN');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Stop working on a specific task (end session)
 * POST /api/staff/tasks/:taskId/stop
 * Permission: jobs.read
 */
export const stopTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.user_id;
    const taskId = parseInt(req.params.taskId);

    if (isNaN(taskId)) {
      return sendErrorResponse(res, 'Invalid task ID', 'VALIDATION_ERROR');
    }

    const result = await taskSessionService.stopTaskSession(userId, taskId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error stopping task session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to stop task';

    if (errorMessage.includes('No active')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Complete a task (ends all sessions, marks task done)
 * POST /api/staff/tasks/:taskId/complete
 * Permission: jobs.read
 */
export const completeTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.user_id;
    const taskId = parseInt(req.params.taskId);

    if (isNaN(taskId)) {
      return sendErrorResponse(res, 'Invalid task ID', 'VALIDATION_ERROR');
    }

    const result = await taskSessionService.completeTask(taskId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error completing task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete task';

    if (errorMessage.includes('not found') || errorMessage.includes('already completed')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Uncomplete a task (reopen it)
 * POST /api/staff/tasks/:taskId/uncomplete
 * Permission: jobs.read
 */
export const uncompleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.user_id;
    const taskId = parseInt(req.params.taskId);

    if (isNaN(taskId)) {
      return sendErrorResponse(res, 'Invalid task ID', 'VALIDATION_ERROR');
    }

    const result = await taskSessionService.uncompleteTask(taskId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error uncompleting task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reopen task';
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

// =====================================================
// SESSION HISTORY & MANAGEMENT
// =====================================================

/**
 * Get session history for a task
 * GET /api/staff/tasks/:taskId/sessions
 * Staff sees own sessions, managers see all
 * Permission: jobs.read
 */
export const getTaskSessions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.user_id;
    const userRole = req.user!.role;
    const taskId = parseInt(req.params.taskId);

    if (isNaN(taskId)) {
      return sendErrorResponse(res, 'Invalid task ID', 'VALIDATION_ERROR');
    }

    const isManager = userRole === 'manager' || userRole === 'owner';
    const result = await taskSessionService.getTaskSessions(taskId, userId, isManager);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching task sessions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch sessions';
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Update a session (notes for staff, times/notes for managers)
 * PUT /api/staff/sessions/:sessionId
 * Permission: jobs.read (staff can edit own notes), orders.update (managers edit all)
 */
export const updateSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.user_id;
    const userRole = req.user!.role;
    const sessionId = parseInt(req.params.sessionId);

    if (isNaN(sessionId)) {
      return sendErrorResponse(res, 'Invalid session ID', 'VALIDATION_ERROR');
    }

    const { started_at, ended_at, notes } = req.body;
    const updates: any = {};

    if (started_at !== undefined) updates.started_at = new Date(started_at);
    if (ended_at !== undefined) updates.ended_at = ended_at ? new Date(ended_at) : null;
    if (notes !== undefined) updates.notes = notes;

    const isManager = userRole === 'manager' || userRole === 'owner';
    await taskSessionService.updateSession(sessionId, updates, userId, isManager);

    res.json({
      success: true,
      message: 'Session updated successfully'
    });
  } catch (error) {
    console.error('Error updating session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update session';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }
    if (errorMessage.includes('only edit your own')) {
      return sendErrorResponse(res, errorMessage, 'FORBIDDEN');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Delete a session (manager only)
 * DELETE /api/staff/sessions/:sessionId
 * Permission: orders.update
 */
export const deleteSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.user_id;
    const userRole = req.user!.role;
    const sessionId = parseInt(req.params.sessionId);

    if (isNaN(sessionId)) {
      return sendErrorResponse(res, 'Invalid session ID', 'VALIDATION_ERROR');
    }

    const isManager = userRole === 'manager' || userRole === 'owner';
    await taskSessionService.deleteSession(sessionId, userId, isManager);

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete session';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }
    if (errorMessage.includes('Only managers')) {
      return sendErrorResponse(res, errorMessage, 'FORBIDDEN');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};
