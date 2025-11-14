/**
 * File Clean up Finished: Nov 14, 2025
 * Changes: Replaced hybridPermissionCheck with direct hasPermission calls
 * Previous cleanup (Nov 13): Removed unused AuthenticatedRequest export
 */

import { Request, Response } from 'express';
import { User } from '../../types';
import { hasPermission } from '../../middleware/rbac';

export class TimeTrackingPermissions {
  // =====================================================
  // RBAC PERMISSION FUNCTIONS
  // =====================================================

  /**
   * Check if user can view/list time entries
   * Uses RBAC permission system
   */
  static async canViewTimeEntriesHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'time_tracking.list');
  }

  /**
   * Check if user can create time entries
   * Uses RBAC permission system
   */
  static async canCreateTimeEntriesHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'time_tracking.create');
  }

  /**
   * Check if user can update time entries
   * Uses RBAC permission system
   */
  static async canUpdateTimeEntriesHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'time_tracking.update');
  }

  /**
   * Check if user can delete time entries
   * Uses RBAC permission system
   */
  static async canDeleteTimeEntriesHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'time_tracking.update');
  }

  /**
   * Check if user can approve time edit requests
   * Uses RBAC permission system
   */
  static async canApproveTimeRequestsHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'time.approve');
  }

  /**
   * Check if user can reject time edit requests
   * Uses RBAC permission system
   */
  static async canRejectTimeRequestsHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'time_tracking.reject');
  }

  /**
   * Check if user can export time data
   * Uses RBAC permission system
   */
  static async canExportTimeDataHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'time_tracking.export');
  }

  /**
   * Check if user can manage time schedules
   * Uses RBAC permission system
   */
  static async canManageTimeSchedulesHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'time_management.update');
  }

  /**
   * Check if user can view time analytics/reports
   * Uses RBAC permission system
   */
  static async canViewTimeAnalyticsHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'time_management.view_reports');
  }

  /**
   * Get user role display name
   */
  static getRoleDisplayName(role: string): string {
    switch (role) {
      case 'manager': return 'Manager';
      case 'designer': return 'Designer';
      case 'production_staff': return 'Production Staff';
      case 'owner': return 'Owner';
      default: return 'Unknown';
    }
  }
}