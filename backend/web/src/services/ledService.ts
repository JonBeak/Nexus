// File Clean up Finished: Nov 14, 2025
// File Clean up Finished: Nov 14, 2025 (removed 4 unused methods: findLEDByProductCode, getDefaultLED, getLEDStatistics, isValidLED)
/**
 * LED Service
 *
 * Business logic layer for LED product management
 * Created: Nov 14, 2025 during ledsController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { LEDRepository, LED } from '../repositories/ledRepository';

export class LEDService {
  private repository: LEDRepository;

  constructor() {
    this.repository = new LEDRepository();
  }

  /**
   * Get all active LEDs formatted for dropdown use
   * Returns LEDs ordered by default status, then alphabetically
   */
  async getActiveLEDs(): Promise<LED[]> {
    const leds = await this.repository.findAllActive();

    // Business rule: Always return at least an empty array, never null
    return leds || [];
  }

  /**
   * Find LED using fuzzy matching for auto-fill
   * Matches against the full formatted name: "product_code - colour (watts, volts)"
   *
   * @param extractedType - The LED type extracted from user input (e.g., "Interone 9K")
   * @returns Matched LED full name or null if no match
   */
  async findLEDByFuzzyMatch(extractedType: string): Promise<string | null> {
    if (!extractedType || extractedType.trim() === '') {
      return null;
    }

    // Build search pattern: "Interone 9K" becomes "Interone 9K - %"
    const searchPattern = `${extractedType.trim()} - %`;
    const matches = await this.repository.findByFuzzyMatch(searchPattern);

    return matches.length > 0 ? matches[0].full_name : null;
  }
}
