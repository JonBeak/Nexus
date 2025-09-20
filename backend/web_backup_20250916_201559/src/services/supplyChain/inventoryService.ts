import { SupplyChainPermissions } from '../../utils/supplyChain/permissions';
import { User } from '../../types';
import { InventoryRepository, InventoryData } from '../../repositories/supplyChain/inventoryRepository';

export class InventoryService {
  /**
   * Get inventory items with filters
   */
  static async getInventory(user: User, filters: {
    category_id?: number;
    location?: string;
    low_stock?: boolean;
  } = {}) {
    // Check view permission
    const canView = await SupplyChainPermissions.canViewUnifiedInventoryHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to view unified inventory');
    }

    const inventory = await InventoryRepository.getInventory(filters);
    return { success: true, data: inventory };
  }

  /**
   * Get inventory availability for a product
   */
  static async getInventoryAvailability(user: User, productStandardId: number) {
    // Check view permission
    const canView = await SupplyChainPermissions.canViewUnifiedInventoryHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to view inventory availability');
    }

    const availability = await InventoryRepository.getInventoryAvailability(productStandardId);
    if (!availability) {
      throw new Error('Product standard not found');
    }

    return { success: true, data: availability };
  }

  /**
   * Create new inventory item
   */
  static async createInventoryItem(user: User, data: any) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageUnifiedInventoryHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage unified inventory');
    }

    // Validate required fields
    if (!data.product_standard_id || !data.quantity) {
      throw new Error('Product standard and quantity are required');
    }

    const inventoryData: InventoryData = {
      product_standard_id: data.product_standard_id,
      quantity: data.quantity,
      location: data.location,
      lot_number: data.lot_number,
      serial_number: data.serial_number,
      received_date: data.received_date,
      expiry_date: data.expiry_date,
      cost_per_unit: data.cost_per_unit,
      supplier_order_id: data.supplier_order_id,
      condition_status: data.condition_status || 'new',
      notes: data.notes,
      created_by: user.user_id,
      updated_by: user.user_id
    };

    const insertId = await InventoryRepository.createInventoryItem(inventoryData);
    return {
      success: true,
      data: { id: insertId }
    };
  }

  /**
   * Update inventory item
   */
  static async updateInventoryItem(user: User, id: number, data: any) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageUnifiedInventoryHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage unified inventory');
    }

    const inventoryData = {
      quantity: data.quantity,
      reserved_quantity: data.reserved_quantity,
      location: data.location,
      lot_number: data.lot_number,
      serial_number: data.serial_number,
      received_date: data.received_date,
      expiry_date: data.expiry_date,
      cost_per_unit: data.cost_per_unit,
      condition_status: data.condition_status,
      notes: data.notes,
      updated_by: user.user_id
    };

    const affectedRows = await InventoryRepository.updateInventoryItem(id, inventoryData);
    if (affectedRows === 0) {
      throw new Error('Inventory item not found');
    }

    return { success: true, message: 'Inventory item updated successfully' };
  }

  /**
   * Delete inventory item
   */
  static async deleteInventoryItem(user: User, id: number) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageUnifiedInventoryHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage unified inventory');
    }

    // Check if inventory is allocated to jobs
    const allocationCount = await InventoryRepository.getInventoryAllocationCount(id);
    if (allocationCount > 0) {
      throw new Error('Cannot delete inventory item with active allocations');
    }

    const affectedRows = await InventoryRepository.deleteInventoryItem(id);
    if (affectedRows === 0) {
      throw new Error('Inventory item not found');
    }

    return { success: true, message: 'Inventory item deleted successfully' };
  }

  /**
   * Get low stock items
   */
  static async getLowStockItems(user: User, filters: { category_id?: number } = {}) {
    // Check view permission
    const canView = await SupplyChainPermissions.canViewLowStockHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to view low stock alerts');
    }

    const lowStockItems = await InventoryRepository.getLowStockItems(filters);
    return { success: true, data: lowStockItems };
  }
}