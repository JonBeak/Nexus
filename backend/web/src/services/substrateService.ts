// File Clean up Finished: Nov 14, 2025
/**
 * Substrate Service
 *
 * Business logic layer for substrate material management
 * Created: Nov 14, 2025 during materialsController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { SubstrateRepository, SubstratePricing } from '../repositories/substrateRepository';

export class SubstrateService {
  private repository: SubstrateRepository;

  constructor() {
    this.repository = new SubstrateRepository();
  }

  /**
   * Get all active substrate names for dropdown use
   * Returns unique substrate names ordered alphabetically
   */
  async getActiveSubstrateNames(): Promise<string[]> {
    const names = await this.repository.findAllActiveNames();

    // Business rule: Always return at least an empty array, never null
    return names || [];
  }

  /**
   * Get current pricing for a specific substrate
   * Returns the most recent active pricing information
   *
   * @param substrateName - Name of the substrate material
   * @returns Current pricing or null if not found
   */
  async getSubstratePricing(substrateName: string): Promise<SubstratePricing | null> {
    if (!substrateName || substrateName.trim() === '') {
      throw new Error('Substrate name is required');
    }

    return await this.repository.findByName(substrateName.trim());
  }

  /**
   * Get pricing history for a substrate
   * Useful for tracking price changes over time
   *
   * @param substrateName - Name of the substrate material
   * @returns Array of pricing records ordered by date (newest first)
   */
  async getSubstratePricingHistory(substrateName: string): Promise<SubstratePricing[]> {
    if (!substrateName || substrateName.trim() === '') {
      throw new Error('Substrate name is required');
    }

    return await this.repository.findPricingHistory(substrateName.trim());
  }

  /**
   * Get all substrate pricing information
   * Returns complete pricing data for all active substrates
   */
  async getAllSubstratePricing(): Promise<SubstratePricing[]> {
    return await this.repository.findAllActivePricing();
  }

  /**
   * Calculate cost per square foot for a substrate
   * Business logic for cost calculation based on sheet pricing
   *
   * @param substrateName - Name of the substrate material
   * @returns Cost per square foot or null if substrate not found
   */
  async getCostPerSqFt(substrateName: string): Promise<number | null> {
    const pricing = await this.getSubstratePricing(substrateName);

    if (!pricing || !pricing.sheet_size_sqft || pricing.sheet_size_sqft === 0) {
      return null;
    }

    // Calculate: (material cost + cutting rate) / sheet size
    const totalCostPerSheet = pricing.material_cost_per_sheet + pricing.cutting_rate_per_sheet;
    const costPerSqFt = totalCostPerSheet / pricing.sheet_size_sqft;

    return Math.round(costPerSqFt * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get statistics about active substrates
   * Useful for dashboard displays
   */
  async getSubstrateStatistics(): Promise<{ uniqueSubstrateCount: number }> {
    const count = await this.repository.countUniqueActive();

    return {
      uniqueSubstrateCount: count
    };
  }

  /**
   * Validate substrate exists and is active
   * Returns boolean for quick checks
   */
  async isValidSubstrate(substrateName: string): Promise<boolean> {
    try {
      if (!substrateName || substrateName.trim() === '') {
        return false;
      }
      return await this.repository.exists(substrateName.trim());
    } catch (error) {
      return false;
    }
  }

  /**
   * Get substrate pricing with calculated per-sqft cost
   * Enriches pricing data with calculated cost per square foot
   */
  async getEnrichedPricing(substrateName: string): Promise<{
    pricing: SubstratePricing | null;
    costPerSqFt: number | null;
  }> {
    const pricing = await this.getSubstratePricing(substrateName);
    const costPerSqFt = pricing ? await this.getCostPerSqFt(substrateName) : null;

    return {
      pricing,
      costPerSqFt
    };
  }
}
