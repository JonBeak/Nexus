import { api } from '../apiClient';

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
  }
};
