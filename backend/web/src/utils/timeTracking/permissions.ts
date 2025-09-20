import { Request, Response } from 'express';
import { User } from '../../types';
import { hybridPermissionCheck } from '../../middleware/rbac';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export class TimeTrackingPermissions {
  // =====================================================
  // RBAC PERMISSION FUNCTIONS
  // =====================================================

  /**
   * Check if user can view/list time entries
   * Uses RBAC permission system
   */
  static async canViewTimeEntriesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time_tracking.list',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can create time entries
   * Uses RBAC permission system
   */
  static async canCreateTimeEntriesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time_tracking.create',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can update time entries
   * Uses RBAC permission system
   */
  static async canUpdateTimeEntriesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time_tracking.update',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can delete time entries
   * Uses RBAC permission system
   */
  static async canDeleteTimeEntriesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time_tracking.update',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can approve time edit requests
   * Uses RBAC permission system
   */
  static async canApproveTimeRequestsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time.approve',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can reject time edit requests
   * Uses RBAC permission system
   */
  static async canRejectTimeRequestsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time_tracking.reject',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can export time data
   * Uses RBAC permission system
   */
  static async canExportTimeDataHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time_tracking.export',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can manage time schedules
   * Uses RBAC permission system
   */
  static async canManageTimeSchedulesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time_management.update',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can view time analytics/reports
   * Uses RBAC permission system
   */
  static async canViewTimeAnalyticsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time_management.view_reports',
      ['manager', 'owner']
    );
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