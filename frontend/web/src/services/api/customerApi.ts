// File Clean up Finished: 2026-01-12
import { api } from '../apiClient';
import { Customer, Address } from '../../types';

/**
 * Data for creating a new customer
 */
export interface CustomerCreateData {
  company_name: string;
  contact_first_name?: string;
  contact_last_name?: string;
  email?: string;
  phone?: string;
  quickbooks_name?: string;
  cash_yes_or_no?: boolean;
  payment_terms?: string;
  discount?: number;
  default_turnaround?: number;
  comments?: string;
  special_instructions?: string;
  // Manufacturing preferences
  leds_yes_or_no?: boolean;
  led_id?: number;
  wire_length?: number;
  powersupply_yes_or_no?: boolean;
  power_supply_id?: number;
  ul_yes_or_no?: boolean;
  drain_holes_yes_or_no?: boolean;
  pattern_yes_or_no?: boolean;
  pattern_type?: string;
  wiring_diagram_yes_or_no?: boolean;
  wiring_diagram_type?: string;
  plug_n_play_yes_or_no?: boolean;
  shipping_yes_or_no?: boolean;
  shipping_multiplier?: number;
  shipping_flat?: number;
  po_required?: boolean;
}

/**
 * Manufacturing preferences returned from API
 * Uses pref_* prefix as returned by backend
 */
export interface ManufacturingPreferences {
  pref_customer_id: number;
  pref_leds_enabled: boolean;
  pref_led_id: number | null;
  pref_led_product_code: string | null;
  pref_led_brand: string | null;
  pref_led_colour: string | null;
  pref_led_watts: number | null;
  pref_wire_length: number | null;
  pref_power_supply_required: boolean;
  pref_power_supply_id: number | null;
  pref_power_supply_type: string | null;
  pref_power_supply_watts: number | null;
  pref_power_supply_volts: number | null;
  pref_power_supply_is_ul_listed: boolean;
  pref_ul_required: boolean;
  pref_drain_holes_required: boolean | null;
  pref_pattern_required: boolean | null;
  pref_pattern_type: string | null;
  pref_wiring_diagram_required: boolean | null;
  pref_wiring_diagram_type: string | null;
  pref_plug_and_play_required: boolean | null;
  pref_shipping_required: boolean | null;
  pref_shipping_multiplier: number | null;
  pref_shipping_flat: number | null;
  pref_manufacturing_comments: string | null;
  pref_special_instructions: string | null;
}

/**
 * Pagination info returned with customer list
 */
export interface CustomerPaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

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
  } = {}): Promise<{ customers: Customer[]; pagination: CustomerPaginationInfo }> => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  /**
   * Create new customer
   */
  createCustomer: async (customerData: CustomerCreateData): Promise<Customer> => {
    const response = await api.post('/customers', customerData);
    return response.data;
  },

  /**
   * Get single customer by ID
   */
  getCustomer: async (id: number): Promise<Customer> => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  /**
   * Update customer
   */
  updateCustomer: async (id: number, data: Partial<CustomerCreateData>): Promise<Customer> => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  /**
   * Get customer manufacturing preferences
   */
  getManufacturingPreferences: async (id: number): Promise<ManufacturingPreferences> => {
    const response = await api.get(`/customers/${id}/manufacturing-preferences`);
    return response.data;
  },

  // Address management

  /**
   * Add address to customer
   */
  addAddress: async (customerId: number, addressData: Omit<Address, 'address_id'>): Promise<Address> => {
    const response = await api.post(`/customers/${customerId}/addresses`, addressData);
    return response.data;
  },

  /**
   * Update customer address
   */
  updateAddress: async (customerId: number, addressId: number | string, addressData: Partial<Address>): Promise<Address> => {
    const response = await api.put(`/customers/${customerId}/addresses/${addressId}`, addressData);
    return response.data;
  },

  /**
   * Delete customer address
   */
  deleteAddress: async (customerId: number, addressId: number | string): Promise<void> => {
    const response = await api.delete(`/customers/${customerId}/addresses/${addressId}`);
    return response.data;
  },

  /**
   * Get all addresses (including inactive)
   */
  getAddresses: async (customerId: number, includeInactive: boolean = false): Promise<{ addresses: Address[] }> => {
    const params = includeInactive ? { include_inactive: 'true' } : {};
    const response = await api.get(`/customers/${customerId}/addresses`, { params });
    return response.data;
  },

  /**
   * Reactivate address
   */
  reactivateAddress: async (customerId: number, addressId: number | string): Promise<void> => {
    const response = await api.post(`/customers/${customerId}/addresses/${addressId}/reactivate`);
    return response.data;
  },

  /**
   * Deactivate customer
   */
  deactivateCustomer: async (customerId: number): Promise<void> => {
    const response = await api.post(`/customers/${customerId}/deactivate`);
    return response.data;
  },

  /**
   * Reactivate customer
   */
  reactivateCustomer: async (customerId: number): Promise<void> => {
    const response = await api.post(`/customers/${customerId}/reactivate`);
    return response.data;
  },

  /**
   * Make an address primary
   */
  makePrimaryAddress: async (customerId: number, addressId: number | string): Promise<void> => {
    const response = await api.post(`/customers/${customerId}/addresses/${addressId}/make-primary`);
    return response.data;
  },
};
