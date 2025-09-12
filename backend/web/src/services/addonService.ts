import { pool } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface AddonData {
  addon_type_id: number;
  input_data: any;
  customer_description?: string;
  internal_notes?: string;
}

export interface UpdateAddonData {
  input_data?: any;
  customer_description?: string;
  internal_notes?: string;
}

export class AddonService {
  
  async createAddon(itemId: number, data: AddonData): Promise<any> {
    try {
      // Get next addon order within the item
      const [orderResult] = await pool.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(addon_order), 0) + 1 as next_order 
         FROM job_item_addons 
         WHERE item_id = ?`,
        [itemId]
      );

      // Get addon type for basic pricing
      const [addonTypeResult] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM addon_types WHERE id = ?`,
        [data.addon_type_id]
      );

      if (addonTypeResult.length === 0) {
        throw new Error('Addon type not found');
      }

      const addonType = addonTypeResult[0];

      // Basic pricing calculation (will be enhanced in Phase 3)
      const quantity = 1;
      const unitPrice = 15.00; // Temporary fixed price for addons
      const extendedPrice = quantity * unitPrice;

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO job_item_addons 
         (item_id, addon_type_id, addon_order, input_data, quantity, unit_price, extended_price, customer_description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          data.addon_type_id,
          orderResult[0].next_order,
          JSON.stringify(data.input_data),
          quantity,
          unitPrice,
          extendedPrice,
          data.customer_description || `${addonType.name} addon`
        ]
      );

      return {
        id: result.insertId,
        item_id: itemId,
        addon_type_id: data.addon_type_id,
        addon_type_name: addonType.name,
        addon_order: orderResult[0].next_order,
        input_data: data.input_data,
        quantity,
        unit_price: unitPrice,
        extended_price: extendedPrice,
        customer_description: data.customer_description || `${addonType.name} addon`
      };
    } catch (error) {
      console.error('Service error creating addon:', error);
      throw error instanceof Error ? error : new Error('Failed to create addon');
    }
  }

  async updateAddon(addonId: number, data: UpdateAddonData): Promise<void> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE job_item_addons 
         SET input_data = COALESCE(?, input_data),
             customer_description = COALESCE(?, customer_description)
         WHERE id = ?`,
        [
          data.input_data ? JSON.stringify(data.input_data) : null,
          data.customer_description,
          addonId
        ]
      );

      if (result.affectedRows === 0) {
        throw new Error('Addon not found');
      }
    } catch (error) {
      console.error('Service error updating addon:', error);
      throw error instanceof Error ? error : new Error('Failed to update addon');
    }
  }

  async deleteAddon(addonId: number): Promise<void> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `DELETE FROM job_item_addons WHERE id = ?`,
        [addonId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Addon not found');
      }
    } catch (error) {
      console.error('Service error deleting addon:', error);
      throw error instanceof Error ? error : new Error('Failed to delete addon');
    }
  }

  async getAddonTypesForProduct(productTypeId: number): Promise<RowDataPacket[]> {
    try {
      // Get product type name first
      const [productResult] = await pool.execute<RowDataPacket[]>(
        `SELECT name FROM product_types WHERE id = ?`,
        [productTypeId]
      );
      
      if (productResult.length === 0) {
        throw new Error('Product type not found');
      }
      
      const productTypeName = productResult[0].name;
      
      // Get applicable addon types
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM addon_types 
         WHERE is_active = TRUE 
         AND JSON_CONTAINS(applicable_to, ?)
         ORDER BY category, name`,
        [JSON.stringify(productTypeName)]
      );
      
      return rows;
    } catch (error) {
      console.error('Service error fetching addon types for product:', error);
      throw error instanceof Error ? error : new Error('Failed to fetch addon types');
    }
  }

  // Business logic for addon validation
  validateAddonData(data: AddonData): string[] {
    const errors: string[] = [];
    
    if (!data.addon_type_id) {
      errors.push('Addon type is required');
    }
    
    return errors;
  }

  // Business logic for addon pricing calculations
  calculateAddonPricing(addonType: any, inputData: any): { unitPrice: number; extendedPrice: number } {
    // This would contain complex pricing rules based on addon type
    // For now, return basic pricing
    let basePrice = 15.00;
    
    // Apply modifiers based on addon type and input data
    if (addonType.pricing_rules && addonType.pricing_rules.base_price) {
      basePrice = addonType.pricing_rules.base_price;
    }
    
    // Apply complexity modifiers
    if (inputData.complexity_multiplier) {
      basePrice *= inputData.complexity_multiplier;
    }
    
    const quantity = inputData.quantity || 1;
    
    return {
      unitPrice: basePrice,
      extendedPrice: basePrice * quantity
    };
  }
}