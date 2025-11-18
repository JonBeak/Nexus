// File Clean up Started: 2025-11-18

/**
 * Vinyl Permissions Utility
 * Centralized permission checks for vinyl inventory system
 * Updated to use RBAC system instead of hardcoded role checks
 */

import { User } from '../../types';
import { hasPermission } from '../../middleware/rbac';

export class VinylPermissions {
  /**
   * Check if user can view vinyl inventory
   * Uses RBAC permission: vinyl.read
   */
  static async canViewVinylInventory(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.read');
  }

  /**
   * Check if user can manage vinyl inventory (create, update, delete)
   * Uses RBAC permissions: vinyl.create, vinyl.update, vinyl.delete
   */
  static async canManageVinylInventory(user: User): Promise<boolean> {
    // Check if user has at least update permission (most common operation)
    return await hasPermission(user.user_id, 'vinyl.update');
  }

  /**
   * Check if user can create vinyl items
   * Uses RBAC permission: vinyl.create
   */
  static async canCreateVinyl(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.create');
  }

  /**
   * Check if user can update vinyl items
   * Uses RBAC permission: vinyl.update
   */
  static async canUpdateVinyl(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.update');
  }

  /**
   * Check if user can delete vinyl items
   * Uses RBAC permission: vinyl.delete
   */
  static async canDeleteVinyl(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.delete');
  }

  /**
   * Check if user can view vinyl products catalog
   * Uses RBAC permission: vinyl.read
   */
  static async canViewVinylProducts(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.read');
  }

  /**
   * Check if user can manage vinyl products (create, update, delete)
   * Uses RBAC permission: vinyl.update
   */
  static async canManageVinylProducts(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.update');
  }

  /**
   * Check if user can mark vinyl as used
   * Uses RBAC permission: vinyl.update
   */
  static async canMarkVinylAsUsed(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.update');
  }

  /**
   * Check if user can view vinyl statistics
   * Uses RBAC permission: vinyl.read
   */
  static async canViewVinylStats(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.read');
  }

  /**
   * Check if user can manage job associations for vinyl
   * Uses RBAC permission: vinyl.update
   */
  static async canManageJobAssociations(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.update');
  }

  /**
   * Check if user can perform bulk operations
   * Uses RBAC permission: vinyl.update
   */
  static async canPerformBulkOperations(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.update');
  }

  /**
   * Generic permission check helper
   * Throws error if user doesn't have required permission
   */
  static async requirePermission(user: User, permissionCheck: (user: User) => Promise<boolean>, action: string): Promise<void> {
    const hasAccess = await permissionCheck(user);
    if (!hasAccess) {
      throw new Error(`Insufficient permissions to ${action}`);
    }
  }

  /**
   * Check if user can access vinyl system at all
   * Basic access check for vinyl routes - uses vinyl.read permission
   */
  static async canAccessVinylSystem(user: User): Promise<boolean> {
    return await hasPermission(user.user_id, 'vinyl.read');
  }
}