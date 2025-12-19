// Phase 4.a: Updated for extended supplier fields
// Updated: 2025-12-18
import { SupplierRepository, SupplierRow, SupplierStatsRow, SupplierSearchParams } from '../../repositories/supplyChain/supplierRepository';
import { isValidUrl } from '../../utils/validation';
import { ServiceResult } from '../../types/serviceResults';

export interface CreateSupplierData {
  name: string;
  website?: string;
  notes?: string;
  payment_terms?: string;
  default_lead_days?: number;
  account_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
}

export interface UpdateSupplierData {
  name?: string;
  website?: string;
  notes?: string;
  payment_terms?: string;
  default_lead_days?: number;
  account_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
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

      // Validate website format if provided
      if (data.website && !isValidUrl(data.website)) {
        return {
          success: false,
          error: 'Invalid website URL format',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate default_lead_days if provided
      if (data.default_lead_days !== undefined && data.default_lead_days < 0) {
        return {
          success: false,
          error: 'Lead days cannot be negative',
          code: 'VALIDATION_ERROR'
        };
      }

      const supplierId = await this.repository.create({
        name: data.name.trim(),
        website: data.website?.trim(),
        notes: data.notes?.trim(),
        payment_terms: data.payment_terms?.trim(),
        default_lead_days: data.default_lead_days,
        account_number: data.account_number?.trim(),
        address_line1: data.address_line1?.trim(),
        address_line2: data.address_line2?.trim(),
        city: data.city?.trim(),
        province: data.province?.trim(),
        postal_code: data.postal_code?.trim(),
        country: data.country?.trim(),
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

      // Validate website format if provided
      if (updates.website && !isValidUrl(updates.website)) {
        return {
          success: false,
          error: 'Invalid website URL format',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate default_lead_days if provided
      if (updates.default_lead_days !== undefined && updates.default_lead_days < 0) {
        return {
          success: false,
          error: 'Lead days cannot be negative',
          code: 'VALIDATION_ERROR'
        };
      }

      // Trim string fields
      const cleanedUpdates: any = { updated_by: userId };

      const stringFields = [
        'name', 'website', 'notes', 'payment_terms', 'account_number',
        'address_line1', 'address_line2', 'city', 'province', 'postal_code', 'country'
      ];

      for (const field of stringFields) {
        if (updates[field as keyof UpdateSupplierData] !== undefined) {
          const value = updates[field as keyof UpdateSupplierData];
          cleanedUpdates[field] = typeof value === 'string' ? value.trim() : value;
        }
      }

      // Handle non-string fields
      if (updates.default_lead_days !== undefined) {
        cleanedUpdates.default_lead_days = updates.default_lead_days;
      }
      if (updates.is_active !== undefined) {
        cleanedUpdates.is_active = updates.is_active;
      }

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
