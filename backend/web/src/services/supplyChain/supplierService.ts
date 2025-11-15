// File Clean up Finished: Nov 14, 2025
// Additional cleanup: 2025-11-15
// - Migrated to centralized isValidUrl() from utils/validation.ts
import { SupplierRepository, SupplierRow, SupplierStatsRow, SupplierSearchParams } from '../../repositories/supplyChain/supplierRepository';
import { isValidEmail, isValidUrl } from '../../utils/validation';
import { ServiceResult } from '../../types/serviceResults';

export interface CreateSupplierData {
  name: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  notes?: string;
}

export interface UpdateSupplierData {
  name?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  notes?: string;
  is_active?: boolean;
}

export class SupplierService {
  private repository: SupplierRepository;

  constructor() {
    this.repository = new SupplierRepository();
  }

  /**
   * Get all suppliers with optional filtering
   */
  async getSuppliers(params: SupplierSearchParams): Promise<ServiceResult<SupplierRow[]>> {
    try {
      const suppliers = await this.repository.findAll(params);
      return { success: true, data: suppliers };
    } catch (error) {
      console.error('Error in SupplierService.getSuppliers:', error);
      return {
        success: false,
        error: 'Failed to fetch suppliers',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get single supplier by ID
   */
  async getSupplierById(id: number): Promise<ServiceResult<SupplierRow>> {
    try {
      const supplier = await this.repository.findById(id);

      if (!supplier) {
        return {
          success: false,
          error: 'Supplier not found',
          code: 'NOT_FOUND'
        };
      }

      return { success: true, data: supplier };
    } catch (error) {
      console.error('Error in SupplierService.getSupplierById:', error);
      return {
        success: false,
        error: 'Failed to fetch supplier',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Create new supplier
   */
  async createSupplier(data: CreateSupplierData, userId: number): Promise<ServiceResult<number>> {
    try {
      // Validate required fields
      if (!data.name || data.name.trim().length === 0) {
        return {
          success: false,
          error: 'Supplier name is required',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate email format if provided
      if (data.contact_email && !isValidEmail(data.contact_email)) {
        return {
          success: false,
          error: 'Invalid email format',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate website format if provided
      if (data.website && !isValidUrl(data.website)) {
        return {
          success: false,
          error: 'Invalid website URL format',
          code: 'VALIDATION_ERROR'
        };
      }

      const supplierId = await this.repository.create({
        name: data.name.trim(),
        contact_email: data.contact_email?.trim(),
        contact_phone: data.contact_phone?.trim(),
        website: data.website?.trim(),
        notes: data.notes?.trim(),
        created_by: userId
      });

      return { success: true, data: supplierId };
    } catch (error) {
      console.error('Error in SupplierService.createSupplier:', error);
      return {
        success: false,
        error: 'Failed to create supplier',
        code: 'CREATE_ERROR'
      };
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(id: number, updates: UpdateSupplierData, userId: number): Promise<ServiceResult<void>> {
    try {
      // Verify supplier exists
      const supplierResult = await this.getSupplierById(id);
      if (!supplierResult.success) {
        return supplierResult as ServiceResult<void>;
      }

      // Validate name if provided
      if (updates.name !== undefined && updates.name.trim().length === 0) {
        return {
          success: false,
          error: 'Supplier name cannot be empty',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate email format if provided
      if (updates.contact_email && !isValidEmail(updates.contact_email)) {
        return {
          success: false,
          error: 'Invalid email format',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate website format if provided
      if (updates.website && !isValidUrl(updates.website)) {
        return {
          success: false,
          error: 'Invalid website URL format',
          code: 'VALIDATION_ERROR'
        };
      }

      // Trim string fields
      const cleanedUpdates: any = { ...updates, updated_by: userId };
      if (cleanedUpdates.name) cleanedUpdates.name = cleanedUpdates.name.trim();
      if (cleanedUpdates.contact_email) cleanedUpdates.contact_email = cleanedUpdates.contact_email.trim();
      if (cleanedUpdates.contact_phone) cleanedUpdates.contact_phone = cleanedUpdates.contact_phone.trim();
      if (cleanedUpdates.website) cleanedUpdates.website = cleanedUpdates.website.trim();
      if (cleanedUpdates.notes) cleanedUpdates.notes = cleanedUpdates.notes.trim();

      await this.repository.update(id, cleanedUpdates);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierService.updateSupplier:', error);
      return {
        success: false,
        error: 'Failed to update supplier',
        code: 'UPDATE_ERROR'
      };
    }
  }

  /**
   * Delete supplier (soft or hard delete based on usage)
   */
  async deleteSupplier(id: number, userId: number): Promise<ServiceResult<{ message: string; wasHardDelete: boolean }>> {
    try {
      // Verify supplier exists
      const supplierResult = await this.getSupplierById(id);
      if (!supplierResult.success) {
        return supplierResult as ServiceResult<{ message: string; wasHardDelete: boolean }>;
      }

      // Check if supplier is in use
      const productCount = await this.repository.getProductCount(id);

      if (productCount > 0) {
        // Soft delete if in use
        await this.repository.softDelete(id, userId);
        return {
          success: true,
          data: {
            message: 'Supplier deactivated successfully (products exist)',
            wasHardDelete: false
          }
        };
      } else {
        // Hard delete if not in use
        await this.repository.hardDelete(id);
        return {
          success: true,
          data: {
            message: 'Supplier deleted successfully',
            wasHardDelete: true
          }
        };
      }
    } catch (error) {
      console.error('Error in SupplierService.deleteSupplier:', error);
      return {
        success: false,
        error: 'Failed to delete supplier',
        code: 'DELETE_ERROR'
      };
    }
  }

  /**
   * Get supplier statistics
   */
  async getStatistics(): Promise<ServiceResult<SupplierStatsRow>> {
    try {
      const stats = await this.repository.getStatistics();
      return { success: true, data: stats };
    } catch (error) {
      console.error('Error in SupplierService.getStatistics:', error);
      return {
        success: false,
        error: 'Failed to fetch supplier statistics',
        code: 'FETCH_ERROR'
      };
    }
  }
}
