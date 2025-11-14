/**
 * File Clean up Finished: Nov 13, 2025
 * Changes: Removed unused AuthenticatedRequest export (available in ../../types if needed)
 */

import { Request, Response } from 'express';
import { User } from '../../types';
import { hybridPermissionCheck } from '../../middleware/rbac';

export class CustomerPermissions {
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

  // =====================================================
  // RBAC PERMISSION FUNCTIONS
  // =====================================================

  /**
   * Check if user can delete customer addresses
   * Uses RBAC permission system
   */
  static async canDeleteAddressesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customer_addresses.delete',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can deactivate customers
   * Uses RBAC permission system
   */
  static async canDeactivateCustomersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customers.deactivate',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can reactivate customers
   * Uses customers.update permission for reactivation operations
   */
  static async canReactivateCustomersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customers.update',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can view customers
   * Uses RBAC permission system
   */
  static async canViewCustomersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customers.read',
      ['manager', 'designer', 'owner']
    );
  }

  /**
   * Check if user can edit customers
   * Uses RBAC permission system
   */
  static async canEditCustomersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customers.update',
      ['manager', 'designer', 'owner']
    );
  }

  /**
   * Check if user can view customer addresses
   * Uses RBAC permission system
   */
  static async canViewAddressesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customer_addresses.read',
      ['manager', 'designer', 'owner']
    );
  }

  /**
   * Check if user can edit customer addresses
   * Uses RBAC permission system
   */
  static async canEditAddressesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'customer_addresses.update',
      ['manager', 'designer', 'owner']
    );
  }
}