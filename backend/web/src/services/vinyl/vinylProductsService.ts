/**
 * Vinyl Products Service
 * Business logic layer for vinyl products catalog management
 */

import { VinylPermissions } from '../../utils/vinyl/permissions';
import { User } from '../../types';
import { VinylProductsRepository } from '../../repositories/vinyl/vinylProductsRepository';
import {
  VinylProduct,
  VinylProductsFilters,
  CreateVinylProductRequest,
  UpdateVinylProductRequest,
  VinylProductServiceOptions,
  VinylResponse,
  VinylProductData
} from '../../types/vinyl';

export class VinylProductsService {
  /**
   * Get vinyl products with filters
   */
  static async getVinylProducts(
    user: User,
    filters: VinylProductsFilters = {},
    options: VinylProductServiceOptions = {}
  ): Promise<VinylResponse<VinylProduct[]>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        VinylPermissions.requirePermission(
          user,
          VinylPermissions.canViewVinylProducts,
          'view vinyl products'
        );
      }

      const products = await VinylProductsRepository.getVinylProducts(filters);
      return { success: true, data: products };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch vinyl products',
        code: 'FETCH_PRODUCTS_ERROR'
      };
    }
  }

  /**
   * Get single vinyl product by ID
   */
  static async getVinylProductById(
    user: User,
    productId: number,
    options: VinylProductServiceOptions = {}
  ): Promise<VinylResponse<VinylProduct>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        VinylPermissions.requirePermission(
          user,
          VinylPermissions.canViewVinylProducts,
          'view vinyl products'
        );
      }

      const product = await VinylProductsRepository.getVinylProductById(productId);

      if (!product) {
        return {
          success: false,
          error: 'Vinyl product not found',
          code: 'PRODUCT_NOT_FOUND'
        };
      }

      return { success: true, data: product };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch vinyl product',
        code: 'FETCH_PRODUCT_ERROR'
      };
    }
  }

  /**
   * Create new vinyl product
   */
  static async createVinylProduct(
    user: User,
    data: CreateVinylProductRequest,
    options: VinylProductServiceOptions = {}
  ): Promise<VinylResponse<{ product_id: number }>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        VinylPermissions.requirePermission(
          user,
          VinylPermissions.canManageVinylProducts,
          'create vinyl products'
        );
      }

      // Validate required fields
      const validation = this.validateVinylProductData(data);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          code: 'VALIDATION_ERROR'
        };
      }

      // Check for duplicate product
      const existingProducts = await VinylProductsRepository.getVinylProducts({
        brand: data.brand,
        series: data.series,
        is_active: true
      });

      const duplicate = existingProducts.find(p =>
        p.brand === data.brand &&
        p.series === data.series &&
        p.colour_number === (data.colour_number || null) &&
        p.colour_name === (data.colour_name || null)
      );

      if (duplicate) {
        return {
          success: false,
          error: 'A product with this brand, series, and colour combination already exists',
          code: 'DUPLICATE_PRODUCT'
        };
      }

      // Prepare data for repository
      const productData: VinylProductData = {
        brand: data.brand,
        series: data.series,
        colour_number: data.colour_number || undefined,
        colour_name: data.colour_name || undefined,
        default_width: data.default_width || undefined,
        is_active: true,
        created_by: user.user_id,
        updated_by: user.user_id
      };

      const productId = await VinylProductsRepository.createVinylProduct(
        productData,
        data.supplier_ids
      );

      return {
        success: true,
        data: { product_id: productId }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create vinyl product',
        code: 'CREATE_PRODUCT_ERROR'
      };
    }
  }

  /**
   * Update vinyl product
   */
  static async updateVinylProduct(
    user: User,
    productId: number,
    data: UpdateVinylProductRequest,
    options: VinylProductServiceOptions = {}
  ): Promise<VinylResponse<{ updated: boolean }>> {
    try {
      // Check permissions
      if (options.validatePermissions !== false) {
        VinylPermissions.requirePermission(
          user,
          VinylPermissions.canManageVinylProducts,
          'update vinyl products'
        );
      }

      // Check if product exists
      const exists = await VinylProductsRepository.vinylProductExists(productId);
      if (!exists) {
        return {
          success: false,
          error: 'Vinyl product not found',
          code: 'PRODUCT_NOT_FOUND'
        };
      }

      // Validate update data
      const validation = this.validateVinylProductUpdateData(data);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          code: 'VALIDATION_ERROR'
        };
      }

      // Check for duplicate if brand/series/colour is being changed
      if (data.brand || data.series || data.colour_number !== undefined || data.colour_name !== undefined) {
        const currentProduct = await VinylProductsRepository.getVinylProductById(productId);
        if (currentProduct) {
          const newBrand = data.brand || currentProduct.brand;
          const newSeries = data.series || currentProduct.series;
          const newColourNumber = data.colour_number !== undefined ? data.colour_number : currentProduct.colour_number;
          const newColourName = data.colour_name !== undefined ? data.colour_name : currentProduct.colour_name;

          const existingProducts = await VinylProductsRepository.getVinylProducts({
            brand: newBrand,
            series: newSeries,
            is_active: true
          });

          const duplicate = existingProducts.find(p =>
            p.product_id !== productId &&
            p.brand === newBrand &&
            p.series === newSeries &&
            p.colour_number === (newColourNumber || null) &&
            p.colour_name === (newColourName || null)
          );

          if (duplicate) {
            return {
              success: false,
              error: 'A product with this brand, series, and colour combination already exists',
              code: 'DUPLICATE_PRODUCT'
            };
          }
        }
      }

      // Prepare update data
      const updateData: Partial<VinylProductData> = {};

      // Copy fields that are defined
      const fieldMappings = [
        'brand', 'series', 'colour_number', 'colour_name',
        'default_width', 'is_active'
      ];

      fieldMappings.forEach(field => {
        if (data[field as keyof UpdateVinylProductRequest] !== undefined) {
          updateData[field as keyof VinylProductData] = data[field as keyof UpdateVinylProductRequest] as any;
        }
      });

      // Set updated_by
      updateData.updated_by = user.user_id;

      const updated = await VinylProductsRepository.updateVinylProduct(
        productId,
        updateData,
        data.supplier_ids
      );

      return {
        success: true,
        data: { updated }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update vinyl product',
        code: 'UPDATE_PRODUCT_ERROR'
      };
    }
  }

  /**
   * Delete vinyl product (soft delete - mark as inactive)
   */
  static async deleteVinylProduct(
    user: User,
    productId: number
  ): Promise<VinylResponse<{ deleted: boolean }>> {
    try {
      // Check permissions
      VinylPermissions.requirePermission(
        user,
        VinylPermissions.canManageVinylProducts,
        'delete vinyl products'
      );

      // Check if product exists
      const exists = await VinylProductsRepository.vinylProductExists(productId);
      if (!exists) {
        return {
          success: false,
          error: 'Vinyl product not found',
          code: 'PRODUCT_NOT_FOUND'
        };
      }

      // Check if product has inventory items
      const product = await VinylProductsRepository.getVinylProductById(productId);
      if (product && (product.inventory_count ?? 0) > 0) {
        // Soft delete only if there are inventory items
        const deleted = await VinylProductsRepository.deleteVinylProduct(productId);
        return {
          success: true,
          data: { deleted }
        };
      } else {
        // Hard delete if no inventory items
        const deleted = await VinylProductsRepository.hardDeleteVinylProduct(productId);
        return {
          success: true,
          data: { deleted }
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to delete vinyl product',
        code: 'DELETE_PRODUCT_ERROR'
      };
    }
  }

  /**
   * Get vinyl product statistics
   */
  static async getVinylProductStats(user: User): Promise<VinylResponse<any>> {
    try {
      // Check permissions
      VinylPermissions.requirePermission(
        user,
        VinylPermissions.canViewVinylProducts,
        'view vinyl product statistics'
      );

      const stats = await VinylProductsRepository.getVinylProductStats();
      return { success: true, data: stats };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch vinyl product statistics',
        code: 'FETCH_STATS_ERROR'
      };
    }
  }

  /**
   * Get autofill suggestions for product forms
   */
  static async getAutofillSuggestions(user: User): Promise<VinylResponse<any>> {
    try {
      // Check permissions
      VinylPermissions.requirePermission(
        user,
        VinylPermissions.canViewVinylProducts,
        'view vinyl products'
      );

      const suggestions = await VinylProductsRepository.getAutofillSuggestions();
      return { success: true, data: suggestions };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch autofill suggestions',
        code: 'FETCH_SUGGESTIONS_ERROR'
      };
    }
  }

  /**
   * Get active products only
   */
  static async getActiveProducts(user: User): Promise<VinylResponse<VinylProduct[]>> {
    return this.getVinylProducts(user, { is_active: true });
  }

  /**
   * Get products by brand
   */
  static async getProductsByBrand(
    user: User,
    brand: string
  ): Promise<VinylResponse<VinylProduct[]>> {
    return this.getVinylProducts(user, { brand });
  }

  /**
   * Search products
   */
  static async searchProducts(
    user: User,
    searchTerm: string,
    options: { activeOnly?: boolean } = {}
  ): Promise<VinylResponse<VinylProduct[]>> {
    const filters: VinylProductsFilters = {
      search: searchTerm
    };

    if (options.activeOnly) {
      filters.is_active = true;
    }

    return this.getVinylProducts(user, filters);
  }

  /**
   * Toggle product active status
   */
  static async toggleProductStatus(
    user: User,
    productId: number
  ): Promise<VinylResponse<{ updated: boolean; is_active: boolean }>> {
    try {
      // Get current product
      const productResponse = await this.getVinylProductById(user, productId);
      if (!productResponse.success) {
        return productResponse as any;
      }

      const product = productResponse.data;
      const newStatus = !product.is_active;

      // Update status
      const updateResponse = await this.updateVinylProduct(user, productId, {
        is_active: newStatus
      });

      if (!updateResponse.success) {
        return updateResponse as any;
      }

      return {
        success: true,
        data: {
          updated: true,
          is_active: newStatus
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to toggle product status',
        code: 'TOGGLE_STATUS_ERROR'
      };
    }
  }

  /**
   * Validate vinyl product creation data
   */
  private static validateVinylProductData(data: CreateVinylProductRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.brand || data.brand.trim() === '') {
      errors.push('Brand is required');
    }

    if (!data.series || data.series.trim() === '') {
      errors.push('Series is required');
    }

    // At least one of colour_number or colour_name should be provided
    if (!data.colour_number && !data.colour_name) {
      errors.push('Either colour number or colour name must be provided');
    }

    if (data.default_width !== undefined && data.default_width <= 0) {
      errors.push('Default width must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate vinyl product update data
   */
  private static validateVinylProductUpdateData(data: UpdateVinylProductRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (data.brand !== undefined && (!data.brand || data.brand.trim() === '')) {
      errors.push('Brand cannot be empty');
    }

    if (data.series !== undefined && (!data.series || data.series.trim() === '')) {
      errors.push('Series cannot be empty');
    }

    if (data.default_width !== undefined && data.default_width <= 0) {
      errors.push('Default width must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Bulk operations for products
   */
  static async bulkUpdateProducts(
    user: User,
    updates: { product_id: number; data: UpdateVinylProductRequest }[]
  ): Promise<VinylResponse<{ updated: number; errors: any[] }>> {
    try {
      // Check permissions
      VinylPermissions.requirePermission(
        user,
        VinylPermissions.canManageVinylProducts,
        'bulk update vinyl products'
      );

      let updatedCount = 0;
      const errors: any[] = [];

      for (const update of updates) {
        try {
          const result = await this.updateVinylProduct(
            user,
            update.product_id,
            update.data,
            { validatePermissions: false } // Already checked above
          );

          if (result.success) {
            updatedCount++;
          } else {
            errors.push({
              product_id: update.product_id,
              error: result.error
            });
          }
        } catch (error: any) {
          errors.push({
            product_id: update.product_id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        data: {
          updated: updatedCount,
          errors
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to bulk update products',
        code: 'BULK_UPDATE_ERROR'
      };
    }
  }

  /**
   * Sync product from inventory item
   * Used when inventory items are created and need corresponding products
   */
  static async syncProductFromInventory(
    user: User,
    inventoryData: {
      brand: string;
      series: string;
      colour_number?: string;
      colour_name?: string;
      width?: number;
    }
  ): Promise<VinylResponse<{ product_id: number; created: boolean }>> {
    try {
      const productId = await VinylProductsRepository.findOrCreateProductFromInventory({
        ...inventoryData,
        created_by: user.user_id
      });

      // Check if it was newly created by comparing with existing products
      const existingProducts = await VinylProductsRepository.getVinylProducts({
        brand: inventoryData.brand,
        series: inventoryData.series
      });

      const wasCreated = existingProducts.some(p => p.product_id === productId);

      return {
        success: true,
        data: {
          product_id: productId,
          created: !wasCreated
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to sync product from inventory',
        code: 'SYNC_PRODUCT_ERROR'
      };
    }
  }
}