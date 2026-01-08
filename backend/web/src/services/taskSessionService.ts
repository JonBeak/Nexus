/**
 * Task Session Service
 * Business Logic for Task Session Operations
 *
 * Created: 2025-01-07
 * Handles:
 * - Starting/stopping task sessions
 * - Task completion (ends all sessions)
 * - Active task management (1 per user)
 * - Session CRUD operations
 * - Staff task queries (sanitized data)
 */

import { pool } from '../config/database';
import { PoolConnection } from 'mysql2/promise';
import { taskSessionRepository } from '../repositories/taskSessionRepository';
import { orderPartRepository } from '../repositories/orderPartRepository';
import { orderRepository } from '../repositories/orderRepository';
import { orderService } from './orderService';
import {
  TaskSession,
  StaffTask,
  StaffTaskFilters,
  StartSessionResponse,
  StopSessionResponse,
  CompleteTaskResponse,
  ActiveTasksResponse,
  ActiveTaskInfo,
  TaskSessionHistory,
  UpdateSessionData
} from '../types/taskSessions';
import { ProductionRole } from '../types/orders';

export class TaskSessionService {

  // =====================================================
  // START TASK SESSION
  // =====================================================

  /**
   * Start a new task session for a user
   * - Validates user doesn't already have session on THIS task (allows multiple tasks)
   * - Validates user has matching production role
   * - Creates session
   * - Triggers order status: production_queue → in_production
   */
  async startTaskSession(taskId: number, userId: number): Promise<StartSessionResponse> {
    // Start transaction
    const connection = await pool.getConnection() as PoolConnection;
    await connection.beginTransaction();

    try {
      // Check if user already has an active session on THIS task (prevent duplicate)
      const existingSession = await taskSessionRepository.getActiveSessionForUserTask(userId, taskId);
      if (existingSession) {
        throw new Error(`You already have an active session on this task.`);
      }

      // Check if task exists and is not completed
      const isAvailable = await taskSessionRepository.isTaskAvailable(taskId);
      if (!isAvailable) {
        throw new Error('Task not found or already completed');
      }

      // Validate user has matching production role
      const taskRole = await taskSessionRepository.getTaskRole(taskId);
      const userRoles = await taskSessionRepository.getUserProductionRoles(userId);

      if (taskRole && !userRoles.includes(taskRole)) {
        throw new Error(`This task requires the "${taskRole}" role. Your roles: ${userRoles.join(', ') || 'none'}`);
      }

      // Create the session
      const sessionId = await taskSessionRepository.createSession(
        { task_id: taskId, user_id: userId },
        connection
      );

      // Check if order needs status transition (production_queue → in_production)
      const orderId = await taskSessionRepository.getTaskOrderId(taskId);
      if (orderId) {
        const order = await orderRepository.getOrderById(orderId);
        if (order && order.status === 'production_queue') {
          await orderService.updateOrderStatus(
            orderId,
            'in_production',
            userId,
            'Automatically moved to In Production (task session started)'
          );
        }
      }

      await connection.commit();

      return {
        session_id: sessionId,
        task_id: taskId,
        message: 'Task session started successfully'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // =====================================================
  // STOP TASK SESSION
  // =====================================================

  /**
   * Stop a specific task session for a user
   * - Ends the session (sets ended_at)
   */
  async stopTaskSession(userId: number, taskId: number): Promise<StopSessionResponse> {
    const connection = await pool.getConnection() as PoolConnection;
    await connection.beginTransaction();

    try {
      // Get active session for this specific task
      const activeSession = await taskSessionRepository.getActiveSessionForUserTask(userId, taskId);
      if (!activeSession) {
        throw new Error('No active session found for this task');
      }

      // End the session
      await taskSessionRepository.endSession(activeSession.session_id, connection);

      await connection.commit();

      // Calculate duration
      const endedSession = await taskSessionRepository.getSessionById(activeSession.session_id);
      const duration = endedSession?.duration_minutes || 0;

      return {
        session_id: activeSession.session_id,
        task_id: taskId,
        duration_minutes: duration,
        message: `Task session stopped. Duration: ${duration} minutes`
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // =====================================================
  // COMPLETE TASK
  // =====================================================

  /**
   * Uncomplete a task (reopen it)
   * - Marks task as not completed
   */
  async uncompleteTask(taskId: number, userId: number): Promise<{ task_id: number; message: string }> {
    // Mark task as not completed
    await orderPartRepository.updateTaskCompletion(taskId, false, userId);

    return {
      task_id: taskId,
      message: 'Task reopened successfully'
    };
  }

  /**
   * Complete a task
   * - Ends ALL active sessions for this task (multiple staff)
   * - Marks task as completed
   * - Triggers order status check: all done → qc_packing
   */
  async completeTask(taskId: number, userId: number): Promise<CompleteTaskResponse> {
    const connection = await pool.getConnection() as PoolConnection;
    await connection.beginTransaction();

    try {
      // Check if task exists and is not already completed
      const isAvailable = await taskSessionRepository.isTaskAvailable(taskId);
      if (!isAvailable) {
        throw new Error('Task not found or already completed');
      }

      // End all active sessions for this task
      const affectedUserIds = await taskSessionRepository.endAllTaskSessions(taskId, connection);

      // Mark task as completed using existing repository (within transaction)
      await orderPartRepository.updateTaskCompletion(taskId, true, userId, connection);

      // Check if order needs status transition (all tasks done → qc_packing)
      const orderId = await taskSessionRepository.getTaskOrderId(taskId);
      if (orderId) {
        const allTasksCompleted = await this.areAllTasksCompleted(orderId);
        const order = await orderRepository.getOrderById(orderId);

        if (order && allTasksCompleted &&
            (order.status === 'production_queue' ||
             order.status === 'in_production' ||
             order.status === 'overdue')) {
          await orderService.updateOrderStatus(
            orderId,
            'qc_packing',
            userId,
            'Automatically moved to QC & Packing (all tasks completed)'
          );
        }
      }

      await connection.commit();

      return {
        task_id: taskId,
        sessions_closed: affectedUserIds.length,
        message: `Task completed. ${affectedUserIds.length} session(s) closed.`
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check if all tasks for an order are completed
   */
  private async areAllTasksCompleted(orderId: number): Promise<boolean> {
    const tasks = await orderPartRepository.getOrderTasks(orderId);
    if (tasks.length === 0) return false;
    return tasks.every(task => task.completed);
  }

  // =====================================================
  // CLOSE ALL USER SESSIONS (Clock-out Integration)
  // =====================================================

  /**
   * Close all active sessions for a user
   * Called by ClockService.clockOut()
   * Returns count of sessions closed
   */
  async closeAllUserSessions(userId: number): Promise<number> {
    const connection = await pool.getConnection() as PoolConnection;
    await connection.beginTransaction();

    try {
      // End all active sessions
      const sessionsEnded = await taskSessionRepository.endAllUserSessions(userId, connection);

      await connection.commit();
      return sessionsEnded;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // =====================================================
  // ACTIVE TASK QUERIES
  // =====================================================

  /**
   * Get user's ALL active tasks and sessions (multiple concurrent tasks supported)
   */
  async getActiveTasks(userId: number): Promise<ActiveTasksResponse> {
    // Get all active sessions for user
    const activeSessions = await taskSessionRepository.getActiveSessionsForUser(userId);

    if (activeSessions.length === 0) {
      return {
        has_active_tasks: false,
        count: 0,
        active_tasks: []
      };
    }

    // Get task details (using staff query for sanitized data)
    const userRoles = await taskSessionRepository.getUserProductionRoles(userId);
    const tasks = await taskSessionRepository.getTasksByRolesForStaff(userId, userRoles, {
      include_completed: true  // Include in case task was completed while session active
    });

    // Build active task info for each session
    const now = new Date();
    const activeTasks: ActiveTaskInfo[] = [];

    for (const session of activeSessions) {
      const task = tasks.find(t => t.task_id === session.task_id);
      if (task) {
        const startedAt = new Date(session.started_at);
        const elapsedMinutes = Math.floor((now.getTime() - startedAt.getTime()) / 60000);

        activeTasks.push({
          task,
          session,
          elapsed_minutes: elapsedMinutes
        });
      }
    }

    // Sort by started_at (oldest first)
    activeTasks.sort((a, b) =>
      new Date(a.session.started_at).getTime() - new Date(b.session.started_at).getTime()
    );

    return {
      has_active_tasks: activeTasks.length > 0,
      count: activeTasks.length,
      active_tasks: activeTasks
    };
  }

  // =====================================================
  // STAFF TASK QUERIES
  // =====================================================

  /**
   * Get tasks for staff user based on their production roles
   * Returns sanitized data (no customer info, internal notes, pricing)
   */
  async getStaffTasks(userId: number, filters: StaffTaskFilters = {}): Promise<{
    tasks: StaffTask[];
    user_roles: ProductionRole[];
  }> {
    const userRoles = await taskSessionRepository.getUserProductionRoles(userId);

    if (userRoles.length === 0) {
      return { tasks: [], user_roles: [] };
    }

    const tasks = await taskSessionRepository.getTasksByRolesForStaff(userId, userRoles, filters);

    return { tasks, user_roles: userRoles };
  }

  // =====================================================
  // SESSION MANAGEMENT
  // =====================================================

  /**
   * Get session history for a task
   * Staff can see only their own sessions, managers can see all
   */
  async getTaskSessions(
    taskId: number,
    userId: number,
    isManager: boolean
  ): Promise<TaskSessionHistory> {
    const sessions = await taskSessionRepository.getSessionsForTask(taskId);

    // Filter to user's own sessions if not manager
    const filteredSessions = isManager
      ? sessions
      : sessions.filter(s => s.user_id === userId);

    // Get task info
    const taskRole = await taskSessionRepository.getTaskRole(taskId);
    const orderId = await taskSessionRepository.getTaskOrderId(taskId);

    let taskName = '';
    let orderNumber = '';

    if (orderId) {
      const order = await orderRepository.getOrderById(orderId);
      if (order) {
        orderNumber = order.order_number.toString();
      }
    }

    // Get task name from first session or query
    if (sessions.length > 0) {
      // We need to get task name separately
      const tasks = await orderPartRepository.getOrderTasks(orderId!);
      const task = tasks.find(t => t.task_id === taskId);
      taskName = task?.task_name || 'Unknown Task';
    }

    const totalTime = await taskSessionRepository.getTotalTaskTime(taskId);
    const activeSessions = await taskSessionRepository.getActiveSessionsForTask(taskId);

    return {
      task_id: taskId,
      task_name: taskName,
      order_number: orderNumber,
      sessions: filteredSessions,
      total_time_minutes: totalTime,
      active_sessions_count: activeSessions.length,
      can_edit_all: isManager
    };
  }

  /**
   * Update a session (times/notes)
   * Staff can only edit their own session notes
   * Managers can edit any session including times
   */
  async updateSession(
    sessionId: number,
    updates: UpdateSessionData,
    userId: number,
    isManager: boolean
  ): Promise<void> {
    const session = await taskSessionRepository.getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check permissions
    if (!isManager && session.user_id !== userId) {
      throw new Error('You can only edit your own sessions');
    }

    // Non-managers can only edit notes
    if (!isManager) {
      const allowedUpdates: UpdateSessionData = {};
      if (updates.notes !== undefined) {
        allowedUpdates.notes = updates.notes;
      }
      await taskSessionRepository.updateSession(sessionId, allowedUpdates);
    } else {
      await taskSessionRepository.updateSession(sessionId, updates);
    }
  }

  /**
   * Delete a session (manager only)
   */
  async deleteSession(sessionId: number, userId: number, isManager: boolean): Promise<void> {
    if (!isManager) {
      throw new Error('Only managers can delete sessions');
    }

    const session = await taskSessionRepository.getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    await taskSessionRepository.deleteSession(sessionId);
  }
}

// Export singleton instance
export const taskSessionService = new TaskSessionService();
