// Power Supply Override validation template - context-aware PS count validation
// Accepts float, "yes", "no" and calculates PS count based on LED wattage

import { ValidationResult, PsOverrideParams, ValidationContext } from './ValidationTemplate';
import { calculateChannelLetterMetrics, ChannelLetterMetrics } from '../utils/channelLetterParser';
import { validateNumericInput } from '../utils/numericValidation';
import { PricingDataResource, PowerSupply } from '../../../../../services/pricingDataResource';
import { BaseValidationTemplate } from './BaseValidationTemplate';

type PowerSupplyCounts = {
  savedLedCount: number;
  defaultLedCount: number;
  savedPsCount: number;
  defaultPsCount: number;
  actualLedCount: number;
};

type PsOverrideParsedValue = number | 'yes' | 'no' | null;

export class PsOverrideTemplate extends BaseValidationTemplate {
  async validate(value: string, params: PsOverrideParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      const counts = await this.resolveCounts(context);

      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.handleEmptyValue(counts.defaultPsCount, params);
      }

      const cleanValue = value.trim().toLowerCase();

      // Parse input based on type
      const parseResult = this.parseInput(cleanValue, params, counts);
      if (!parseResult.isValid) {
        return parseResult;
      }

      const parsedValue = parseResult.parsedValue as PsOverrideParsedValue;

      // Calculate PS count based on parsed input and context
      const calculatedPsCount = await this.calculatePsCount(parsedValue, context, counts);

      return this.createSuccess(parsedValue, calculatedPsCount, params);
    });
  }

  /**
   * Parse input value into structured format
   */
  private parseInput(
    value: string,
    params: PsOverrideParams,
    counts: PowerSupplyCounts
  ): ValidationResult {
    const accepts = params.accepts || ['float', 'yes', 'no'];

    // Check for "yes" - calculate PS from actual LED count
    if (accepts.includes('yes') && value === 'yes') {
      if (counts.actualLedCount <= 0) {
        return this.createError('Cannot use "yes" for power supplies when there are no LEDs', params);
      }
      if (counts.defaultPsCount > 0) {
        return this.createError('Power supplies are already included by default. Enter a number or "no" instead.', params);
      }
      // Allow "yes" as long as there are actual LEDs (from field2 metrics OR field3 numeric override)
      // PS count will be calculated from actualLedCount in calculatePsCount()
      return { isValid: true, parsedValue: 'yes' };
    }

    // Check for "no" - note: this means "don't use PS" even if LEDs exist
    if (accepts.includes('no') && value === 'no') {
      if (counts.actualLedCount <= 0) {
        return this.createError('Provide an explicit number of power supplies when there are no LEDs.', params);
      }
      if (counts.defaultPsCount === 0) {
        return this.createError('Power supplies are already disabled by default. Enter a number if needed.', params);
      }
      return { isValid: true, parsedValue: 'no' };
    }

    // Check for numeric value using strict validation
    // Numeric values are ALWAYS allowed - they enable standalone PS components
    if (accepts.includes('float')) {
      const numericResult = validateNumericInput(value, {
        allowNegative: false,
        minValue: 0,
        allowEmpty: false
      });

      if (numericResult.isValid && numericResult.value !== undefined) {
        // Reject "0" when there are no LEDs (same as "no")
        if (numericResult.value === 0 && counts.actualLedCount <= 0) {
          return this.createError('Provide an explicit number of power supplies when there are no LEDs.', params);
        }

        // Reject "0" when power supplies are already disabled by default (same as "no")
        if (numericResult.value === 0 && counts.defaultPsCount === 0) {
          return this.createError('Power supplies are already disabled by default. Enter a number if needed.', params);
        }

        // Allow explicit numeric values even when there are no LEDs
        // This enables standalone PS components for Blade Signs
        return { isValid: true, parsedValue: numericResult.value };
      }

      // If validation failed, use the specific error
      if (numericResult.error) {
        return this.createError(numericResult.error, params);
      }
    }

    // Invalid input
    return this.createError(`Invalid input. Expected: ${accepts.join(', ')}`, params);
  }

  /**
   * Calculate PS count based on input and context
   */
  private async calculatePsCount(
    parsedValue: PsOverrideParsedValue,
    context: ValidationContext | undefined,
    counts: PowerSupplyCounts
  ): Promise<number> {
    if (!context) return 0;

    // Handle different input types
    if (typeof parsedValue === 'number') {
      // Explicit numeric override
      return parsedValue;
    }

    if (parsedValue === 'yes') {
      // Calculate PS from actual LED count (works with field2 metrics OR field3 numeric override)
      if (counts.actualLedCount > 0) {
        return await this.calculatePsFromLeds(counts.actualLedCount, context);
      }
      // Fallback to saved if no actual LEDs (shouldn't happen due to validation)
      return counts.savedPsCount;
    }

    if (parsedValue === 'no') {
      // Explicit override to no power supplies
      return 0;
    }

    // No explicit input - use default behavior
    return counts.defaultPsCount;
  }

  /**
   * Calculate power supply count from LED count and wattage
   */
  private async calculatePsFromLeds(ledCount: number, context: ValidationContext): Promise<number> {
    if (ledCount === 0) return 0;

    try {
      const ledType = this.getLedType(context);
      const wattsPerLed = this.getWattsPerLed(ledType);
      const totalWattage = ledCount * wattsPerLed;
      const estimatedCount = await this.estimatePsCountFromWattage(totalWattage, context);
      return Math.max(estimatedCount, 1);
    } catch (error) {
      console.warn('Error calculating PS from LEDs:', error);
      return 1;
    }
  }

  private async estimatePsCountFromWattage(totalWattage: number, context: ValidationContext): Promise<number> {
    if (totalWattage <= 0) {
      return 0;
    }

    const field10Value = typeof context.rowData.field10 === 'string' ? context.rowData.field10.trim() : '';
    if (field10Value) {
      const overrideSupply = await PricingDataResource.getPowerSupplyByType(field10Value);
      const capacity = this.getSupplyCapacity(overrideSupply);
      if (capacity) {
        return Math.ceil(totalWattage / capacity);
      }
    }

    const preferredType = context.customerPreferences?.pref_power_supply_type?.trim();
    if (preferredType) {
      const preferredSupply = await PricingDataResource.getPowerSupplyByType(preferredType);
      const capacity = this.getSupplyCapacity(preferredSupply);
      if (capacity) {
        return Math.ceil(totalWattage / capacity);
      }
    }

    if (this.requiresUl(context)) {
      return this.calculateUlPsCount(totalWattage);
    }

    const defaultNonUl = await PricingDataResource.getDefaultNonULPowerSupply();
    const defaultCapacity = this.getSupplyCapacity(defaultNonUl);
    if (defaultCapacity) {
      return Math.ceil(totalWattage / defaultCapacity);
    }

    return Math.ceil(totalWattage / 60);
  }

  private async calculateUlPsCount(totalWattage: number): Promise<number> {
    const pricingData = await PricingDataResource.getAllPricingData();
    const ulSupplies = pricingData.powerSupplies
      .filter(ps => ps.ul_listed && ps.is_active)
      .map(ps => ({ supply: ps, capacity: this.getSupplyCapacity(ps) }))
      .filter((entry): entry is { supply: PowerSupply; capacity: number } => typeof entry.capacity === 'number' && entry.capacity > 0)
      .sort((a, b) => a.capacity - b.capacity);

    if (ulSupplies.length === 0) {
      return Math.max(1, Math.ceil(totalWattage / 60));
    }

    const lowest = ulSupplies[0];
    const highest = ulSupplies[ulSupplies.length - 1];

    if (ulSupplies.length === 1) {
      return Math.max(1, Math.ceil(totalWattage / highest.capacity));
    }

    if (totalWattage <= lowest.capacity) {
      return 1;
    }

    const remainder = totalWattage % highest.capacity;
    let highCount = Math.floor(totalWattage / highest.capacity);
    let lowCount = 0;

    if (remainder === 0) {
      if (highCount === 0) {
        highCount = 1;
      }
    } else if (remainder < lowest.capacity) {
      lowCount = 1;
    } else {
      highCount += 1;
    }

    const totalCount = highCount + lowCount;
    return totalCount > 0 ? totalCount : 1;
  }

  private requiresUl(context: ValidationContext): boolean {
    const field4Value = context.rowData.field4;
    if (typeof field4Value === 'string') {
      const normalized = field4Value.trim().toLowerCase();
      if (normalized === 'yes') {
        return true;
      }
      if (normalized === 'no') {
        return false;
      }
    }

    if (context.customerPreferences?.pref_power_supply_is_ul_listed === true) {
      return true;
    }

    if (context.customerPreferences?.pref_ul_required === true) {
      return true;
    }

    return false;
  }

  private getSupplyCapacity(ps?: PowerSupply | null): number | null {
    if (!ps) {
      return null;
    }

    const capacity = typeof ps.watts === 'number' && ps.watts > 0
      ? ps.watts
      : typeof ps.rated_watts === 'number' && ps.rated_watts > 0
        ? ps.rated_watts
        : null;

    return capacity;
  }

  private getLedCount(context: ValidationContext): number {
    if (typeof context.calculatedValues?.ledCount === 'number') {
      return context.calculatedValues.ledCount;
    }

    const metrics = this.getChannelLetterMetrics(context);
    return metrics?.ledCount || 0;
  }

  private getSavedLedCount(context?: ValidationContext): number {
    if (!context) return 0;
    const savedLedCount = context.calculatedValues?.savedLedCount;
    if (typeof savedLedCount === 'number') {
      return Math.max(0, savedLedCount);
    }

    return Math.max(0, this.getLedCount(context));
  }

  private getDefaultLedCount(context: ValidationContext | undefined, savedLedCount: number): number {
    if (!context) return 0;
    const defaultLedCount = context.calculatedValues?.defaultLedCount;
    if (typeof defaultLedCount === 'number') {
      return Math.max(0, defaultLedCount);
    }

    return context.customerPreferences.use_leds ? savedLedCount : 0;
  }

  private getActualLedCount(context: ValidationContext | undefined, defaultLedCount: number): number {
    if (!context) return defaultLedCount;
    const ledCount = context.calculatedValues?.ledCount;
    if (typeof ledCount === 'number') {
      return Math.max(0, ledCount);
    }
    return defaultLedCount;
  }

  private async getSavedPsCount(
    context: ValidationContext | undefined,
    savedLedCount: number
  ): Promise<number> {
    if (!context) {
      if (savedLedCount <= 0) {
        return 0;
      }
      const estimatedTotalWattage = savedLedCount * 1.2;
      return Math.max(0, Math.ceil(estimatedTotalWattage / 60));
    }

    const saved = context.calculatedValues?.savedPsCount;
    if (typeof saved === 'number') {
      return Math.max(0, saved);
    }

    if (savedLedCount <= 0) {
      return 0;
    }

    const estimated = await this.calculatePsFromLeds(savedLedCount, context);
    return Math.max(0, estimated);
  }

  private async getDefaultPsCount(
    context: ValidationContext | undefined,
    defaultLedCount: number,
    savedPsCount: number
  ): Promise<number> {
    if (!context) return 0;

    const defaultPs = context.calculatedValues?.defaultPsCount;
    if (typeof defaultPs === 'number') {
      return Math.max(0, defaultPs);
    }

    if (defaultLedCount > 0 && context.customerPreferences?.requires_transformers) {
      if (savedPsCount > 0) {
        return savedPsCount;
      }

      const estimated = await this.calculatePsFromLeds(defaultLedCount, context);
      return Math.max(0, estimated);
    }

    return 0;
  }

  private async resolveCounts(context?: ValidationContext): Promise<PowerSupplyCounts> {
    const savedLedCount = this.getSavedLedCount(context);
    const defaultLedCount = this.getDefaultLedCount(context, savedLedCount);
    const savedPsCount = await this.getSavedPsCount(context, savedLedCount);
    const defaultPsCount = await this.getDefaultPsCount(context, defaultLedCount, savedPsCount);
    const actualLedCount = this.getActualLedCount(context, defaultLedCount);

    return {
      savedLedCount,
      defaultLedCount,
      savedPsCount,
      defaultPsCount,
      actualLedCount
    };
  }

  private getChannelLetterMetrics(context: ValidationContext): ChannelLetterMetrics | null {
    return (
      (context.calculatedValues?.channelLetterMetrics as ChannelLetterMetrics | undefined) ||
      calculateChannelLetterMetrics(context.rowData.field2)
    );
  }

  /**
   * Get LED type from field8 or customer preference
   */
  private getLedType(context: ValidationContext): string {
    // Priority: field8 > customer preference > system default
    const field8Value = context.rowData.field8;
    if (field8Value && field8Value.trim()) {
      return field8Value.trim();
    }

    if (context.customerPreferences.default_led_type) {
      return context.customerPreferences.default_led_type;
    }

    return 'Standard LED'; // System default
  }

  /**
   * Get watts per LED based on LED type
   */
  private getWattsPerLed(ledType: string): number {
    // This would typically come from a database lookup
    // For now, using simplified mapping
    const wattageMap: Record<string, number> = {
      'Standard LED': 1.2,
      'High Power LED': 2.0,
      'Low Power LED': 0.8,
      'RGB LED': 1.5
    };

    return wattageMap[ledType] || 1.2; // Default 1.2W per LED
  }

  /**
   * Generate expected format description
   */
  protected generateExpectedFormat(params: PsOverrideParams): string {
    const accepts = params.accepts || ['float', 'yes', 'no'];
    const formats: string[] = [];

    if (accepts.includes('float')) {
      formats.push('number (PS count)');
    }
    if (accepts.includes('yes')) {
      formats.push('"yes" (calculate from LED wattage)');
    }
    if (accepts.includes('no')) {
      formats.push('"no" (no power supplies)');
    }

    return `Accepts: ${formats.join(', ')}`;
  }

  getDescription(): string {
    return 'Context-aware power supply count validation with LED wattage calculations and customer preferences';
  }

  getParameterSchema(): Record<string, unknown> {
    return {
      accepts: {
        type: 'array',
        items: { type: 'string', enum: ['float', 'yes', 'no'] },
        required: false,
        description: 'Allowed input types',
        default: ['float', 'yes', 'no']
      },
      auto_calculate: {
        type: 'boolean',
        required: false,
        description: 'Whether to auto-calculate from LED wattage',
        default: true
      }
    };
  }
}
