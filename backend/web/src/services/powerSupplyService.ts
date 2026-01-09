// File Clean up Finished: Nov 14, 2025
// File Clean up Finished: 2025-11-21
// Changes:
// - Replaced 4 manual .trim() patterns with getTrimmedString() utility
// - Cleaner validation in findPowerSupplyByType() and findPowerSupplyByFuzzyMatch()
/**
 * Power Supply Service
 *
 * Business logic layer for power supply product management
 * Created: Nov 14, 2025 during powerSuppliesController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { PowerSupplyRepository, PowerSupply } from '../repositories/powerSupplyRepository';
import { ServiceResult } from '../types/serviceResults';
import { getTrimmedString } from '../utils/validation';

export class PowerSupplyService {
  private repository: PowerSupplyRepository;

  constructor() {
    this.repository = new PowerSupplyRepository();
  }

  /**
   * Get all active power supplies formatted for dropdown use
   * Returns power supplies ordered by default status (UL first), then alphabetically
   */
  async getActivePowerSupplies(): Promise<ServiceResult<PowerSupply[]>> {
    try {
      const powerSupplies = await this.repository.findAllActive();

      // Business rule: Always return at least an empty array, never null
      return {
        success: true,
        data: powerSupplies || []
      };
    } catch (error) {
      console.error('Service error fetching active power supplies:', error);
      return {
        success: false,
        error: 'Failed to fetch power supply types',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * Find power supply by transformer type
   * Used for validation and lookups
   */
  async findPowerSupplyByType(transformerType: string): Promise<PowerSupply | null> {
    const trimmedType = getTrimmedString(transformerType);
    if (!trimmedType) {
      throw new Error('Transformer type is required');
    }

    return await this.repository.findByTransformerType(trimmedType);
  }

  /**
   * Find power supply using fuzzy matching for auto-fill
   * Matches against the full formatted name: "transformer_type (watts, volts)"
   *
   * @param extractedType - The power supply type extracted from user input (e.g., "Speedbox 60W")
   * @returns Matched power supply full name or null if no match
   */
  async findPowerSupplyByFuzzyMatch(extractedType: string): Promise<string | null> {
    const trimmedType = getTrimmedString(extractedType);
    if (!trimmedType) {
      return null;
    }

    // Build search pattern: "Speedbox 60W" becomes "Speedbox 60W (%"
    const searchPattern = `${trimmedType} (%`;
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

  /**
   * Get all power supplies for management UI
   */
  async getAllPowerSupplies(includeInactive = false): Promise<ServiceResult<PowerSupply[]>> {
    try {
      const powerSupplies = await this.repository.findAll(includeInactive);
      return { success: true, data: powerSupplies };
    } catch (error) {
      console.error('Service error fetching all power supplies:', error);
      return { success: false, error: 'Failed to fetch power supplies', code: 'DATABASE_ERROR' };
    }
  }

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
  }): Promise<ServiceResult<{ power_supply_id: number }>> {
    try {
      // Validate required field
      const transformerType = getTrimmedString(powerSupply.transformer_type);
      if (!transformerType) {
        return { success: false, error: 'Transformer type is required', code: 'VALIDATION_ERROR' };
      }

      // Check for duplicate transformer type
      const exists = await this.repository.transformerTypeExists(transformerType);
      if (exists) {
        return { success: false, error: 'Transformer type already exists', code: 'DUPLICATE_ERROR' };
      }

      // If setting as UL default, clear existing UL defaults first
      if (powerSupply.is_default_ul) {
        await this.repository.clearDefaultsForUL();
      }

      // If setting as non-UL default, clear existing non-UL defaults first
      if (powerSupply.is_default_non_ul) {
        await this.repository.clearDefaultsForNonUL();
      }

      const powerSupplyId = await this.repository.create({ ...powerSupply, transformer_type: transformerType });
      return { success: true, data: { power_supply_id: powerSupplyId } };
    } catch (error) {
      console.error('Service error creating power supply:', error);
      return { success: false, error: 'Failed to create power supply', code: 'DATABASE_ERROR' };
    }
  }

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
  }): Promise<ServiceResult<void>> {
    try {
      // Check power supply exists
      const existing = await this.repository.findById(powerSupplyId);
      if (!existing) {
        return { success: false, error: 'Power supply not found', code: 'NOT_FOUND' };
      }

      // If updating transformer type, validate it's not a duplicate
      if (updates.transformer_type !== undefined) {
        const transformerType = getTrimmedString(updates.transformer_type);
        if (!transformerType) {
          return { success: false, error: 'Transformer type cannot be empty', code: 'VALIDATION_ERROR' };
        }
        const exists = await this.repository.transformerTypeExists(transformerType, powerSupplyId);
        if (exists) {
          return { success: false, error: 'Transformer type already exists', code: 'DUPLICATE_ERROR' };
        }
        updates.transformer_type = transformerType;
      }

      // If setting as UL default, clear existing UL defaults first
      if (updates.is_default_ul === true) {
        await this.repository.clearDefaultsForUL();
      }

      // If setting as non-UL default, clear existing non-UL defaults first
      if (updates.is_default_non_ul === true) {
        await this.repository.clearDefaultsForNonUL();
      }

      await this.repository.update(powerSupplyId, updates);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Service error updating power supply:', error);
      return { success: false, error: 'Failed to update power supply', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * Deactivate a power supply (soft delete)
   */
  async deactivatePowerSupply(powerSupplyId: number): Promise<ServiceResult<void>> {
    try {
      const existing = await this.repository.findById(powerSupplyId);
      if (!existing) {
        return { success: false, error: 'Power supply not found', code: 'NOT_FOUND' };
      }

      await this.repository.update(powerSupplyId, { is_active: false });
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Service error deactivating power supply:', error);
      return { success: false, error: 'Failed to deactivate power supply', code: 'DATABASE_ERROR' };
    }
  }
}
