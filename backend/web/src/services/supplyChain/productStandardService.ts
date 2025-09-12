import { SupplyChainPermissions } from '../../utils/supplyChain/permissions';
import { User } from '../../types';
import { ProductStandardRepository, ProductStandardData } from '../../repositories/supplyChain/productStandardRepository';

export class ProductStandardService {
  /**
   * Get all product standards with filters
   */
  static async getProductStandards(user: User, filters: {
    category_id?: number;
    supplier_id?: number;
    search?: string;
  } = {}) {
    // Check view permission
    const canView = await SupplyChainPermissions.canViewProductStandardsHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to view product standards');
    }

    const standards = await ProductStandardRepository.getProductStandards(filters);
    
    // Parse JSON specifications
    const parsedStandards = standards.map(standard => ({
      ...standard,
      specifications: standard.specifications ? JSON.parse(standard.specifications) : {}
    }));

    return { success: true, data: parsedStandards };
  }

  /**
   * Get single product standard by ID
   */
  static async getProductStandardById(user: User, id: number) {
    // Check view permission
    const canView = await SupplyChainPermissions.canViewProductStandardsHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to view product standards');
    }

    const standard = await ProductStandardRepository.getProductStandardById(id);
    if (!standard) {
      throw new Error('Product standard not found');
    }

    const parsedStandard = {
      ...standard,
      specifications: standard.specifications ? JSON.parse(standard.specifications) : {}
    };

    return { success: true, data: parsedStandard };
  }

  /**
   * Create new product standard
   */
  static async createProductStandard(user: User, data: any) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageProductStandardsHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage product standards');
    }

    // Validate required fields
    if (!data.category_id || !data.name) {
      throw new Error('Category and name are required');
    }

    const standardData: ProductStandardData = {
      category_id: data.category_id,
      name: data.name,
      description: data.description,
      supplier_id: data.supplier_id,
      supplier_part_number: data.supplier_part_number,
      current_price: data.current_price,
      price_date: data.price_date,
      minimum_order_qty: data.minimum_order_qty || 1,
      unit_of_measure: data.unit_of_measure || 'each',
      reorder_point: data.reorder_point,
      reorder_quantity: data.reorder_quantity,
      lead_time_days: data.lead_time_days || 7,
      specifications: data.specifications ? JSON.stringify(data.specifications) : undefined,
      notes: data.notes,
      created_by: user.user_id,
      updated_by: user.user_id
    };

    const insertId = await ProductStandardRepository.createProductStandard(standardData);
    return {
      success: true,
      data: { id: insertId, name: standardData.name }
    };
  }

  /**
   * Update product standard
   */
  static async updateProductStandard(user: User, id: number, data: any) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageProductStandardsHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage product standards');
    }

    const standardData: ProductStandardData = {
      category_id: data.category_id,
      name: data.name,
      description: data.description,
      supplier_id: data.supplier_id,
      supplier_part_number: data.supplier_part_number,
      current_price: data.current_price,
      price_date: data.price_date,
      minimum_order_qty: data.minimum_order_qty,
      unit_of_measure: data.unit_of_measure,
      reorder_point: data.reorder_point,
      reorder_quantity: data.reorder_quantity,
      lead_time_days: data.lead_time_days,
      specifications: data.specifications ? JSON.stringify(data.specifications) : undefined,
      notes: data.notes,
      is_active: data.is_active,
      updated_by: user.user_id
    };

    const affectedRows = await ProductStandardRepository.updateProductStandard(id, standardData);
    if (affectedRows === 0) {
      throw new Error('Product standard not found');
    }

    return { success: true, message: 'Product standard updated successfully' };
  }

  /**
   * Delete product standard
   */
  static async deleteProductStandard(user: User, id: number) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageProductStandardsHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage product standards');
    }

    // Check if product has inventory
    const inventoryCount = await ProductStandardRepository.getProductInventoryCount(id);
    if (inventoryCount > 0) {
      throw new Error('Cannot delete product with existing inventory');
    }

    const affectedRows = await ProductStandardRepository.deleteProductStandard(id);
    if (affectedRows === 0) {
      throw new Error('Product standard not found');
    }

    return { success: true, message: 'Product standard deleted successfully' };
  }

  /**
   * Update reorder settings
   */
  static async updateReorderSettings(user: User, id: number, data: any) {
    // Check permissions  
    const canConfigure = await SupplyChainPermissions.canConfigureReorderPointsHybrid(user);
    if (!canConfigure) {
      throw new Error('Insufficient permissions to configure reorder points');
    }

    const reorderData = {
      reorder_point: data.reorder_point,
      reorder_quantity: data.reorder_quantity,
      updated_by: user.user_id
    };

    const affectedRows = await ProductStandardRepository.updateReorderSettings(id, reorderData);
    if (affectedRows === 0) {
      throw new Error('Product standard not found');
    }

    return { success: true, message: 'Reorder settings updated successfully' };
  }
}