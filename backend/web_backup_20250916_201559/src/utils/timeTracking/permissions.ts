import { Request, Response } from 'express';
import { User } from '../../types';
import { hybridPermissionCheck } from '../../middleware/rbac';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export class TimeTrackingPermissions {
  // =====================================================
  // HYBRID PERMISSION FUNCTIONS (Phase 3 - Time Tracking)
  // =====================================================

  /**
   * Hybrid permission check for viewing/listing time entries
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for creating time entries
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for updating time entries
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for deleting time entries
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for approving time edit requests
   * Uses RBAC if enabled, falls back to legacy role check
   */
  static async canApproveTimeRequestsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'time_tracking.approve',
      ['manager', 'owner']
    );
  }

  /**
   * Hybrid permission check for rejecting time edit requests
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for exporting time data
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for time management (scheduling)
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for viewing time analytics/reports
   * Uses RBAC if enabled, falls back to legacy role check
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