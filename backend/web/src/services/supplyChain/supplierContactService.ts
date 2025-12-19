// Phase 4.a: Supplier Contacts Service
// Created: 2025-12-18
import {
  SupplierContactRepository,
  SupplierContactRow,
  CreateContactData,
  UpdateContactData,
  ContactRole
} from '../../repositories/supplyChain/supplierContactRepository';
import { isValidEmail } from '../../utils/validation';
import { ServiceResult } from '../../types/serviceResults';

export class SupplierContactService {
  private repository: SupplierContactRepository;

  constructor() {
    this.repository = new SupplierContactRepository();
  }

  /**
   * Get all contacts for a supplier
   */
  async getContactsBySupplier(
    supplierId: number,
    activeOnly: boolean = true
  ): Promise<ServiceResult<SupplierContactRow[]>> {
    try {
      // Verify supplier exists
      const supplierExists = await this.repository.supplierExists(supplierId);
      if (!supplierExists) {
        return {
          success: false,
          error: 'Supplier not found',
          code: 'NOT_FOUND'
        };
      }

      const contacts = await this.repository.findBySupplier(supplierId, activeOnly);
      return { success: true, data: contacts };
    } catch (error) {
      console.error('Error in SupplierContactService.getContactsBySupplier:', error);
      return {
        success: false,
        error: 'Failed to fetch contacts',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get single contact by ID
   */
  async getContactById(contactId: number): Promise<ServiceResult<SupplierContactRow>> {
    try {
      const contact = await this.repository.findById(contactId);

      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
          code: 'NOT_FOUND'
        };
      }

      return { success: true, data: contact };
    } catch (error) {
      console.error('Error in SupplierContactService.getContactById:', error);
      return {
        success: false,
        error: 'Failed to fetch contact',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Create new contact
   */
  async createContact(data: {
    supplier_id: number;
    name: string;
    email?: string;
    phone?: string;
    role?: ContactRole;
    is_primary?: boolean;
    notes?: string;
  }): Promise<ServiceResult<number>> {
    try {
      // Validate required fields
      if (!data.name || data.name.trim().length === 0) {
        return {
          success: false,
          error: 'Contact name is required',
          code: 'VALIDATION_ERROR'
        };
      }

      // Verify supplier exists
      const supplierExists = await this.repository.supplierExists(data.supplier_id);
      if (!supplierExists) {
        return {
          success: false,
          error: 'Supplier not found',
          code: 'NOT_FOUND'
        };
      }

      // Validate email format if provided
      if (data.email && !isValidEmail(data.email)) {
        return {
          success: false,
          error: 'Invalid email format',
          code: 'VALIDATION_ERROR'
        };
      }

      // If this is the primary contact, clear other primary flags first
      if (data.is_primary) {
        await this.repository.clearPrimaryFlag(data.supplier_id);
      }

      const contactId = await this.repository.create({
        supplier_id: data.supplier_id,
        name: data.name.trim(),
        email: data.email?.trim(),
        phone: data.phone?.trim(),
        role: data.role,
        is_primary: data.is_primary,
        notes: data.notes?.trim()
      });

      return { success: true, data: contactId };
    } catch (error) {
      console.error('Error in SupplierContactService.createContact:', error);
      return {
        success: false,
        error: 'Failed to create contact',
        code: 'CREATE_ERROR'
      };
    }
  }

  /**
   * Update contact
   */
  async updateContact(
    contactId: number,
    updates: {
      name?: string;
      email?: string;
      phone?: string;
      role?: ContactRole;
      is_primary?: boolean;
      notes?: string;
      is_active?: boolean;
    }
  ): Promise<ServiceResult<void>> {
    try {
      // Verify contact exists
      const contact = await this.repository.findById(contactId);
      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
          code: 'NOT_FOUND'
        };
      }

      // Validate name if provided
      if (updates.name !== undefined && updates.name.trim().length === 0) {
        return {
          success: false,
          error: 'Contact name cannot be empty',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate email format if provided
      if (updates.email && !isValidEmail(updates.email)) {
        return {
          success: false,
          error: 'Invalid email format',
          code: 'VALIDATION_ERROR'
        };
      }

      // If setting as primary, clear other primary flags first
      if (updates.is_primary) {
        await this.repository.clearPrimaryFlag(contact.supplier_id);
      }

      // Trim string fields
      const cleanedUpdates: UpdateContactData = {};

      if (updates.name !== undefined) cleanedUpdates.name = updates.name.trim();
      if (updates.email !== undefined) cleanedUpdates.email = updates.email.trim();
      if (updates.phone !== undefined) cleanedUpdates.phone = updates.phone.trim();
      if (updates.notes !== undefined) cleanedUpdates.notes = updates.notes.trim();
      if (updates.role !== undefined) cleanedUpdates.role = updates.role;
      if (updates.is_primary !== undefined) cleanedUpdates.is_primary = updates.is_primary;
      if (updates.is_active !== undefined) cleanedUpdates.is_active = updates.is_active;

      await this.repository.update(contactId, cleanedUpdates);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierContactService.updateContact:', error);
      return {
        success: false,
        error: 'Failed to update contact',
        code: 'UPDATE_ERROR'
      };
    }
  }

  /**
   * Delete contact
   */
  async deleteContact(contactId: number): Promise<ServiceResult<{ message: string }>> {
    try {
      // Verify contact exists
      const contact = await this.repository.findById(contactId);
      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
          code: 'NOT_FOUND'
        };
      }

      // Hard delete - contacts don't have dependencies
      await this.repository.hardDelete(contactId);

      return {
        success: true,
        data: { message: 'Contact deleted successfully' }
      };
    } catch (error) {
      console.error('Error in SupplierContactService.deleteContact:', error);
      return {
        success: false,
        error: 'Failed to delete contact',
        code: 'DELETE_ERROR'
      };
    }
  }

  /**
   * Set a contact as primary (and unset others)
   */
  async setPrimaryContact(
    contactId: number
  ): Promise<ServiceResult<void>> {
    try {
      // Verify contact exists
      const contact = await this.repository.findById(contactId);
      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
          code: 'NOT_FOUND'
        };
      }

      // Clear all primary flags for this supplier
      await this.repository.clearPrimaryFlag(contact.supplier_id);

      // Set this contact as primary
      await this.repository.update(contactId, { is_primary: true });

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in SupplierContactService.setPrimaryContact:', error);
      return {
        success: false,
        error: 'Failed to set primary contact',
        code: 'UPDATE_ERROR'
      };
    }
  }
}
