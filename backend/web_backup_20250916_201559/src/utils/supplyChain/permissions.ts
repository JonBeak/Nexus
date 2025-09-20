import { Request, Response } from 'express';
import { User } from '../../types';
import { hybridPermissionCheck } from '../../middleware/rbac';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export class SupplyChainPermissions {
  /**
   * Check if user can view supply chain dashboard
   * Only managers and owners can access supply chain
   */
  static canViewSupplyChain(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can manage categories
   * Only managers and owners can manage categories
   */
  static canManageCategories(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can manage product standards
   * Only managers and owners can manage product standards
   */
  static canManageProductStandards(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can view unified inventory
   * Only managers and owners can view unified inventory
   */
  static canViewUnifiedInventory(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can manage unified inventory
   * Only managers and owners can manage unified inventory
   */
  static canManageUnifiedInventory(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can allocate inventory to jobs
   * Only managers and owners can allocate inventory
   */
  static canAllocateInventory(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can view shopping carts
   * Only managers and owners can view shopping carts
   */
  static canViewShoppingCarts(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can manage shopping carts
   * Only managers and owners can manage shopping carts
   */
  static canManageShoppingCarts(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can place orders with suppliers
   * Only managers and owners can place orders
   */
  static canPlaceOrders(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can view supplier orders
   * Only managers and owners can view supplier orders
   */
  static canViewSupplierOrders(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can manage supplier orders
   * Only managers and owners can manage supplier orders
   */
  static canManageSupplierOrders(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can receive orders
   * Only managers and owners can receive orders
   */
  static canReceiveOrders(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can view low stock alerts
   * Only managers and owners can view low stock alerts
   */
  static canViewLowStock(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can configure reorder points
   * Only managers and owners can configure reorder points
   */
  static canConfigureReorderPoints(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can view job materials
   * Only managers and owners can view job materials
   */
  static canViewJobMaterials(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can manage job materials
   * Only managers and owners can manage job materials
   */
  static canManageJobMaterials(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  /**
   * Check if user can check material availability
   * Only managers and owners can check material availability
   */
  static canCheckMaterialAvailability(user: User): boolean {
    return user.role === 'manager' || user.role === 'owner';
  }

  // =====================================================
  // HYBRID PERMISSION FUNCTIONS
  // =====================================================

  /**
   * Hybrid permission check for viewing supply chain dashboard
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for managing categories
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for managing category fields
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for viewing product standards
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for managing product standards
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for viewing unified inventory
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for managing unified inventory
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for allocating inventory
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for viewing shopping carts
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for managing shopping carts
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for placing orders
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for viewing supplier orders
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for managing supplier orders
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for receiving orders
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for viewing low stock
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for configuring reorder points
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for viewing job materials
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for managing job materials
   * Uses RBAC if enabled, falls back to legacy role check
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
   * Hybrid permission check for checking material availability
   * Uses RBAC if enabled, falls back to legacy role check
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