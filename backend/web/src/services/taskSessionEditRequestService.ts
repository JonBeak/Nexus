/**
 * Task Session Edit Request Service
 * Handles edit request workflows, approval logic, and business rules
 *
 * Created: 2025-01-15
 * Pattern: Mirrors EditRequestService from time tracking
 *
 * ARCHITECTURAL STATUS:
 * - 3-layer architecture (Route → Service → Repository)
 * - Route-level RBAC protection (requirePermission middleware)
 */

import { TaskSessionEditRequestRepository } from '../repositories/taskSessionEditRequestRepository';
import { taskSessionRepository } from '../repositories/taskSessionRepository';
import { taskSessionService } from './taskSessionService';
import { User } from '../types';
import {
  SessionEditRequestBody,
  SessionDeleteRequestBody,
  ProcessSessionRequestBody,
  PendingSessionEditRequest
} from '../types/taskSessions';
import {
  broadcastSessionEditRequestSubmitted,
  broadcastSessionEditRequestProcessed,
  broadcastSessionEditRequestCount
} from '../websocket';

interface ApiResponse {
  success: boolean;
  message: string;
}

/**
 * Task Session Edit Request Service
 */
export class TaskSessionEditRequestService {

  /**
   * Submit a session edit request
   * Staff can request changes to their own sessions
   */
  static async submitEditRequest(user: User, data: SessionEditRequestBody): Promise<ApiResponse> {
    // Verify session belongs to user
    const ownsSession = await TaskSessionEditRequestRepository.userOwnsSession(data.session_id, user.user_id);
    if (!ownsSession) {
      throw new Error('Session not found or does not belong to you');
    }

    // Cancel any existing pending request for this session
    await TaskSessionEditRequestRepository.cancelPendingRequests(data.session_id);

    // Create new request
    const requestId = await TaskSessionEditRequestRepository.createEditRequest({
      session_id: data.session_id,
      user_id: user.user_id,
      requested_started_at: data.requested_started_at,
      requested_ended_at: data.requested_ended_at,
      requested_notes: data.requested_notes,
      reason: data.reason
    });

    // Broadcast to managers
    const sessionInfo = await TaskSessionEditRequestRepository.getSessionInfoForBroadcast(data.session_id);
    if (sessionInfo) {
      broadcastSessionEditRequestSubmitted(
        requestId,
        data.session_id,
        'edit',
        user.user_id,
        sessionInfo.staffName,
        sessionInfo.taskName,
        sessionInfo.orderNumber
      );
      // Also broadcast updated count
      const count = await TaskSessionEditRequestRepository.getPendingCount();
      broadcastSessionEditRequestCount(count);
    }

    return {
      success: true,
      message: 'Edit request submitted successfully'
    };
  }

  /**
   * Submit a session delete request
   * Staff can request deletion of their own sessions
   */
  static async submitDeleteRequest(user: User, data: SessionDeleteRequestBody): Promise<ApiResponse> {
    // Verify session belongs to user
    const ownsSession = await TaskSessionEditRequestRepository.userOwnsSession(data.session_id, user.user_id);
    if (!ownsSession) {
      throw new Error('Session not found or does not belong to you');
    }

    // Get session info before potentially cancelling other requests
    const sessionInfo = await TaskSessionEditRequestRepository.getSessionInfoForBroadcast(data.session_id);

    // Cancel any existing pending request for this session
    await TaskSessionEditRequestRepository.cancelPendingRequests(data.session_id);

    // Create new delete request
    const requestId = await TaskSessionEditRequestRepository.createDeleteRequest({
      session_id: data.session_id,
      user_id: user.user_id,
      reason: data.reason
    });

    // Broadcast to managers
    if (sessionInfo) {
      broadcastSessionEditRequestSubmitted(
        requestId,
        data.session_id,
        'delete',
        user.user_id,
        sessionInfo.staffName,
        sessionInfo.taskName,
        sessionInfo.orderNumber
      );
      // Also broadcast updated count
      const count = await TaskSessionEditRequestRepository.getPendingCount();
      broadcastSessionEditRequestCount(count);
    }

    return {
      success: true,
      message: 'Delete request submitted successfully'
    };
  }

  /**
   * Get pending edit requests (managers only)
   * Permissions enforced at route level
   */
  static async getPendingRequests(): Promise<PendingSessionEditRequest[]> {
    return await TaskSessionEditRequestRepository.getPendingRequests();
  }

  /**
   * Get pending request count (for dashboard badge)
   */
  static async getPendingCount(): Promise<number> {
    return await TaskSessionEditRequestRepository.getPendingCount();
  }

  /**
   * Get pending request for a session (staff can view their own)
   */
  static async getPendingRequestForSession(user: User, sessionId: number): Promise<any | null> {
    // Verify session belongs to user
    const ownsSession = await TaskSessionEditRequestRepository.userOwnsSession(sessionId, user.user_id);
    if (!ownsSession) {
      throw new Error('Session not found or does not belong to you');
    }

    const request = await TaskSessionEditRequestRepository.getPendingRequestForSession(sessionId, user.user_id);
    return request;
  }

  /**
   * Update a pending edit request (staff can update their own pending requests)
   */
  static async updatePendingRequest(user: User, data: {
    request_id: number;
    requested_started_at: string;
    requested_ended_at: string | null;
    requested_notes?: string | null;
    reason: string;
  }): Promise<ApiResponse> {
    // Get the request to verify ownership
    const request = await TaskSessionEditRequestRepository.getRequestById(data.request_id);
    if (!request) {
      throw new Error('Request not found or already processed');
    }

    // Verify user owns this request
    if (request.user_id !== user.user_id) {
      throw new Error('You can only update your own requests');
    }

    // Update the request
    await TaskSessionEditRequestRepository.updatePendingRequest(data.request_id, {
      requested_started_at: data.requested_started_at,
      requested_ended_at: data.requested_ended_at,
      requested_notes: data.requested_notes,
      reason: data.reason
    });

    return {
      success: true,
      message: 'Edit request updated successfully'
    };
  }

  /**
   * Cancel a pending edit request (staff can cancel their own)
   */
  static async cancelRequest(user: User, requestId: number): Promise<ApiResponse> {
    // Try to cancel - the repository method validates ownership
    const cancelled = await TaskSessionEditRequestRepository.cancelRequestByUser(requestId, user.user_id);

    if (!cancelled) {
      throw new Error('Request not found, already processed, or does not belong to you');
    }

    // Broadcast updated pending count
    const count = await TaskSessionEditRequestRepository.getPendingCount();
    broadcastSessionEditRequestCount(count);

    return {
      success: true,
      message: 'Edit request cancelled successfully'
    };
  }

  /**
   * Process edit request (approve/reject/modify)
   * Permissions enforced at route level
   * Also triggers recalculation of effective durations for affected sessions
   */
  static async processRequest(user: User, data: ProcessSessionRequestBody): Promise<ApiResponse> {
    // Get the request details with session info
    const request = await TaskSessionEditRequestRepository.getRequestWithSession(data.request_id);
    if (!request) {
      throw new Error('Request not found or already processed');
    }

    // Track session info for potential recalculation
    let needsRecalculation = false;
    let recalcUserId = request.user_id;
    let recalcRangeStart: Date | null = null;
    let recalcRangeEnd: Date | null = null;

    if (data.action === 'approve' || data.action === 'modify') {
      if (request.request_type === 'delete') {
        // Store session info before deleting (for recalculation)
        const session = await taskSessionRepository.getSessionById(request.session_id);
        if (session && session.ended_at) {
          needsRecalculation = true;
          recalcRangeStart = new Date(session.started_at);
          recalcRangeEnd = new Date(session.ended_at);
        }

        // Delete the session
        await taskSessionRepository.deleteSession(request.session_id);
      } else {
        // Handle edit requests
        let startedAt: Date;
        let endedAt: Date | null;
        let notes: string | null;

        if (data.action === 'modify') {
          // In modify mode, use modified values if provided, otherwise fall back to requested
          startedAt = data.modified_started_at
            ? new Date(data.modified_started_at)
            : new Date(request.requested_started_at!);
          endedAt = data.modified_ended_at !== undefined
            ? (data.modified_ended_at ? new Date(data.modified_ended_at) : null)
            : (request.requested_ended_at ? new Date(request.requested_ended_at) : null);
          notes = data.modified_notes !== undefined
            ? data.modified_notes
            : request.requested_notes;
        } else {
          // In approve mode, use the original requested values
          startedAt = new Date(request.requested_started_at!);
          endedAt = request.requested_ended_at ? new Date(request.requested_ended_at) : null;
          notes = request.requested_notes;
        }

        // Update the session
        await taskSessionRepository.updateSession(request.session_id, {
          started_at: startedAt,
          ended_at: endedAt,
          notes: notes
        });

        // Mark for recalculation if the session is completed
        if (endedAt) {
          needsRecalculation = true;
          // Use the wider range covering both old and new times
          const originalStart = new Date(request.original_started_at);
          const originalEnd = request.original_ended_at ? new Date(request.original_ended_at) : new Date();
          recalcRangeStart = startedAt < originalStart ? startedAt : originalStart;
          recalcRangeEnd = endedAt > originalEnd ? endedAt : originalEnd;
        }
      }
    }

    // Update request status
    const status = data.action === 'modify' ? 'modified' :
                   data.action === 'approve' ? 'approved' : 'rejected';

    await TaskSessionEditRequestRepository.updateRequestStatus(
      data.request_id,
      status,
      user.user_id,
      data.reviewer_notes
    );

    // Recalculate effective durations for affected sessions
    if (needsRecalculation && recalcRangeStart && recalcRangeEnd) {
      await taskSessionService.recalculateAffectedSessions(
        recalcUserId,
        recalcRangeStart,
        recalcRangeEnd
      );
    }

    // Broadcast to staff member who submitted the request
    const reviewerName = `${user.first_name} ${user.last_name}`;
    // Convert action to past tense for broadcast
    const actionPastTense = data.action === 'approve' ? 'approved'
      : data.action === 'reject' ? 'rejected'
      : 'modified';
    broadcastSessionEditRequestProcessed(
      data.request_id,
      request.session_id,
      actionPastTense,
      request.request_type as 'edit' | 'delete',
      request.user_id,
      user.user_id,
      reviewerName
    );

    // Broadcast updated pending count
    const count = await TaskSessionEditRequestRepository.getPendingCount();
    broadcastSessionEditRequestCount(count);

    return {
      success: true,
      message: `Request ${status} successfully`
    };
  }
}
