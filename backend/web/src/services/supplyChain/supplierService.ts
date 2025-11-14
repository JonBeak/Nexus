// File Clean up Finished: Nov 14, 2025
import { SupplierRepository, SupplierRow, SupplierStatsRow, SupplierSearchParams } from '../../repositories/supplyChain/supplierRepository';
import { isValidEmail } from '../../utils/validation';

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
  async getSuppliers(params: SupplierSearchParams): Promise<SupplierRow[]> {
    return await this.repository.findAll(params);
  }

  /**
   * Get single supplier by ID
   */
  async getSupplierById(id: number): Promise<SupplierRow> {
    const supplier = await this.repository.findById(id);

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    return supplier;
  }

  /**
   * Create new supplier
   */
  async createSupplier(data: CreateSupplierData, userId: number): Promise<number> {
    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Supplier name is required');
    }

    // Validate email format if provided
    if (data.contact_email && !isValidEmail(data.contact_email)) {
      throw new Error('Invalid email format');
    }

    // Validate website format if provided
    if (data.website && !this.isValidUrl(data.website)) {
      throw new Error('Invalid website URL format');
    }

    const supplierId = await this.repository.create({
      name: data.name.trim(),
      contact_email: data.contact_email?.trim(),
      contact_phone: data.contact_phone?.trim(),
      website: data.website?.trim(),
      notes: data.notes?.trim(),
      created_by: userId
    });

    return supplierId;
  }

  /**
   * Update supplier
   */
  async updateSupplier(id: number, updates: UpdateSupplierData, userId: number): Promise<void> {
    // Verify supplier exists
    await this.getSupplierById(id);

    // Validate name if provided
    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new Error('Supplier name cannot be empty');
    }

    // Validate email format if provided
    if (updates.contact_email && !isValidEmail(updates.contact_email)) {
      throw new Error('Invalid email format');
    }

    // Validate website format if provided
    if (updates.website && !this.isValidUrl(updates.website)) {
      throw new Error('Invalid website URL format');
    }

    // Trim string fields
    const cleanedUpdates: any = { ...updates, updated_by: userId };
    if (cleanedUpdates.name) cleanedUpdates.name = cleanedUpdates.name.trim();
    if (cleanedUpdates.contact_email) cleanedUpdates.contact_email = cleanedUpdates.contact_email.trim();
    if (cleanedUpdates.contact_phone) cleanedUpdates.contact_phone = cleanedUpdates.contact_phone.trim();
    if (cleanedUpdates.website) cleanedUpdates.website = cleanedUpdates.website.trim();
    if (cleanedUpdates.notes) cleanedUpdates.notes = cleanedUpdates.notes.trim();

    await this.repository.update(id, cleanedUpdates);
  }

  /**
   * Delete supplier (soft or hard delete based on usage)
   */
  async deleteSupplier(id: number, userId: number): Promise<{ message: string; wasHardDelete: boolean }> {
    // Verify supplier exists
    await this.getSupplierById(id);

    // Check if supplier is in use
    const productCount = await this.repository.getProductCount(id);

    if (productCount > 0) {
      // Soft delete if in use
      await this.repository.softDelete(id, userId);
      return {
        message: 'Supplier deactivated successfully (products exist)',
        wasHardDelete: false
      };
    } else {
      // Hard delete if not in use
      await this.repository.hardDelete(id);
      return {
        message: 'Supplier deleted successfully',
        wasHardDelete: true
      };
    }
  }

  /**
   * Get supplier statistics
   */
  async getStatistics(): Promise<SupplierStatsRow> {
    return await this.repository.getStatistics();
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  }
}
