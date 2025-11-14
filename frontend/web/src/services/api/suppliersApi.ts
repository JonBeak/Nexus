import { api } from '../apiClient';

/**
 * Suppliers API
 * Manages supplier records and information
 */
export const suppliersApi = {
  /**
   * Get all suppliers
   */
  getSuppliers: async (params: {
    search?: string;
    active_only?: boolean;
  } = {}) => {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  /**
   * Get single supplier
   */
  getSupplier: async (id: number) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  /**
   * Create new supplier
   */
  createSupplier: async (supplierData: any) => {
    const response = await api.post('/suppliers', supplierData);
    return response.data;
  },

  /**
   * Update supplier
   */
  updateSupplier: async (id: number, updates: any) => {
    const response = await api.put(`/suppliers/${id}`, updates);
    return response.data;
  },

  /**
   * Delete supplier
   */
  deleteSupplier: async (id: number) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },

  /**
   * Get supplier statistics
   */
  getSupplierStats: async () => {
    const response = await api.get('/suppliers/stats/summary');
    return response.data;
  },
};
