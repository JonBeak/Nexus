import { api } from '../apiClient';

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
    return response.data.powerSupplies;
  }
};
