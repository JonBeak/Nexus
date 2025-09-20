import { Request, Response } from 'express';
import { User } from '../../types';
import { hybridPermissionCheck } from '../../middleware/rbac';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export class SupplyChainPermissions {
  // =====================================================
  // RBAC PERMISSION FUNCTIONS
  // =====================================================

  /**
   * Check if user can view supply chain dashboard
   * Uses RBAC permission system
   */
  static async canViewSupplyChainHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'supply_chain.read',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user can manage categories
   * Uses RBAC permission system
   */
  static async canManageCategoriesHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'material_categories.manage',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canmanaging category fields
   * Uses RBAC permission system
   */
  static async canManageCategoryFieldsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'material_categories.manage_fields',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canviewing product standards
   * Uses RBAC permission system
   */
  static async canViewProductStandardsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'product_standards.read',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canmanaging product standards
   * Uses RBAC permission system
   */
  static async canManageProductStandardsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'product_standards.manage',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canviewing unified inventory
   * Uses RBAC permission system
   */
  static async canViewUnifiedInventoryHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'inventory_unified.read',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canmanaging unified inventory
   * Uses RBAC permission system
   */
  static async canManageUnifiedInventoryHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'inventory_unified.manage',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canallocating inventory
   * Uses RBAC permission system
   */
  static async canAllocateInventoryHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'inventory_unified.allocate',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canviewing shopping carts
   * Uses RBAC permission system
   */
  static async canViewShoppingCartsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'shopping_carts.read',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canmanaging shopping carts
   * Uses RBAC permission system
   */
  static async canManageShoppingCartsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'shopping_carts.manage',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canplacing orders
   * Uses RBAC permission system
   */
  static async canPlaceOrdersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'supplier_orders.place',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canviewing supplier orders
   * Uses RBAC permission system
   */
  static async canViewSupplierOrdersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'supplier_orders.read',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canmanaging supplier orders
   * Uses RBAC permission system
   */
  static async canManageSupplierOrdersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'supplier_orders.manage',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canreceiving orders
   * Uses RBAC permission system
   */
  static async canReceiveOrdersHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'supplier_orders.receive',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canviewing low stock
   * Uses RBAC permission system
   */
  static async canViewLowStockHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'low_stock_alerts.read',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canconfiguring reorder points
   * Uses RBAC permission system
   */
  static async canConfigureReorderPointsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'low_stock_alerts.configure',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canviewing job materials
   * Uses RBAC permission system
   */
  static async canViewJobMaterialsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'job_materials.read',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canmanaging job materials
   * Uses RBAC permission system
   */
  static async canManageJobMaterialsHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'job_materials.manage',
      ['manager', 'owner']
    );
  }

  /**
   * Check if user canchecking material availability
   * Uses RBAC permission system
   */
  static async canCheckMaterialAvailabilityHybrid(user: User): Promise<boolean> {
    return await hybridPermissionCheck(
      user.user_id,
      user.role,
      'job_materials.check_availability',
      ['manager', 'owner']
    );
  }

  /**
   * Get user role display name
   */
  static getRoleDisplayName(role: string): string {
    switch (role) {
      case 'manager': return 'Manager';
      case 'owner': return 'Owner';
      case 'designer': return 'Designer';
      case 'production_staff': return 'Production Staff';
      default: return 'Unknown';
    }
  }
}