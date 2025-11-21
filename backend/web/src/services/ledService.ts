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
}
