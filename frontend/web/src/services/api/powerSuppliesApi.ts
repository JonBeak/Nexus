import { api } from '../apiClient';

/**
 * Power Supply type interface for management UI
 */
export interface PowerSupplyType {
  power_supply_id: number;
  transformer_type: string;
  price: number | null;
  watts: number | null;
  rated_watts: number | null;
  volts: number | null;
  warranty_labour_years: number | null;
  warranty_product_years: number | null;
  notes: string | null;
  ul_listed: boolean;
  is_default_non_ul: boolean;
  is_default_ul: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Power Supplies API
 * Manages power supply catalog for sign specifications
 */
export const powerSuppliesApi = {
  /**
   * Get all active power supply types for specification dropdowns
   */
  async getActivePowerSupplies(): Promise<Array<{
    power_supply_id: number;
    transformer_type: string;
    watts: number;
    rated_watts: number;
    volts: number;
    ul_listed: boolean;
    is_default_non_ul: boolean;
    is_default_ul: boolean;
  }>> {
    const response = await api.get('/power-supplies');
    // Interceptor unwraps { success: true, data: [...] } to just [...]
    return response.data;
  },

  /**
   * Get all power supplies for management UI (including inactive)
   */
  async getAllPowerSupplies(includeInactive = false): Promise<PowerSupplyType[]> {
    const params = includeInactive ? { includeInactive: 'true' } : {};
    const response = await api.get('/power-supplies/all', { params });
    return response.data;
  },

  /**
   * Create a new power supply
   */
  async createPowerSupply(powerSupply: {
    transformer_type: string;
    price?: number;
    watts?: number;
    rated_watts?: number;
    volts?: number;
    warranty_labour_years?: number;
    warranty_product_years?: number;
    notes?: string;
    ul_listed?: boolean;
    is_default_non_ul?: boolean;
    is_default_ul?: boolean;
  }): Promise<{ power_supply_id: number }> {
    const response = await api.post('/power-supplies', powerSupply);
    return response.data;
  },

  /**
   * Update an existing power supply
   */
  async updatePowerSupply(powerSupplyId: number, updates: {
    transformer_type?: string;
    price?: number;
    watts?: number;
    rated_watts?: number;
    volts?: number;
    warranty_labour_years?: number;
    warranty_product_years?: number;
    notes?: string;
    ul_listed?: boolean;
    is_default_non_ul?: boolean;
    is_default_ul?: boolean;
    is_active?: boolean;
  }): Promise<void> {
    await api.put(`/power-supplies/${powerSupplyId}`, updates);
  },

  /**
   * Deactivate a power supply (soft delete)
   */
  async deactivatePowerSupply(powerSupplyId: number): Promise<void> {
    await api.delete(`/power-supplies/${powerSupplyId}`);
  }
};
