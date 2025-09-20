/**
 * Vinyl Permissions Utility
 * Centralized permission checks for vinyl inventory system
 */

import { User } from '../../types';

export class VinylPermissions {
  /**
   * Check if user can view vinyl inventory
   * Based on existing route permissions - managers and owners only
   */
  static canViewVinylInventory(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can manage vinyl inventory (create, update, delete)
   * Based on existing route permissions - managers and owners only
   */
  static canManageVinylInventory(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can view vinyl products catalog
   * Based on existing route permissions - managers and owners only
   */
  static canViewVinylProducts(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can manage vinyl products (create, update, delete)
   * Based on existing route permissions - managers and owners only
   */
  static canManageVinylProducts(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can mark vinyl as used
   * Managers and owners can mark vinyl as used
   */
  static canMarkVinylAsUsed(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can view vinyl statistics
   * Same as view permissions - managers and owners only
   */
  static canViewVinylStats(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can manage job associations for vinyl
   * Same as manage permissions - managers and owners only
   */
  static canManageJobAssociations(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can perform bulk operations
   * Same as manage permissions - managers and owners only
   */
  static canPerformBulkOperations(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Generic permission check helper
   * Throws error if user doesn't have required permission
   */
  static requirePermission(user: User, permissionCheck: (user: User) => boolean, action: string): void {
    if (!permissionCheck(user)) {
      throw new Error(`Insufficient permissions to ${action}`);
    }
  }

  /**
   * Check if user can access vinyl system at all
   * Basic access check for vinyl routes
   */
  static canAccessVinylSystem(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }
}