import { api } from '../apiClient';

/**
 * Customer API
 * Manages customer records, addresses, and preferences
 */
export const customerApi = {
  /**
   * Get all customers with optional filtering
   */
  getCustomers: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    include_inactive?: boolean;
  } = {}) => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  /**
   * Create new customer
   */
  createCustomer: async (customerData: any) => {
    const response = await api.post('/customers', customerData);
    return response.data;
  },

  /**
   * Get single customer by ID
   */
  getCustomer: async (id: number) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  /**
   * Update customer
   */
  updateCustomer: async (id: number, data: any) => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  /**
   * Get customer manufacturing preferences
   */
  getManufacturingPreferences: async (id: number) => {
    const response = await api.get(`/customers/${id}/manufacturing-preferences`);
    // API interceptor already unwraps response.data from backend's { success, data }
    // So response.data contains the preferences object directly
    // Return the whole response so hooks can access response.data
    return response;
  },

  // Address management

  /**
   * Add address to customer
   */
  addAddress: async (customerId: number, addressData: any) => {
    const response = await api.post(`/customers/${customerId}/addresses`, addressData);
    return response.data;
  },

  /**
   * Update customer address
   */
  updateAddress: async (customerId: number, addressId: number, addressData: any) => {
    const response = await api.put(`/customers/${customerId}/addresses/${addressId}`, addressData);
    return response.data;
  },

  /**
   * Delete customer address
   */
  deleteAddress: async (customerId: number, addressId: number) => {
    const response = await api.delete(`/customers/${customerId}/addresses/${addressId}`);
    return response.data;
  },

  /**
   * Get all addresses (including inactive)
   */
  getAddresses: async (customerId: number, includeInactive: boolean = false) => {
    const params = includeInactive ? { include_inactive: 'true' } : {};
    const response = await api.get(`/customers/${customerId}/addresses`, { params });
    return response.data;
  },

  /**
   * Reactivate address
   */
  reactivateAddress: async (customerId: number, addressId: number) => {
    const response = await api.post(`/customers/${customerId}/addresses/${addressId}/reactivate`);
    return response.data;
  },

  /**
   * Deactivate customer
   */
  deactivateCustomer: async (customerId: number) => {
    const response = await api.post(`/customers/${customerId}/deactivate`);
    return response.data;
  },

  /**
   * Reactivate customer
   */
  reactivateCustomer: async (customerId: number) => {
    const response = await api.post(`/customers/${customerId}/reactivate`);
    return response.data;
  },

  /**
   * Make an address primary
   */
  makePrimaryAddress: async (customerId: number, addressId: number | string) => {
    const response = await api.post(`/customers/${customerId}/addresses/${addressId}/make-primary`);
    return response.data;
  },

  /**
   * Get LED types
   */
  getLedTypes: async () => {
    const response = await api.get('/customers/led-types');
    return response.data;
  },

  /**
   * Get Power Supply types
   */
  getPowerSupplyTypes: async () => {
    const response = await api.get('/customers/power-supply-types');
    return response.data;
  },
};
