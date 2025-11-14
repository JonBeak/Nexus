// File Clean up Finished: Nov 13, 2025
/**
 * Vinyl Inventory Service
 * Business logic layer for vinyl inventory management
 * Permission checks now handled at route level via RBAC middleware
 */

import { User } from '../../types';
import { VinylInventoryRepository } from '../../repositories/vinyl/vinylInventoryRepository';
import {
  VinylItem,
  VinylInventoryFilters,
  CreateVinylItemRequest,
  UpdateVinylItemRequest,
  MarkVinylAsUsedRequest,
  StatusChangeRequest,
  VinylInventoryServiceOptions,
  VinylResponse,
  VinylInventoryData
} from '../../types/vinyl';

export class VinylInventoryService {
  /**
   * Get vinyl inventory items with filters
   */
  static async getVinylItems(
    user: User,
    filters: VinylInventoryFilters = {}
  ): Promise<VinylResponse<VinylItem[]>> {
    try {
      const items = await VinylInventoryRepository.getVinylItems(filters);
      return { success: true, data: items };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch vinyl inventory',
        code: 'FETCH_VINYL_ERROR'
      };
    }
  }

  /**
   * Get single vinyl item by ID
   */
  static async getVinylItemById(
    user: User,
    id: number
  ): Promise<VinylResponse<VinylItem>> {
    try {
      const item = await VinylInventoryRepository.getVinylItemById(id);

      if (!item) {
        return {
          success: false,
          error: 'Vinyl item not found',
          code: 'VINYL_NOT_FOUND'
        };
      }

      return { success: true, data: item };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch vinyl item',
        code: 'FETCH_VINYL_ERROR'
      };
    }
  }

  /**
   * Create new vinyl inventory item
   */
  static async createVinylItem(
    user: User,
    data: CreateVinylItemRequest
  ): Promise<VinylResponse<{ id: number; product_id?: number }>> {
    try {
      // Validate required fields
      const validation = this.validateVinylItemData(data);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          code: 'VALIDATION_ERROR'
        };
      }

      // Prepare data for repository
      const vinylData: VinylInventoryData = {
        brand: data.brand,
        series: data.series,
        colour_number: data.colour_number || undefined,
        colour_name: data.colour_name || undefined,
        width: data.width,
        length_yards: data.length_yards,
        location: data.location || undefined,
        supplier_id: data.supplier_id || undefined,
        purchase_date: data.purchase_date ? new Date(data.purchase_date) : null,
        storage_date: data.storage_date ? new Date(data.storage_date) : new Date(),
        expiration_date: data.expiration_date ? new Date(data.expiration_date) : null,
        disposition: 'in_stock',
        storage_user: data.storage_user || user.user_id,
        created_by: user.user_id,
        updated_by: user.user_id,
        notes: data.notes || undefined
      };

      // Set automatic expiration date if not provided (2 years from storage)
      if (!vinylData.expiration_date && vinylData.storage_date) {
        const expirationDate = new Date(vinylData.storage_date);
        expirationDate.setFullYear(expirationDate.getFullYear() + 2);
        vinylData.expiration_date = expirationDate;
      }

      // Create inventory item and product atomically
      const result = await VinylInventoryRepository.createVinylItemWithProduct(vinylData, data.job_ids);

      return {
        success: true,
        data: {
          id: result.inventoryId,
          product_id: result.productId
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create vinyl item',
        code: 'CREATE_VINYL_ERROR'
      };
    }
  }

  /**
   * Update vinyl inventory item
   */
  static async updateVinylItem(
    user: User,
    id: number,
    data: UpdateVinylItemRequest
  ): Promise<VinylResponse<{ updated: boolean }>> {
    try {
      // Check if item exists
      const exists = await VinylInventoryRepository.vinylItemExists(id);
      if (!exists) {
        return {
          success: false,
          error: 'Vinyl item not found',
          code: 'VINYL_NOT_FOUND'
        };
      }

      // Validate update data
      const validation = this.validateVinylItemUpdateData(data);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          code: 'VALIDATION_ERROR'
        };
      }

      // Prepare update data
      const updateData: Partial<VinylInventoryData> = {};

      // Copy fields that are defined
      const fieldMappings = [
        'brand', 'series', 'colour_number', 'colour_name', 'width',
        'length_yards', 'location', 'supplier_id', 'disposition',
        'waste_reason', 'storage_user', 'usage_user', 'notes'
      ];

      fieldMappings.forEach(field => {
        if (data[field as keyof UpdateVinylItemRequest] !== undefined) {
          updateData[field as keyof VinylInventoryData] = data[field as keyof UpdateVinylItemRequest] as any;
        }
      });

      // Handle date fields
      if (data.purchase_date !== undefined) {
        updateData.purchase_date = data.purchase_date ? new Date(data.purchase_date) : null;
      }
      if (data.storage_date !== undefined) {
        updateData.storage_date = data.storage_date ? new Date(data.storage_date) : null;
      }
      if (data.usage_date !== undefined) {
        updateData.usage_date = data.usage_date ? new Date(data.usage_date) : null;
      }
      if (data.expiration_date !== undefined) {
        updateData.expiration_date = data.expiration_date ? new Date(data.expiration_date) : null;
      }
      if (data.return_date !== undefined) {
        updateData.return_date = data.return_date ? new Date(data.return_date) : null;
      }

      // Set updated_by
      updateData.updated_by = user.user_id;

      const updated = await VinylInventoryRepository.updateVinylItem(id, updateData);

      return {
        success: true,
        data: { updated }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update vinyl item',
        code: 'UPDATE_VINYL_ERROR'
      };
    }
  }

  /**
   * Mark vinyl as used with job associations
   */
  static async markVinylAsUsed(
    user: User,
    id: number,
    data: MarkVinylAsUsedRequest
  ): Promise<VinylResponse<{ updated: boolean }>> {
    try {
      // Check if item exists and is in stock
      const item = await VinylInventoryRepository.getVinylItemById(id);
      if (!item) {
        return {
          success: false,
          error: 'Vinyl item not found',
          code: 'VINYL_NOT_FOUND'
        };
      }

      if (item.disposition !== 'in_stock') {
        return {
          success: false,
          error: 'Can only mark in-stock items as used',
          code: 'INVALID_DISPOSITION'
        };
      }

      await VinylInventoryRepository.markVinylAsUsed(id, {
        usage_user: user.user_id,
        usage_note: data.usage_note,
        job_ids: data.job_ids
      });

      return {
        success: true,
        data: { updated: true }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to mark vinyl as used',
        code: 'MARK_USED_ERROR'
      };
    }
  }

  /**
   * Update job associations for vinyl item
   */
  static async updateJobLinks(
    user: User,
    id: number,
    jobIds: number[]
  ): Promise<VinylResponse<{ updated: boolean }>> {
    try {
      // Check if item exists
      const exists = await VinylInventoryRepository.vinylItemExists(id);
      if (!exists) {
        return {
          success: false,
          error: 'Vinyl item not found',
          code: 'VINYL_NOT_FOUND'
        };
      }

      await VinylInventoryRepository.updateJobLinks(id, jobIds);

      return {
        success: true,
        data: { updated: true }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update job associations',
        code: 'UPDATE_JOBS_ERROR'
      };
    }
  }

  /**
   * Delete vinyl inventory item
   */
  static async deleteVinylItem(
    user: User,
    id: number
  ): Promise<VinylResponse<{ deleted: boolean }>> {
    try {
      // Check if item exists
      const exists = await VinylInventoryRepository.vinylItemExists(id);
      if (!exists) {
        return {
          success: false,
          error: 'Vinyl item not found',
          code: 'VINYL_NOT_FOUND'
        };
      }

      const deleted = await VinylInventoryRepository.deleteVinylItem(id);

      return {
        success: true,
        data: { deleted }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to delete vinyl item',
        code: 'DELETE_VINYL_ERROR'
      };
    }
  }

  /**
   * Get vinyl inventory statistics
   */
  static async getVinylStats(user: User): Promise<VinylResponse<any>> {
    try {
      const stats = await VinylInventoryRepository.getVinylStats();
      return { success: true, data: stats };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch vinyl statistics',
        code: 'FETCH_STATS_ERROR'
      };
    }
  }

  /**
   * Get recent vinyl items for copying
   */
  static async getRecentVinylForCopying(
    user: User,
    limit: number = 10
  ): Promise<VinylResponse<VinylItem[]>> {
    try {
      const items = await VinylInventoryRepository.getRecentVinylForCopying(limit);
      return { success: true, data: items };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch recent vinyl items',
        code: 'FETCH_RECENT_ERROR'
      };
    }
  }

  /**
   * Handle status change (used, waste, returned)
   */
  static async changeVinylStatus(
    user: User,
    statusData: StatusChangeRequest
  ): Promise<VinylResponse<{ updated: boolean }>> {
    try {
      const updateData: UpdateVinylItemRequest = {
        disposition: statusData.disposition,
        notes: statusData.notes
      };

      if (statusData.disposition === 'waste' && statusData.waste_reason) {
        updateData.waste_reason = statusData.waste_reason;
      }

      if (statusData.status_change_date) {
        if (statusData.disposition === 'returned') {
          updateData.return_date = statusData.status_change_date;
        }
        // For waste, we could add a waste_date field if needed
      }

      return this.updateVinylItem(user, statusData.vinyl_id, updateData);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to change vinyl status',
        code: 'STATUS_CHANGE_ERROR'
      };
    }
  }

  /**
   * Validate vinyl item creation data
   */
  private static validateVinylItemData(data: CreateVinylItemRequest): {
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

    if (!data.width || data.width <= 0) {
      errors.push('Width must be greater than 0');
    }

    if (!data.length_yards || data.length_yards <= 0) {
      errors.push('Length in yards must be greater than 0');
    }

    // Validate dates if provided (non-empty strings)
    if (typeof data.purchase_date === 'string' && data.purchase_date.trim() !== '' && isNaN(new Date(data.purchase_date).getTime())) {
      errors.push('Invalid purchase date');
    }

    if (typeof data.storage_date === 'string' && data.storage_date.trim() !== '' && isNaN(new Date(data.storage_date).getTime())) {
      errors.push('Invalid storage date');
    }

    if (typeof data.expiration_date === 'string' && data.expiration_date.trim() !== '' && isNaN(new Date(data.expiration_date).getTime())) {
      errors.push('Invalid expiration date');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate vinyl item update data
   */
  private static validateVinylItemUpdateData(data: UpdateVinylItemRequest): {
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

    if (data.width !== undefined && (!data.width || data.width <= 0)) {
      errors.push('Width must be greater than 0');
    }

    if (data.length_yards !== undefined && (!data.length_yards || data.length_yards <= 0)) {
      errors.push('Length in yards must be greater than 0');
    }

    if (data.disposition !== undefined) {
      const validDispositions = ['in_stock', 'used', 'waste', 'returned', 'damaged'];
      if (!validDispositions.includes(data.disposition)) {
        errors.push('Invalid disposition value');
      }
    }

    // Validate dates if provided (treat empty strings as null/valid)
    const dateFields = ['purchase_date', 'storage_date', 'usage_date', 'expiration_date', 'return_date'];
    dateFields.forEach(field => {
      const value = data[field as keyof UpdateVinylItemRequest];
      if (value !== undefined && value !== null && value !== '' && isNaN(new Date(value as string).getTime())) {
        errors.push(`Invalid ${field.replace('_', ' ')}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}