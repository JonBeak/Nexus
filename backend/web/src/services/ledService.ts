// File Clean up Finished: Nov 14, 2025
// File Clean up Finished: Nov 14, 2025 (removed 4 unused methods: findLEDByProductCode, getDefaultLED, getLEDStatistics, isValidLED)
// File Clean up Finished: 2025-11-21
// Changes:
// - Replaced 2 manual .trim() patterns with getTrimmedString() utility
/**
 * LED Service
 *
 * Business logic layer for LED product management
 * Created: Nov 14, 2025 during ledsController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { LEDRepository, LED } from '../repositories/ledRepository';
import { ServiceResult } from '../types/serviceResults';
import { getTrimmedString } from '../utils/validation';
import { invalidatePricingCache } from '../websocket/taskBroadcast';

export class LEDService {
  private repository: LEDRepository;

  constructor() {
    this.repository = new LEDRepository();
  }

  /**
   * Get all active LEDs formatted for dropdown use
   * Returns LEDs ordered by default status, then alphabetically
   */
  async getActiveLEDs(): Promise<ServiceResult<LED[]>> {
    try {
      const leds = await this.repository.findAllActive();

      // Business rule: Always return at least an empty array, never null
      return {
        success: true,
        data: leds || []
      };
    } catch (error) {
      console.error('Service error fetching active LEDs:', error);
      return {
        success: false,
        error: 'Failed to fetch LED types',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Find LED using fuzzy matching for auto-fill
   * Matches against the full formatted name: "product_code - colour (watts, volts)"
   *
   * @param extractedType - The LED type extracted from user input (e.g., "Interone 9K")
   * @returns Matched LED full name or null if no match
   */
  async findLEDByFuzzyMatch(extractedType: string): Promise<string | null> {
    const trimmedType = getTrimmedString(extractedType);
    if (!trimmedType) {
      return null;
    }

    // Build search pattern: "Interone 9K" becomes "Interone 9K - %"
    const searchPattern = `${trimmedType} - %`;
    const matches = await this.repository.findByFuzzyMatch(searchPattern);

    return matches.length > 0 ? matches[0].full_name : null;
  }

  /**
   * Get all LEDs for management UI
   */
  async getAllLEDs(includeInactive = false): Promise<ServiceResult<LED[]>> {
    try {
      const leds = await this.repository.findAll(includeInactive);
      return { success: true, data: leds };
    } catch (error) {
      console.error('Service error fetching all LEDs:', error);
      return { success: false, error: 'Failed to fetch LED types', code: 'DATABASE_ERROR' };
    }
  }

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
  }): Promise<ServiceResult<{ led_id: number }>> {
    try {
      // Validate required field
      const productCode = getTrimmedString(led.product_code);
      if (!productCode) {
        return { success: false, error: 'Product code is required', code: 'VALIDATION_ERROR' };
      }

      // Check for duplicate product code
      const exists = await this.repository.productCodeExists(productCode);
      if (exists) {
        return { success: false, error: 'Product code already exists', code: 'DUPLICATE_ERROR' };
      }

      // If setting as default, clear existing defaults first
      if (led.is_default) {
        await this.repository.clearAllDefaults();
      }

      const ledId = await this.repository.create({ ...led, product_code: productCode });

      // Invalidate pricing cache so all clients get fresh data
      invalidatePricingCache('leds');

      return { success: true, data: { led_id: ledId } };
    } catch (error) {
      console.error('Service error creating LED:', error);
      return { success: false, error: 'Failed to create LED type', code: 'DATABASE_ERROR' };
    }
  }

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
  }): Promise<ServiceResult<void>> {
    try {
      // Check LED exists
      const existing = await this.repository.findById(ledId);
      if (!existing) {
        return { success: false, error: 'LED type not found', code: 'NOT_FOUND' };
      }

      // If updating product code, validate it's not a duplicate
      if (updates.product_code !== undefined) {
        const productCode = getTrimmedString(updates.product_code);
        if (!productCode) {
          return { success: false, error: 'Product code cannot be empty', code: 'VALIDATION_ERROR' };
        }
        const exists = await this.repository.productCodeExists(productCode, ledId);
        if (exists) {
          return { success: false, error: 'Product code already exists', code: 'DUPLICATE_ERROR' };
        }
        updates.product_code = productCode;
      }

      // If setting as default, clear existing defaults first
      if (updates.is_default === true) {
        await this.repository.clearAllDefaults();
      }

      await this.repository.update(ledId, updates);

      // Invalidate pricing cache so all clients get fresh data
      invalidatePricingCache('leds');

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Service error updating LED:', error);
      return { success: false, error: 'Failed to update LED type', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * Deactivate an LED type (soft delete)
   */
  async deactivateLED(ledId: number): Promise<ServiceResult<void>> {
    try {
      const existing = await this.repository.findById(ledId);
      if (!existing) {
        return { success: false, error: 'LED type not found', code: 'NOT_FOUND' };
      }

      await this.repository.update(ledId, { is_active: false });

      // Invalidate pricing cache so all clients get fresh data
      invalidatePricingCache('leds');

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Service error deactivating LED:', error);
      return { success: false, error: 'Failed to deactivate LED type', code: 'DATABASE_ERROR' };
    }
  }
}
