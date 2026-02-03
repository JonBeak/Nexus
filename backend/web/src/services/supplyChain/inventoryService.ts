// Supply Chain: Inventory Service
// Purpose: Business logic for inventory management
// Created: 2026-02-02

import { SupplierProductRepository } from '../../repositories/supplyChain/supplierProductRepository';
import {
  InventoryTransactionRepository,
  TransactionType,
  CreateTransactionData,
  TransactionSearchParams
} from '../../repositories/supplyChain/inventoryTransactionRepository';
import { ServiceResult } from '../../types/serviceResults';

const supplierProductRepo = new SupplierProductRepository();
const transactionRepo = new InventoryTransactionRepository();

export class InventoryService {
  /**
   * Get stock levels for supplier products
   */
  async getStockLevels(params: {
    archetype_id?: number;
    supplier_id?: number;
    category?: string;
    stock_status?: 'out_of_stock' | 'critical' | 'low' | 'ok';
    search?: string;
  } = {}): Promise<ServiceResult<any[]>> {
    try {
      const data = await supplierProductRepo.getStockLevels(params);
      return { success: true, data };
    } catch (error) {
      console.error('Error getting stock levels:', error);
      return {
        success: false,
        error: 'Failed to get stock levels',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get aggregated archetype stock levels
   */
  async getArchetypeStockLevels(params: {
    category?: string;
    stock_status?: 'out_of_stock' | 'critical' | 'low' | 'ok';
    search?: string;
  } = {}): Promise<ServiceResult<any[]>> {
    try {
      const data = await supplierProductRepo.getArchetypeStockLevels(params);
      return { success: true, data };
    } catch (error) {
      console.error('Error getting archetype stock levels:', error);
      return {
        success: false,
        error: 'Failed to get archetype stock levels',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(params: {
    category?: string;
    supplier_id?: number;
    alert_level?: 'out_of_stock' | 'critical' | 'low';
  } = {}): Promise<ServiceResult<any[]>> {
    try {
      const data = await supplierProductRepo.getLowStockAlerts(params);
      return { success: true, data };
    } catch (error) {
      console.error('Error getting low stock alerts:', error);
      return {
        success: false,
        error: 'Failed to get low stock alerts',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get stock summary by category
   */
  async getStockSummaryByCategory(): Promise<ServiceResult<any[]>> {
    try {
      const data = await supplierProductRepo.getStockSummaryByCategory();
      return { success: true, data };
    } catch (error) {
      console.error('Error getting stock summary:', error);
      return {
        success: false,
        error: 'Failed to get stock summary',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Adjust stock with transaction logging
   */
  async adjustStock(params: {
    supplier_product_id: number;
    adjustment: number;
    transaction_type: TransactionType;
    reference_type?: string;
    reference_id?: number;
    unit_cost?: number;
    notes?: string;
    user_id?: number;
  }): Promise<ServiceResult<{ transaction_id: number; quantity_before: number; quantity_after: number }>> {
    try {
      // Validate supplier product exists
      const product = await supplierProductRepo.findById(params.supplier_product_id);
      if (!product) {
        return {
          success: false,
          error: `Supplier product ${params.supplier_product_id} not found`,
          code: 'NOT_FOUND'
        };
      }

      // Perform the stock adjustment
      const { quantity_before, quantity_after } = await supplierProductRepo.adjustStock(
        params.supplier_product_id,
        params.adjustment
      );

      // Log the transaction
      const transactionId = await transactionRepo.create({
        supplier_product_id: params.supplier_product_id,
        transaction_type: params.transaction_type,
        quantity: params.adjustment,
        quantity_before,
        quantity_after,
        reference_type: params.reference_type,
        reference_id: params.reference_id,
        unit_cost: params.unit_cost,
        notes: params.notes,
        created_by: params.user_id
      });

      return {
        success: true,
        data: {
          transaction_id: transactionId,
          quantity_before,
          quantity_after
        }
      };
    } catch (error) {
      console.error('Error adjusting stock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to adjust stock',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Receive stock from supplier order
   */
  async receiveStock(params: {
    supplier_product_id: number;
    quantity: number;
    unit_cost?: number;
    supplier_order_id?: number;
    notes?: string;
    user_id?: number;
  }): Promise<ServiceResult<{ transaction_id: number; quantity_before: number; quantity_after: number }>> {
    return this.adjustStock({
      supplier_product_id: params.supplier_product_id,
      adjustment: params.quantity,
      transaction_type: 'received',
      reference_type: params.supplier_order_id ? 'supplier_order' : undefined,
      reference_id: params.supplier_order_id,
      unit_cost: params.unit_cost,
      notes: params.notes,
      user_id: params.user_id
    });
  }

  /**
   * Use/consume stock for production
   */
  async useStock(params: {
    supplier_product_id: number;
    quantity: number;
    order_id?: number;
    notes?: string;
    user_id?: number;
  }): Promise<ServiceResult<{ transaction_id: number; quantity_before: number; quantity_after: number }>> {
    return this.adjustStock({
      supplier_product_id: params.supplier_product_id,
      adjustment: -Math.abs(params.quantity), // Ensure negative for usage
      transaction_type: 'used',
      reference_type: params.order_id ? 'order' : undefined,
      reference_id: params.order_id,
      notes: params.notes,
      user_id: params.user_id
    });
  }

  /**
   * Manual inventory adjustment (count correction)
   */
  async makeAdjustment(params: {
    supplier_product_id: number;
    new_quantity: number;
    notes?: string;
    user_id?: number;
  }): Promise<ServiceResult<{ transaction_id: number; quantity_before: number; quantity_after: number }>> {
    try {
      // Get current quantity to calculate adjustment
      const product = await supplierProductRepo.findById(params.supplier_product_id);
      if (!product) {
        return {
          success: false,
          error: `Supplier product ${params.supplier_product_id} not found`,
          code: 'NOT_FOUND'
        };
      }

      const currentQty = Number(product.quantity_on_hand) || 0;
      const adjustment = params.new_quantity - currentQty;

      return this.adjustStock({
        supplier_product_id: params.supplier_product_id,
        adjustment,
        transaction_type: 'adjusted',
        notes: params.notes || `Adjusted from ${currentQty} to ${params.new_quantity}`,
        user_id: params.user_id
      });
    } catch (error) {
      console.error('Error making adjustment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to make adjustment',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Update stock settings (reorder point, location, etc.)
   */
  async updateStockSettings(
    supplierProductId: number,
    updates: {
      location?: string;
      reorder_point?: number;
      last_count_date?: string;
    }
  ): Promise<ServiceResult<void>> {
    try {
      const product = await supplierProductRepo.findById(supplierProductId);
      if (!product) {
        return {
          success: false,
          error: `Supplier product ${supplierProductId} not found`,
          code: 'NOT_FOUND'
        };
      }

      await supplierProductRepo.updateStock(supplierProductId, updates);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating stock settings:', error);
      return {
        success: false,
        error: 'Failed to update stock settings',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Reserve stock for an order
   */
  async reserveStock(
    supplierProductId: number,
    quantity: number
  ): Promise<ServiceResult<void>> {
    try {
      await supplierProductRepo.reserveStock(supplierProductId, quantity);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error reserving stock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reserve stock',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Release reserved stock
   */
  async releaseReservation(
    supplierProductId: number,
    quantity: number
  ): Promise<ServiceResult<void>> {
    try {
      await supplierProductRepo.releaseReservation(supplierProductId, quantity);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error releasing reservation:', error);
      return {
        success: false,
        error: 'Failed to release reservation',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(params: TransactionSearchParams = {}): Promise<ServiceResult<any[]>> {
    try {
      const data = await transactionRepo.findAll(params);
      return { success: true, data };
    } catch (error) {
      console.error('Error getting transactions:', error);
      return {
        success: false,
        error: 'Failed to get transactions',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get transactions for a specific supplier product
   */
  async getProductTransactions(
    supplierProductId: number,
    limit: number = 50
  ): Promise<ServiceResult<any[]>> {
    try {
      const data = await transactionRepo.findBySupplierProduct(supplierProductId, limit);
      return { success: true, data };
    } catch (error) {
      console.error('Error getting product transactions:', error);
      return {
        success: false,
        error: 'Failed to get product transactions',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 20): Promise<ServiceResult<any[]>> {
    try {
      const data = await transactionRepo.getRecentActivity(limit);
      return { success: true, data };
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return {
        success: false,
        error: 'Failed to get recent activity',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Get transaction summary
   */
  async getTransactionSummary(params: {
    start_date?: string;
    end_date?: string;
    supplier_id?: number;
    archetype_id?: number;
  } = {}): Promise<ServiceResult<any[]>> {
    try {
      const data = await transactionRepo.getSummary(params);
      return { success: true, data };
    } catch (error) {
      console.error('Error getting transaction summary:', error);
      return {
        success: false,
        error: 'Failed to get transaction summary',
        code: 'DATABASE_ERROR'
      };
    }
  }
}
