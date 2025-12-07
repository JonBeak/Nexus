// File Clean up Finished: 2025-11-25
import { api } from '../apiClient';

/**
 * Supplier Types
 */
export interface Supplier {
  supplier_id: number;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  supplier_type: 'general' | 'vinyl' | 'both';
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface SupplierCreate {
  name: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  notes?: string;
}

export interface SupplierUpdate {
  name?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  notes?: string;
  is_active?: boolean;
}

export interface SupplierStats {
  total_suppliers: number;
  active_suppliers: number;
  suppliers_with_email: number;
  suppliers_with_website: number;
}

export interface SupplierSearchParams {
  search?: string;
  active_only?: boolean;
}

/**
 * Suppliers API
 * Manages supplier records and information
 */
export const suppliersApi = {
  /**
   * Get all suppliers
   */
  getSuppliers: async (params: SupplierSearchParams = {}): Promise<Supplier[]> => {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  /**
   * Get single supplier
   */
  getSupplier: async (id: number): Promise<Supplier> => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  /**
   * Create new supplier
   */
  createSupplier: async (supplierData: SupplierCreate): Promise<{ message: string; supplier_id: number }> => {
    const response = await api.post('/suppliers', supplierData);
    return response.data;
  },

  /**
   * Update supplier
   */
  updateSupplier: async (id: number, updates: SupplierUpdate): Promise<{ message: string }> => {
    const response = await api.put(`/suppliers/${id}`, updates);
    return response.data;
  },

  /**
   * Delete supplier
   */
  deleteSupplier: async (id: number): Promise<{ message: string; wasHardDelete: boolean }> => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },

  /**
   * Get supplier statistics
   */
  getSupplierStats: async (): Promise<SupplierStats> => {
    const response = await api.get('/suppliers/stats/summary');
    return response.data;
  },
};
