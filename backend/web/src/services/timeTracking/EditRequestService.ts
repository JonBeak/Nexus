// File Clean up Started: 2025-11-21
// File Clean up Finished: 2025-11-21
// Phase 2 Changes:
// - Removed TimeTrackingPermissions import (redundant with route-level RBAC)
// - Removed 2 service-level permission check blocks
// - Permissions now enforced at route level via requirePermission() middleware
//
// Previous cleanup: 2025-11-15
// - Removed excessive debug logging (console.log statements with emojis)
// - Removed redundant actionPastTense variable (used status directly)
// - Cleaned up code from 215 → 192 lines (11% reduction)
// - Dependent repositories migrated to query() helper

import { TimeEntryRepository } from '../../repositories/timeTracking/TimeEntryRepository';
import { EditRequestRepository } from '../../repositories/timeTracking/EditRequestRepository';
import { TimeCalculationService } from './TimeCalculationService';
import { NotificationService } from './NotificationService';
import { convertLocalToUTC } from '../../utils/timeTracking/DateTimeUtils';
import { User } from '../../types';
import {
  EditRequestBody,
  DeleteRequestBody,
  ProcessRequestBody,
  PendingEditRequest,
  ApiResponse
} from '../../types/TimeTypes';
import {
  broadcastTimeEditRequestSubmitted,
  broadcastTimeEditRequestProcessed,
  broadcastTimeEditRequestCount
} from '../../websocket';

/**
 * Edit Request Service
 * Handles edit request workflows, approval logic, and business rules
 *
 * ARCHITECTURAL STATUS:
 * ✅ 3-layer architecture (Route → Service → Repository)
 * ✅ Route-level RBAC protection (requirePermission middleware)
 * ✅ No redundant service-level permission checks
 */
export class EditRequestService {
  /**
   * Submit a time edit request
   * @param user - User object
   * @param data - Edit request data
   * @returns Success response
   * @throws Error if entry not found or validation fails
   */
  static async submitEditRequest(user: User, data: EditRequestBody): Promise<ApiResponse> {
    // Verify entry belongs to user
    const entry = await TimeEntryRepository.getEntryByIdAndUser(data.entry_id, user.user_id);
    if (!entry) {
      throw new Error('Time entry not found');
    }

    // Cancel any existing pending request for this entry
    await EditRequestRepository.cancelPendingRequests(data.entry_id);

    // Convert datetime-local values to UTC
    const utcClockIn = convertLocalToUTC(data.requested_clock_in);
    const utcClockOut = convertLocalToUTC(data.requested_clock_out);

    // Create new request
    const requestId = await EditRequestRepository.createEditRequest({
      entry_id: data.entry_id,
      user_id: user.user_id,
      requested_clock_in: utcClockIn,
      requested_clock_out: utcClockOut,
      requested_break_minutes: data.requested_break_minutes,
      reason: data.reason
    });

    // Broadcast to managers
    const staffName = `${user.first_name} ${user.last_name}`;
    const entryDate = entry.clock_in ? new Date(entry.clock_in).toISOString().split('T')[0] : 'Unknown';
    broadcastTimeEditRequestSubmitted(
      requestId,
      data.entry_id,
      'edit',
      user.user_id,
      staffName,
      entryDate
    );
    // Broadcast updated count
    const count = await EditRequestRepository.getPendingCount();
    broadcastTimeEditRequestCount(count);

    return {
      success: true,
      message: 'Edit request submitted successfully'
    };
  }

  /**
   * Submit a time delete request
   * @param user - User object
   * @param data - Delete request data
   * @returns Success response
   * @throws Error if entry not found
   */
  static async submitDeleteRequest(user: User, data: DeleteRequestBody): Promise<ApiResponse> {
    // Verify entry belongs to user
    const entry = await TimeEntryRepository.getEntryByIdAndUser(data.entry_id, user.user_id);
    if (!entry) {
      throw new Error('Time entry not found');
    }

    // Cancel any existing pending request for this entry (both edit and delete)
    await EditRequestRepository.cancelPendingRequests(data.entry_id);

    // Create new delete request
    const requestId = await EditRequestRepository.createDeleteRequest({
      entry_id: data.entry_id,
      user_id: user.user_id,
      reason: data.reason
    });

    // Broadcast to managers
    const staffName = `${user.first_name} ${user.last_name}`;
    const entryDate = entry.clock_in ? new Date(entry.clock_in).toISOString().split('T')[0] : 'Unknown';
    broadcastTimeEditRequestSubmitted(
      requestId,
      data.entry_id,
      'delete',
      user.user_id,
      staffName,
      entryDate
    );
    // Broadcast updated count
    const count = await EditRequestRepository.getPendingCount();
    broadcastTimeEditRequestCount(count);

    return {
      success: true,
      message: 'Delete request submitted successfully'
    };
  }

  /**
   * Get pending edit requests (managers only)
   * @param user - User object
   * @returns Pending requests with user details
   */
  static async getPendingRequests(user: User): Promise<PendingEditRequest[]> {
    // Permissions enforced at route level via requirePermission('time.approve') middleware

    return await EditRequestRepository.getPendingRequests();
  }

  /**
   * Process edit request (approve/reject/modify)
   * @param user - User object
   * @param data - Process request data
   * @returns Success response
   * @throws Error if request not found
   */
  static async processRequest(user: User, data: ProcessRequestBody): Promise<ApiResponse> {
    // Permissions enforced at route level via requirePermission('time.approve') middleware

    // Get the request details
    const request = await EditRequestRepository.getRequestById(data.request_id);
    if (!request) {
      throw new Error('Request not found or already processed');
    }

    if (data.action === 'approve' || data.action === 'modify') {
      if (request.request_type === 'delete') {
        // Mark the entry as deleted for delete requests
        await TimeEntryRepository.markAsDeleted(request.entry_id);
      } else {
        // Handle edit requests
        let clockIn: string;
        let clockOut: string;
        let breakMinutes: number;

        if (data.action === 'modify') {
          // In modify mode, use modified values if provided, otherwise fall back to requested
          clockIn = data.modified_clock_in ? convertLocalToUTC(data.modified_clock_in) : request.requested_clock_in!;
          clockOut = data.modified_clock_out ? convertLocalToUTC(data.modified_clock_out) : request.requested_clock_out!;
          breakMinutes = data.modified_break_minutes !== undefined ? data.modified_break_minutes : request.requested_break_minutes!;
        } else {
          // In approve mode, ALWAYS use the original requested values
          clockIn = request.requested_clock_in!;
          clockOut = request.requested_clock_out!;
          breakMinutes = request.requested_break_minutes!;
        }

        // Recalculate hours using the service
        const calculation = await TimeCalculationService.recalculateHoursForRequest(
          clockIn,
          clockOut,
          breakMinutes
        );

        // Update the time entry
        await TimeEntryRepository.updateEntryFromRequest(request.entry_id, {
          clock_in: clockIn,
          clock_out: clockOut,
          break_minutes: calculation.finalBreakMinutes,
          auto_break_minutes: calculation.autoBreakInfo.minutes,
          total_hours: calculation.totalHours,
          applied_breaks: JSON.stringify(calculation.autoBreakInfo.appliedBreaks),
          break_adjustment_notes: calculation.autoBreakInfo.notes || undefined
        });
      }
    }

    // Update request status
    const status = data.action === 'modify' ? 'modified' :
                  data.action === 'approve' ? 'approved' : 'rejected';

    await EditRequestRepository.updateRequestStatus(
      data.request_id,
      status,
      user.user_id,
      data.reviewer_notes
    );

    // Create notification for the employee
    await NotificationService.createEditRequestNotification({
      user_id: request.user_id,
      request_id: data.request_id,
      action: status,
      reviewer_notes: data.reviewer_notes,
      reviewer_name: `${user.first_name} ${user.last_name}`
    });

    // Broadcast to staff member who submitted the request
    const reviewerName = `${user.first_name} ${user.last_name}`;
    // Convert action to past tense for broadcast
    const actionPastTense = data.action === 'approve' ? 'approved'
      : data.action === 'reject' ? 'rejected'
      : 'modified';
    broadcastTimeEditRequestProcessed(
      data.request_id,
      request.entry_id,
      actionPastTense,
      request.request_type as 'edit' | 'delete',
      request.user_id,
      user.user_id,
      reviewerName
    );

    // Broadcast updated pending count
    const count = await EditRequestRepository.getPendingCount();
    broadcastTimeEditRequestCount(count);

    return {
      success: true,
      message: `Request ${status} successfully`
    };
  }
}