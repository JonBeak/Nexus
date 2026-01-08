import { api } from '../apiClient';

/**
 * LED type interface for management UI
 */
export interface LEDType {
  led_id: number;
  product_code: string;
  colour: string | null;
  watts: number | null;
  volts: number | null;
  brand: string | null;
  model: string | null;
  supplier: string | null;
  price: number | null;
  lumens: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * LED Products API
 * Manages LED product catalog for sign specifications
 */
export const ledsApi = {
  /**
   * Get all active LED types for specification dropdowns
   */
  async getActiveLEDs(): Promise<Array<{
    led_id: number;
    product_code: string;
    colour: string;
    watts: number;
    volts: number;
    brand: string;
    model: string;
    is_default: boolean;
  }>> {
    const response = await api.get('/leds');
    // Interceptor unwraps { success: true, data: [...] } to just [...]
    return response.data;
  },

  /**
   * Get all LED types for management UI (including inactive)
   */
  async getAllLEDs(includeInactive = false): Promise<LEDType[]> {
    const params = includeInactive ? { includeInactive: 'true' } : {};
    const response = await api.get('/leds/all', { params });
    return response.data;
  },

  /**
   * Create a new LED type
   */
  async createLED(led: {
    product_code: string;
    colour?: string;
    watts?: number;
    volts?: number;
    brand?: string;
    model?: string;
    supplier?: string;
    price?: number;
    lumens?: string;
    is_default?: boolean;
  }): Promise<{ led_id: number }> {
    const response = await api.post('/leds', led);
    return response.data;
  },

  /**
   * Update an existing LED type
   */
  async updateLED(ledId: number, updates: {
    product_code?: string;
    colour?: string;
    watts?: number;
    volts?: number;
    brand?: string;
    model?: string;
    supplier?: string;
    price?: number;
    lumens?: string;
    is_default?: boolean;
    is_active?: boolean;
  }): Promise<void> {
    await api.put(`/leds/${ledId}`, updates);
  },

  /**
   * Deactivate an LED type (soft delete)
   */
  async deactivateLED(ledId: number): Promise<void> {
    await api.delete(`/leds/${ledId}`);
  }
};
