// Phase 4.c: Supplier Product Service
// Purpose: Business logic, validation, and transaction coordination for supplier products
// Created: 2025-12-19

import { SupplierProductRepository, SupplierProductRow, SupplierProductSearchParams, PriceRangeRow } from '../../repositories/supplyChain/supplierProductRepository';
import { PricingHistoryRepository, PricingHistoryRow } from '../../repositories/supplyChain/pricingHistoryRepository';
import { ServiceResult } from '../../types/serviceResults';
import { pool } from '../../config/database';

export class SupplierProductService {
  private repository: SupplierProductRepository;
  private pricingRepository: PricingHistoryRepository;

  // Configuration
  private readonly PRICE_ALERT_THRESHOLD_PERCENT = 5.0; // Alert if price change > 5%

  constructor() {
    this.repository = new SupplierProductRepository();
    this.pricingRepository = new PricingHistoryRepository();
  }

  /**
   * Get all supplier products with optional filtering
   */
  async getSupplierProducts(params: SupplierProductSearchParams): Promise<ServiceResult<SupplierProductRow[]>> {
    try {
      const products = await this.repository.findAll(params);
      return { success: true, data: products };
    } catch (error) {
      console.error('Error in SupplierProductService.getSupplierProducts:', error);
      return {
        success: false,
        error: 'Failed to fetch supplier products',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get single supplier product by ID
   */
  async getSupplierProductById(id: number): Promise<ServiceResult<SupplierProductRow>> {
    try {
      const product = await this.repository.findById(id);

      if (!product) {
        return {
          success: false,
          error: 'Supplier product not found',
          code: 'NOT_FOUND'
        };
      }

      return { success: true, data: product };
    } catch (error) {
      console.error('Error in SupplierProductService.getSupplierProductById:', error);
      return {
        success: false,
        error: 'Failed to fetch supplier product',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get all supplier products for an archetype
   */
  async getSupplierProductsByArchetype(archetypeId: number): Promise<ServiceResult<SupplierProductRow[]>> {
    try {
      if (!archetypeId || archetypeId <= 0) {
        return {
          success: false,
          error: 'Valid archetype ID is required',
          code: 'VALIDATION_ERROR'
        };
      }

      const products = await this.repository.findByArchetype(archetypeId);
      return { success: true, data: products };
    } catch (error) {
      console.error('Error in SupplierProductService.getSupplierProductsByArchetype:', error);
      return {
        success: false,
        error: 'Failed to fetch supplier products for archetype',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Create new supplier product
   */
  async createSupplierProduct(data: {
    archetype_id: number;
    supplier_id: number;
    brand_name?: string;
    sku?: string;
    product_name?: string;
    min_order_quantity?: number;
    lead_time_days?: number;
    specifications?: Record<string, any>;
    notes?: string;
    is_preferred?: boolean;
    initial_price?: {
      unit_price: number;
      cost_currency?: string;
      effective_start_date?: Date | string;
      notes?: string;
    };
  }, userId?: number): Promise<ServiceResult<number>> {
    try {
      // Validate required fields
      if (!data.archetype_id || data.archetype_id <= 0) {
        return {
          success: false,
          error: 'Valid archetype ID is required',
          code: 'VALIDATION_ERROR'
        };
      }

      if (!data.supplier_id || data.supplier_id <= 0) {
        return {
          success: false,
          error: 'Valid supplier ID is required',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check for duplicates
      const isDuplicate = await this.repository.isDuplicate(
        data.archetype_id,
        data.supplier_id,
        data.sku || null
      );

      if (isDuplicate) {
        return {
          success: false,
          error: 'Supplier product with same archetype, supplier, and SKU already exists',
          code: 'DUPLICATE_ERROR'
        };
      }

      // Validate numeric fields
      if (data.min_order_quantity !== undefined && data.min_order_quantity < 0) {
        return {
          success: false,
          error: 'Min order quantity cannot be negative',
          code: 'VALIDATION_ERROR'
        };
      }

      if (data.lead_time_days !== undefined && data.lead_time_days < 0) {
        return {
          success: false,
          error: 'Lead time days cannot be negative',
          code: 'VALIDATION_ERROR'
        };
      }

      if (data.initial_price && data.initial_price.unit_price < 0) {
        return {
          success: false,
          error: 'Price cannot be negative',
          code: 'VALIDATION_ERROR'
        };
      }

      // Create supplier product
      const supplierId = await this.repository.create({
        archetype_id: data.archetype_id,
        supplier_id: data.supplier_id,
        brand_name: data.brand_name ? data.brand_name.trim() : null,
        sku: data.sku ? data.sku.trim() : null,
        product_name: data.product_name ? data.product_name.trim() : null,
        min_order_quantity: data.min_order_quantity,
        lead_time_days: data.lead_time_days,
        specifications: data.specifications,
        notes: data.notes ? data.notes.trim() : null,
        is_preferred: data.is_preferred || false,
        created_by: userId
      });

      // Add initial price if provided
      if (data.initial_price && data.initial_price.unit_price > 0) {
        const effectiveDate = data.initial_price.effective_start_date
          ? typeof data.initial_price.effective_start_date === 'string'
            ? new Date(data.initial_price.effective_start_date)
            : data.initial_price.effective_start_date
          : new Date();

        await this.pricingRepository.create({
          supplier_product_id: supplierId,
          unit_price: data.initial_price.unit_price,
          cost_currency: data.initial_price.cost_currency || 'CAD',
          effective_start_date: effectiveDate,
          notes: data.initial_price.notes,
          created_by: userId
        });
      }

      return {
        success: true,
        data: supplierId
      };
    } catch (error) {
      console.error('Error in SupplierProductService.createSupplierProduct:', error);
      return {
        success: false,
        error: 'Failed to create supplier product',
        code: 'CREATE_ERROR'
      };
    }
  }

  /**
   * Update supplier product
   */
  async updateSupplierProduct(id: number, data: {
    supplier_id?: number;
    brand_name?: string;
    sku?: string;
    product_name?: string;
    min_order_quantity?: number;
    lead_time_days?: number;
    specifications?: Record<string, any>;
    notes?: string;
    is_active?: boolean;
    is_preferred?: boolean;
  }, userId?: number): Promise<ServiceResult<void>> {
    try {
      // Verify product exists
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Supplier product not found',
          code: 'NOT_FOUND'
        };
      }

      // Validate supplier_id if provided
      if (data.supplier_id !== undefined && data.supplier_id <= 0) {
        return {
          success: false,
          error: 'Valid supplier ID is required',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate numeric fields
      if (data.min_order_quantity !== undefined && data.min_order_quantity < 0) {
        return {
          success: false,
          error: 'Min order quantity cannot be negative',
          code: 'VALIDATION_ERROR'
        };
      }

      if (data.lead_time_days !== undefined && data.lead_time_days < 0) {
        return {
          success: false,
          error: 'Lead time days cannot be negative',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check for duplicates if supplier_id or SKU is being updated
      const newSupplierId = data.supplier_id !== undefined ? data.supplier_id : existing.supplier_id;
      const newSku = data.sku !== undefined ? data.sku : existing.sku;

      if ((data.supplier_id !== undefined && data.supplier_id !== existing.supplier_id) ||
          (data.sku !== undefined && data.sku !== existing.sku)) {
        const isDuplicate = await this.repository.isDuplicate(
          existing.archetype_id,
          newSupplierId,
          newSku ? newSku.trim() : null,
          id
        );

        if (isDuplicate) {
          return {
            success: false,
            error: 'Another supplier product with same archetype, supplier, and SKU already exists',
            code: 'DUPLICATE_ERROR'
          };
        }
      }

      // Update supplier product
      await this.repository.update(id, {
        supplier_id: data.supplier_id,
        brand_name: data.brand_name !== undefined ? (data.brand_name ? data.brand_name.trim() : null) : undefined,
        sku: data.sku !== undefined ? (data.sku ? data.sku.trim() : null) : undefined,
        product_name: data.product_name !== undefined ? (data.product_name ? data.product_name.trim() : null) : undefined,
        min_order_quantity: data.min_order_quantity,
        lead_time_days: data.lead_time_days,
        specifications: data.specifications,
        notes: data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : undefined,
        is_active: data.is_active,
        is_preferred: data.is_preferred,
        updated_by: userId
      });

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierProductService.updateSupplierProduct:', error);
      return {
        success: false,
        error: 'Failed to update supplier product',
        code: 'UPDATE_ERROR'
      };
    }
  }

  /**
   * Delete supplier product (soft delete)
   */
  async deleteSupplierProduct(id: number, userId?: number): Promise<ServiceResult<void>> {
    try {
      const existing = await this.repository.findById(id);

      if (!existing) {
        return {
          success: false,
          error: 'Supplier product not found',
          code: 'NOT_FOUND'
        };
      }

      // Soft delete
      await this.repository.softDelete(id, userId);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierProductService.deleteSupplierProduct:', error);
      return {
        success: false,
        error: 'Failed to delete supplier product',
        code: 'DELETE_ERROR'
      };
    }
  }

  /**
   * Add new price to supplier product
   * Implements transaction: END old price, INSERT new price
   */
  async addPrice(supplierId: number, data: {
    unit_price: number;
    cost_currency?: string;
    effective_start_date: Date;
    notes?: string;
  }, userId?: number): Promise<ServiceResult<{ pricing_id: number; alert: boolean; change_percent: number | null }>> {
    let connection;
    try {
      // Verify supplier product exists
      const existing = await this.repository.findById(supplierId);
      if (!existing) {
        return {
          success: false,
          error: 'Supplier product not found',
          code: 'NOT_FOUND'
        };
      }

      // Validate price
      if (data.unit_price === undefined || data.unit_price < 0) {
        return {
          success: false,
          error: 'Valid price is required',
          code: 'VALIDATION_ERROR'
        };
      }

      if (data.unit_price === 0) {
        return {
          success: false,
          error: 'Price must be greater than 0',
          code: 'VALIDATION_ERROR'
        };
      }

      // Get current price
      const currentPrice = await this.pricingRepository.getCurrentPrice(supplierId);
      const changePercent = currentPrice
        ? Math.round(((data.unit_price - currentPrice.unit_price) / currentPrice.unit_price) * 10000) / 100
        : null;

      // Check if change exceeds threshold
      const exceedsThreshold = changePercent && Math.abs(changePercent) > this.PRICE_ALERT_THRESHOLD_PERCENT;

      // Get connection for transaction
      connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // End old price
        if (currentPrice) {
          const dayBefore = new Date(data.effective_start_date);
          dayBefore.setDate(dayBefore.getDate() - 1);

          await connection.execute(
            'UPDATE supplier_product_pricing_history SET effective_end_date = ? WHERE pricing_id = ?',
            [dayBefore, currentPrice.pricing_id]
          );
        }

        // Insert new price
        const result = await connection.execute(
          `INSERT INTO supplier_product_pricing_history
           (supplier_product_id, unit_price, cost_currency, effective_start_date, price_change_percent, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            supplierId,
            data.unit_price,
            data.cost_currency || 'CAD',
            data.effective_start_date,
            changePercent,
            data.notes || null,
            userId || null
          ]
        );

        await connection.commit();

        return {
          success: true,
          data: {
            pricing_id: (result as any)[0].insertId,
            alert: exceedsThreshold || false,
            change_percent: changePercent
          }
        };
      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      }
    } catch (error) {
      console.error('Error in SupplierProductService.addPrice:', error);
      return {
        success: false,
        error: 'Failed to add price',
        code: 'ADD_PRICE_ERROR'
      };
    } finally {
      if (connection) {
        await connection.release();
      }
    }
  }

  /**
   * Get price history for supplier product
   */
  async getPriceHistory(supplierId: number): Promise<ServiceResult<PricingHistoryRow[]>> {
    try {
      if (!supplierId || supplierId <= 0) {
        return {
          success: false,
          error: 'Valid supplier product ID is required',
          code: 'VALIDATION_ERROR'
        };
      }

      const history = await this.pricingRepository.getHistory(supplierId);
      return { success: true, data: history };
    } catch (error) {
      console.error('Error in SupplierProductService.getPriceHistory:', error);
      return {
        success: false,
        error: 'Failed to fetch price history',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get price range for archetype
   */
  async getPriceRange(archetypeId: number): Promise<ServiceResult<PriceRangeRow | null>> {
    try {
      if (!archetypeId || archetypeId <= 0) {
        return {
          success: false,
          error: 'Valid archetype ID is required',
          code: 'VALIDATION_ERROR'
        };
      }

      const range = await this.repository.getPriceRange(archetypeId);
      return { success: true, data: range };
    } catch (error) {
      console.error('Error in SupplierProductService.getPriceRange:', error);
      return {
        success: false,
        error: 'Failed to fetch price range',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get price ranges for multiple archetypes (prevent N+1)
   */
  async getPriceRanges(archetypeIds: number[]): Promise<ServiceResult<Map<number, PriceRangeRow | null>>> {
    try {
      if (!Array.isArray(archetypeIds) || archetypeIds.length === 0) {
        return {
          success: true,
          data: new Map()
        };
      }

      const ranges = new Map<number, PriceRangeRow | null>();

      // Fetch price range for each archetype
      for (const id of archetypeIds) {
        const range = await this.repository.getPriceRange(id);
        ranges.set(id, range);
      }

      return { success: true, data: ranges };
    } catch (error) {
      console.error('Error in SupplierProductService.getPriceRanges:', error);
      return {
        success: false,
        error: 'Failed to fetch price ranges',
        code: 'FETCH_ERROR'
      };
    }
  }
}
