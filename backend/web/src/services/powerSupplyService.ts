// File Clean up Finished: Nov 14, 2025
/**
 * Power Supply Service
 *
 * Business logic layer for power supply product management
 * Created: Nov 14, 2025 during powerSuppliesController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { PowerSupplyRepository, PowerSupply } from '../repositories/powerSupplyRepository';

export class PowerSupplyService {
  private repository: PowerSupplyRepository;

  constructor() {
    this.repository = new PowerSupplyRepository();
  }

  /**
   * Get all active power supplies formatted for dropdown use
   * Returns power supplies ordered by default status (UL first), then alphabetically
   */
  async getActivePowerSupplies(): Promise<PowerSupply[]> {
    const powerSupplies = await this.repository.findAllActive();

    // Business rule: Always return at least an empty array, never null
    return powerSupplies || [];
  }

  /**
   * Find power supply by transformer type
   * Used for validation and lookups
   */
  async findPowerSupplyByType(transformerType: string): Promise<PowerSupply | null> {
    if (!transformerType || transformerType.trim() === '') {
      throw new Error('Transformer type is required');
    }

    return await this.repository.findByTransformerType(transformerType.trim());
  }

  /**
   * Find power supply using fuzzy matching for auto-fill
   * Matches against the full formatted name: "transformer_type (watts, volts)"
   *
   * @param extractedType - The power supply type extracted from user input (e.g., "Speedbox 60W")
   * @returns Matched power supply full name or null if no match
   */
  async findPowerSupplyByFuzzyMatch(extractedType: string): Promise<string | null> {
    if (!extractedType || extractedType.trim() === '') {
      return null;
    }

    // Build search pattern: "Speedbox 60W" becomes "Speedbox 60W (%"
    const searchPattern = `${extractedType.trim()} (%`;
    const matches = await this.repository.findByFuzzyMatch(searchPattern);

    return matches.length > 0 ? matches[0].full_name : null;
  }

  /**
   * Get the appropriate default power supply based on UL requirement
   *
   * @param ulRequired - Whether UL listing is required
   * @returns Default power supply (UL or non-UL based on requirement)
   */
  async getDefaultPowerSupply(ulRequired: boolean): Promise<PowerSupply | null> {
    if (ulRequired) {
      return await this.repository.findDefaultUL();
    } else {
      return await this.repository.findDefaultNonUL();
    }
  }

  /**
   * Get power supplies by UL listing status
   * Useful for filtering options based on UL requirements
   */
  async getPowerSuppliesByULStatus(ulListed: boolean): Promise<PowerSupply[]> {
    return await this.repository.findByULStatus(ulListed);
  }

  /**
   * Get statistics about active power supplies
   * Useful for dashboard displays
   */
  async getPowerSupplyStatistics(): Promise<{
    activeCount: number;
    ulCount: number;
    nonUlCount: number
  }> {
    const activeCount = await this.repository.countActive();
    const { ul, nonUl } = await this.repository.countByULStatus();

    return {
      activeCount,
      ulCount: ul,
      nonUlCount: nonUl
    };
  }

  /**
   * Validate power supply exists and is active
   * Returns boolean for quick checks
   */
  async isValidPowerSupply(transformerType: string): Promise<boolean> {
    try {
      const ps = await this.findPowerSupplyByType(transformerType);
      return ps !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a power supply is UL listed
   * Used for business logic requiring UL validation
   */
  async isULListed(transformerType: string): Promise<boolean> {
    const ps = await this.findPowerSupplyByType(transformerType);
    return ps?.ul_listed || false;
  }
}
