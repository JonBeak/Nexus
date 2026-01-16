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
  broadcastSessionStarted,
  broadcastSessionStopped,
  broadcastSessionNoteCreated,
  broadcastSessionNoteUpdated,
  broadcastSessionNoteDeleted
} from '../websocket';
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
  UpdateSessionData,
  SessionNote
} from '../types/taskSessions';
import { ProductionRole } from '../types/orders';

export class TaskSessionService {

  // =====================================================
  // START TASK SESSION
  // =====================================================

  /**
   * Start a new task session for a user
   * - Validates user doesn't already have session on THIS task (allows multiple tasks)
   * - Validates user has matching production role (unless skipRoleValidation is true)
   * - Creates session
   * - Triggers order status: production_queue → in_production
   *
   * @param taskId - The task to start a session on
   * @param userId - The user who will be working on the task
   * @param skipRoleValidation - If true, skip production role validation (for manager assignment)
   */
  async startTaskSession(taskId: number, userId: number, skipRoleValidation = false): Promise<StartSessionResponse> {
    // Start transaction
    const connection = await pool.getConnection() as PoolConnection;
    await connection.beginTransaction();

    try {
      // Check if user already has an active session on THIS task (prevent duplicate)
      const existingSession = await taskSessionRepository.getActiveSessionForUserTask(userId, taskId);
      if (existingSession) {
        throw new Error(`You already have an active session on this task.`);
      }

      // Check if staff/designer is clocked in (managers/owners can start anytime)
      const userRole = await taskSessionRepository.getUserRole(userId);
      if (userRole === 'production_staff' || userRole === 'designer') {
        const isClockedIn = await taskSessionRepository.isUserClockedIn(userId);
        if (!isClockedIn) {
          throw new Error('You must be clocked in to start a task session.');
        }
      }

      // Check if task exists and is not completed
      const isAvailable = await taskSessionRepository.isTaskAvailable(taskId);
      if (!isAvailable) {
        throw new Error('Task not found or already completed');
      }

      // Validate user has matching production role (unless manager bypass)
      if (!skipRoleValidation) {
        const taskRole = await taskSessionRepository.getTaskRole(taskId);
        const userRoles = await taskSessionRepository.getUserProductionRoles(userId);

        if (taskRole && !userRoles.includes(taskRole)) {
          throw new Error(`This task requires the "${taskRole}" role. Your roles: ${userRoles.join(', ') || 'none'}`);
        }
      }

      // Create the session
      const sessionId = await taskSessionRepository.createSession(
        { task_id: taskId, user_id: userId },
        connection
      );

      // Check if order needs status transition (production_queue → in_production)
      const orderId = await taskSessionRepository.getTaskOrderId(taskId);
      let orderStatusChange: { orderId: number; newStatus: string } | undefined;

      if (orderId) {
        const order = await orderRepository.getOrderById(orderId);
        if (order && order.status === 'production_queue') {
          await orderService.updateOrderStatus(
            orderId,
            'in_production',
            userId,
            'Automatically moved to In Production (task session started)'
          );
          orderStatusChange = { orderId, newStatus: 'in_production' };
        }
      }

      await connection.commit();

      // Get staff name and active sessions count for broadcast
      const staffName = await taskSessionRepository.getUserName(userId);
      const activeSessions = await taskSessionRepository.getActiveSessionsForTask(taskId);
      const activeSessionsCount = activeSessions.length;

      // Broadcast session started
      if (orderId) {
        broadcastSessionStarted(
          sessionId,
          taskId,
          orderId,
          userId,
          staffName || `User ${userId}`,
          activeSessionsCount,
          orderStatusChange
        );
      }

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
   * - Calculates and stores effective duration (accounting for concurrent sessions)
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

      // Calculate and store effective duration (fractional time accounting)
      let effectiveDuration: number | undefined;
      if (endedSession && endedSession.ended_at) {
        effectiveDuration = await this.calculateEffectiveDuration(
          activeSession.session_id,
          userId,
          new Date(endedSession.started_at),
          new Date(endedSession.ended_at)
        );
        await taskSessionRepository.updateEffectiveDuration(activeSession.session_id, effectiveDuration);
      }

      // Get orderId and active sessions count for broadcast
      const orderId = await taskSessionRepository.getTaskOrderId(taskId);
      const activeSessions = await taskSessionRepository.getActiveSessionsForTask(taskId);
      const activeSessionsCount = activeSessions.length;

      // Broadcast session stopped
      if (orderId) {
        broadcastSessionStopped(
          activeSession.session_id,
          taskId,
          orderId,
          userId,
          duration,
          activeSessionsCount
        );
      }

      return {
        session_id: activeSession.session_id,
        task_id: taskId,
        duration_minutes: duration,
        effective_duration_minutes: effectiveDuration,
        message: `Task session stopped. Duration: ${duration} minutes${effectiveDuration !== undefined && effectiveDuration !== duration ? ` (effective: ${effectiveDuration.toFixed(1)} minutes)` : ''}`
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
      // Pass undefined for expectedVersion (no optimistic locking in session flow)
      await orderPartRepository.updateTaskCompletion(taskId, true, userId, undefined, connection);

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
  // EFFECTIVE DURATION CALCULATION (Fractional Time)
  // =====================================================

  /**
   * Calculate effective duration for a completed session
   * Accounts for time split with concurrent sessions
   *
   * When multiple tasks overlap, time is divided proportionally:
   * - If 2 tasks overlap for 60 minutes, each gets 30 minutes effective time
   * - Solo time (no overlaps) counts fully
   *
   * @param sessionId The session that just ended
   * @param userId The user who owns this session
   * @param startedAt Session start time
   * @param endedAt Session end time
   * @returns Effective duration in minutes (decimal, rounded to 2 places)
   */
  private async calculateEffectiveDuration(
    sessionId: number,
    userId: number,
    startedAt: Date,
    endedAt: Date
  ): Promise<number> {
    // Get all overlapping sessions for this user
    const overlappingSessions = await taskSessionRepository.getOverlappingSessions(
      sessionId,
      userId,
      startedAt,
      endedAt
    );

    // If no overlaps, return raw duration
    if (overlappingSessions.length === 0) {
      return (endedAt.getTime() - startedAt.getTime()) / 60000;
    }

    // Build timeline of events (starts and ends)
    interface TimeEvent {
      time: Date;
      type: 'start' | 'end';
      sessionId: number;
    }

    const events: TimeEvent[] = [];

    // Add our session's events
    events.push({ time: startedAt, type: 'start', sessionId });
    events.push({ time: endedAt, type: 'end', sessionId });

    // Add overlapping sessions' events (clamped to our session's range)
    for (const session of overlappingSessions) {
      const otherStart = new Date(session.started_at);
      // If other session is still active, treat its end as our end time
      const otherEnd = session.ended_at ? new Date(session.ended_at) : endedAt;

      // Clamp to our session's range
      const clampedStart = otherStart < startedAt ? startedAt : otherStart;
      const clampedEnd = otherEnd > endedAt ? endedAt : otherEnd;

      if (clampedStart < clampedEnd) {
        events.push({ time: clampedStart, type: 'start', sessionId: session.session_id });
        events.push({ time: clampedEnd, type: 'end', sessionId: session.session_id });
      }
    }

    // Sort events by time (at same time: starts before ends to count concurrent properly)
    events.sort((a, b) => {
      const timeDiff = a.time.getTime() - b.time.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.type === 'start' ? -1 : 1;
    });

    // Walk timeline and calculate effective duration
    let effectiveDuration = 0;
    const activeSessions = new Set<number>();
    let lastTime = startedAt;

    for (const event of events) {
      // Calculate time in this segment
      const segmentMinutes = (event.time.getTime() - lastTime.getTime()) / 60000;

      // If our session is active in this segment, add proportional time
      if (activeSessions.has(sessionId) && segmentMinutes > 0) {
        const concurrentCount = activeSessions.size;
        effectiveDuration += segmentMinutes / concurrentCount;
      }

      // Update active sessions
      if (event.type === 'start') {
        activeSessions.add(event.sessionId);
      } else {
        activeSessions.delete(event.sessionId);
      }

      lastTime = event.time;
    }

    // Round to 2 decimal places for storage precision
    // Display layer handles rounding to nearest minute
    return Math.round(effectiveDuration * 100) / 100;
  }

  /**
   * Recalculate effective durations for all sessions affected by an overlap
   * Called when a session is edited or deleted
   *
   * @param userId User whose sessions may need recalculation
   * @param rangeStart Start of affected time range
   * @param rangeEnd End of affected time range
   */
  async recalculateAffectedSessions(
    userId: number,
    rangeStart: Date,
    rangeEnd: Date
  ): Promise<void> {
    // Get all completed sessions in this range
    const affectedSessions = await taskSessionRepository.getCompletedSessionsInRange(
      userId,
      rangeStart,
      rangeEnd
    );

    // Recalculate each
    for (const session of affectedSessions) {
      if (session.ended_at) {
        const effective = await this.calculateEffectiveDuration(
          session.session_id,
          userId,
          new Date(session.started_at),
          new Date(session.ended_at)
        );
        await taskSessionRepository.updateEffectiveDuration(session.session_id, effective);
      }
    }
  }

  // =====================================================
  // CLOSE ALL USER SESSIONS (Clock-out Integration)
  // =====================================================

  /**
   * Close all active sessions for a user
   * Called by ClockService.clockOut()
   * Returns count of sessions closed
   * Also calculates effective durations for all ended sessions
   */
  async closeAllUserSessions(userId: number): Promise<number> {
    const connection = await pool.getConnection() as PoolConnection;
    await connection.beginTransaction();

    try {
      // End all active sessions
      const sessionsEnded = await taskSessionRepository.endAllUserSessions(userId, connection);

      await connection.commit();

      // Calculate effective durations for all sessions that were just ended
      if (sessionsEnded > 0) {
        const justEndedSessions = await taskSessionRepository.getJustEndedSessionsForUser(userId);
        for (const session of justEndedSessions) {
          if (session.ended_at) {
            const effectiveDuration = await this.calculateEffectiveDuration(
              session.session_id,
              userId,
              new Date(session.started_at),
              new Date(session.ended_at)
            );
            await taskSessionRepository.updateEffectiveDuration(session.session_id, effectiveDuration);
          }
        }
      }

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
   * All users can see all sessions on tasks they have access to
   * isManager flag now only controls can_edit_all permission
   */
  async getTaskSessions(
    taskId: number,
    userId: number,
    isManager: boolean
  ): Promise<TaskSessionHistory> {
    const sessions = await taskSessionRepository.getSessionsForTask(taskId);

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
      sessions: sessions,
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
   * Also recalculates effective durations for overlapping sessions
   */
  async deleteSession(sessionId: number, userId: number, isManager: boolean): Promise<void> {
    if (!isManager) {
      throw new Error('Only managers can delete sessions');
    }

    const session = await taskSessionRepository.getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Store session info before deleting (for recalculation)
    const sessionUserId = session.user_id;
    const sessionStartedAt = new Date(session.started_at);
    const sessionEndedAt = session.ended_at ? new Date(session.ended_at) : new Date();

    await taskSessionRepository.deleteSession(sessionId);

    // Recalculate effective durations for sessions that overlapped with deleted session
    if (session.ended_at) {
      await this.recalculateAffectedSessions(sessionUserId, sessionStartedAt, sessionEndedAt);
    }
  }

  // =====================================================
  // STOP SESSION BY ID (Manager feature)
  // =====================================================

  /**
   * Stop a session by session ID (for managers to stop any user's session)
   * Also calculates and stores effective duration
   */
  async stopSessionById(sessionId: number): Promise<StopSessionResponse> {
    const session = await taskSessionRepository.getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.ended_at) {
      throw new Error('Session is already ended');
    }

    // End the session
    await taskSessionRepository.endSession(sessionId);

    // Get updated session with duration
    const endedSession = await taskSessionRepository.getSessionById(sessionId);
    const duration = endedSession?.duration_minutes || 0;

    // Calculate and store effective duration
    let effectiveDuration: number | undefined;
    if (endedSession && endedSession.ended_at) {
      effectiveDuration = await this.calculateEffectiveDuration(
        sessionId,
        session.user_id,
        new Date(endedSession.started_at),
        new Date(endedSession.ended_at)
      );
      await taskSessionRepository.updateEffectiveDuration(sessionId, effectiveDuration);
    }

    // Get orderId and active sessions count for broadcast
    const orderId = await taskSessionRepository.getTaskOrderId(session.task_id);
    const activeSessions = await taskSessionRepository.getActiveSessionsForTask(session.task_id);
    const activeSessionsCount = activeSessions.length;

    // Broadcast session stopped
    if (orderId) {
      broadcastSessionStopped(
        sessionId,
        session.task_id,
        orderId,
        session.user_id,
        duration,
        activeSessionsCount
      );
    }

    return {
      session_id: sessionId,
      task_id: session.task_id,
      duration_minutes: duration,
      effective_duration_minutes: effectiveDuration,
      message: `Session stopped. Duration: ${duration} minutes${effectiveDuration !== undefined && effectiveDuration !== duration ? ` (effective: ${effectiveDuration.toFixed(1)} minutes)` : ''}`
    };
  }

  // =====================================================
  // TODAY'S COMPLETED SESSIONS
  // =====================================================

  /**
   * Get all completed sessions for a user today
   * Returns sessions with task/order info for display in My Production Tasks
   */
  async getTodayCompletedSessions(userId: number): Promise<{
    sessions: any[];
    total_time_minutes: number;
  }> {
    const sessions = await taskSessionRepository.getTodayCompletedSessionsForUser(userId);

    // Calculate total time
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

    return {
      sessions,
      total_time_minutes: totalMinutes
    };
  }

  // =====================================================
  // SESSION NOTES (Per-user notes on sessions)
  // =====================================================

  /**
   * Get all notes for a session
   */
  async getSessionNotes(sessionId: number): Promise<SessionNote[]> {
    return taskSessionRepository.getNotesForSession(sessionId);
  }

  /**
   * Get all notes for a task (across all sessions)
   */
  async getTaskNotes(taskId: number): Promise<SessionNote[]> {
    return taskSessionRepository.getNotesForTask(taskId);
  }

  /**
   * Create a new note on a session
   */
  async createSessionNote(
    sessionId: number,
    userId: number,
    noteText: string
  ): Promise<{ note_id: number; message: string }> {
    // Verify session exists
    const session = await taskSessionRepository.getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const noteId = await taskSessionRepository.createNote({
      session_id: sessionId,
      user_id: userId,
      note_text: noteText
    });

    // Get user name for broadcast
    const userName = await taskSessionRepository.getUserName(userId) || `User ${userId}`;

    // Broadcast note created
    broadcastSessionNoteCreated(
      noteId,
      sessionId,
      session.task_id,
      userId,
      userName,
      noteText
    );

    return {
      note_id: noteId,
      message: 'Note created successfully'
    };
  }

  /**
   * Update a note
   * Users can only update their own notes; managers/owners can update any
   */
  async updateSessionNote(
    noteId: number,
    noteText: string,
    userId: number,
    isManager: boolean
  ): Promise<void> {
    const note = await taskSessionRepository.getNoteById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // Check permissions
    if (!isManager && note.user_id !== userId) {
      throw new Error('You can only edit your own notes');
    }

    await taskSessionRepository.updateNote(noteId, { note_text: noteText });

    // Get session to find taskId
    const session = await taskSessionRepository.getSessionById(note.session_id);

    // Broadcast note updated
    broadcastSessionNoteUpdated(
      noteId,
      note.session_id,
      session?.task_id || 0,
      userId,
      noteText
    );
  }

  /**
   * Delete a note
   * Users can only delete their own notes; managers/owners can delete any
   */
  async deleteSessionNote(
    noteId: number,
    userId: number,
    isManager: boolean
  ): Promise<void> {
    const note = await taskSessionRepository.getNoteById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // Check permissions
    if (!isManager && note.user_id !== userId) {
      throw new Error('You can only delete your own notes');
    }

    // Get session to find taskId before deleting
    const session = await taskSessionRepository.getSessionById(note.session_id);

    await taskSessionRepository.deleteNote(noteId);

    // Broadcast note deleted
    broadcastSessionNoteDeleted(
      noteId,
      note.session_id,
      session?.task_id || 0,
      userId
    );
  }
}

// Export singleton instance
export const taskSessionService = new TaskSessionService();
