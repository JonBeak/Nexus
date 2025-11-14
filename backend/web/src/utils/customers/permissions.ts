/**
 * File Clean up Finished: Nov 14, 2025
 * Changes: Replaced hybridPermissionCheck with direct hasPermission calls
 * Previous cleanup (Nov 13): Removed unused AuthenticatedRequest export
 */

import { Request, Response } from 'express';
import { User } from '../../types';
import { hasPermission } from '../../middleware/rbac';

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
    return await hasPermission(user.user_id, 'customer_addresses.delete');
  }

  /**
   * Check if user can deactivate customers
   * Uses RBAC permission system
   */
  static async canDeactivateCustomersHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'customers.deactivate');
  }

  /**
   * Check if user can reactivate customers
   * Uses customers.update permission for reactivation operations
   */
  static async canReactivateCustomersHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'customers.update');
  }

  /**
   * Check if user can view customers
   * Uses RBAC permission system
   */
  static async canViewCustomersHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'customers.read');
  }

  /**
   * Check if user can edit customers
   * Uses RBAC permission system
   */
  static async canEditCustomersHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'customers.update');
  }

  /**
   * Check if user can view customer addresses
   * Uses RBAC permission system
   */
  static async canViewAddressesHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'customer_addresses.read');
  }

  /**
   * Check if user can edit customer addresses
   * Uses RBAC permission system
   */
  static async canEditAddressesHybrid(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'customer_addresses.update');
  }
}