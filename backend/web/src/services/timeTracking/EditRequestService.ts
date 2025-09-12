import { TimeEntryRepository } from '../../repositories/timeTracking/TimeEntryRepository';
import { EditRequestRepository } from '../../repositories/timeTracking/EditRequestRepository';
import { TimeCalculationService } from './TimeCalculationService';
import { NotificationService } from './NotificationService';
import { TimeTrackingPermissions } from '../../utils/timeTracking/permissions';
import { convertLocalToUTC } from '../../utils/timeTracking/DateTimeUtils';
import { User } from '../../types';
import { 
  EditRequestBody, 
  DeleteRequestBody, 
  ProcessRequestBody,
  PendingEditRequest,
  ApiResponse 
} from '../../types/TimeTrackingTypes';

/**
 * Edit Request Service
 * Handles edit request workflows, approval logic, and business rules
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
    await EditRequestRepository.createEditRequest({
      entry_id: data.entry_id,
      user_id: user.user_id,
      requested_clock_in: utcClockIn,
      requested_clock_out: utcClockOut,
      requested_break_minutes: data.requested_break_minutes,
      reason: data.reason
    });

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
    await EditRequestRepository.createDeleteRequest({
      entry_id: data.entry_id,
      user_id: user.user_id,
      reason: data.reason
    });

    return { 
      success: true,
      message: 'Delete request submitted successfully' 
    };
  }

  /**
   * Get pending edit requests (managers only)
   * @param user - User object
   * @returns Pending requests with user details
   * @throws Error if insufficient permissions
   */
  static async getPendingRequests(user: User): Promise<PendingEditRequest[]> {
    // Check time tracking view permission using hybrid RBAC/legacy system
    const canView = await TimeTrackingPermissions.canViewTimeEntriesHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to view requests');
    }

    return await EditRequestRepository.getPendingRequests();
  }

  /**
   * Process edit request (approve/reject/modify)
   * @param user - User object
   * @param data - Process request data
   * @returns Success response
   * @throws Error if request not found or insufficient permissions
   */
  static async processRequest(user: User, data: ProcessRequestBody): Promise<ApiResponse> {
    // Check permissions
    const canView = await TimeTrackingPermissions.canViewTimeEntriesHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to process requests');
    }

    console.log('🟦 BACKEND DEBUG - Process Request Started');
    console.log('📥 Received data:', data);
    console.log('🔧 Request ID:', data.request_id);
    console.log('🔧 Action:', data.action);

    // Get the request details
    const request = await EditRequestRepository.getRequestById(data.request_id);
    if (!request) {
      throw new Error('Request not found or already processed');
    }

    console.log('📋 Original request data from DB:', request);

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
          console.log('   MODIFY MODE: Using modified values where available');
        } else {
          // In approve mode, ALWAYS use the original requested values
          clockIn = request.requested_clock_in!;
          clockOut = request.requested_clock_out!;
          breakMinutes = request.requested_break_minutes!;
          console.log('   APPROVE MODE: Using requested values only');
          
          // Safety check - if modified values were sent for approve, log warning
          if (data.modified_clock_in || data.modified_clock_out || data.modified_break_minutes !== undefined) {
            console.log('⚠️ WARNING: Modified values received for approve action, but ignoring them');
          }
        }
        
        console.log('🔄 FINAL VALUES TO BE APPLIED:');
        console.log('   clockIn:', clockIn);
        console.log('   clockOut:', clockOut);
        console.log('   breakMinutes:', breakMinutes);
        
        // Recalculate hours using the service
        const calculation = await TimeCalculationService.recalculateHoursForRequest(
          clockIn,
          clockOut,
          breakMinutes
        );
        
        console.log('   Total calculation result:', calculation);

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

    const actionPastTense = data.action === 'modify' ? 'modified' : 
                           data.action === 'approve' ? 'approved' : 'rejected';
    
    return { 
      success: true,
      message: `Request ${actionPastTense} successfully` 
    };
  }
}