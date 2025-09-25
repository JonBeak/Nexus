// Power Supply Override validation template - context-aware PS count validation
// Accepts float, "yes", "no" and calculates PS count based on LED wattage

import { ValidationTemplate, ValidationResult, PsOverrideParams, ValidationContext } from './ValidationTemplate';
import { calculateChannelLetterMetrics, ChannelLetterMetrics } from '../utils/channelLetterParser';

type PsOverrideParsedValue = number | 'yes' | 'no' | null;

export class PsOverrideTemplate implements ValidationTemplate {
  async validate(value: string, params: PsOverrideParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    try {
      const counts = this.resolveCounts(context);

      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        // Empty is valid - will use default behavior
        return {
          isValid: true,
          parsedValue: null,
          calculatedValue: counts.defaultPsCount,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      const cleanValue = value.trim().toLowerCase();

      // Parse input based on type
      const parseResult = this.parseInput(cleanValue, params, counts);
      if (!parseResult.isValid) {
        return parseResult;
      }

      const parsedValue = parseResult.parsedValue as PsOverrideParsedValue;

      // Calculate PS count based on parsed input and context
      const calculatedPsCount = this.calculatePsCount(parsedValue, context, counts);

      // Generate warnings if applicable
      const warnings = this.generateWarnings(parsedValue, context);

      return {
        isValid: true,
        parsedValue,
        calculatedValue: calculatedPsCount,
        warnings: warnings.length > 0 ? warnings : undefined,
        expectedFormat: this.generateExpectedFormat(params)
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }
  }

  /**
   * Parse input value into structured format
   */
  private parseInput(
    value: string,
    params: PsOverrideParams,
    counts: {
      savedLedCount: number;
      defaultLedCount: number;
      savedPsCount: number;
      defaultPsCount: number;
      actualLedCount: number;
    }
  ): ValidationResult {
    const accepts = params.accepts || ['float', 'yes', 'no'];

    // Check for "yes" - but reject if there are no LEDs
    if (accepts.includes('yes') && value === 'yes') {
      if (counts.actualLedCount <= 0) {
        return {
          isValid: false,
          error: 'Cannot use "yes" for power supplies when there are no LEDs',
          expectedFormat: 'Use a specific number or "no" when no LEDs are present'
        };
      }
      if (counts.defaultPsCount > 0) {
        return {
          isValid: false,
          error: 'Power supplies are already included by default. Enter a number or "no" instead.',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }
      if (counts.savedPsCount <= 0) {
        return {
          isValid: false,
          error: 'No saved power supply count available to restore.',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }
      return { isValid: true, parsedValue: 'yes' };
    }

    // Check for "no" - note: this means "don't use PS" even if LEDs exist
    if (accepts.includes('no') && value === 'no') {
      if (counts.actualLedCount <= 0) {
        return {
          isValid: false,
          error: 'Provide an explicit number of power supplies when there are no LEDs.',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }
      if (counts.defaultPsCount === 0) {
        return {
          isValid: false,
          error: 'Power supplies are already disabled by default. Enter a number if needed.',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }
      return { isValid: true, parsedValue: 'no' };
    }

    // Check for numeric value
    if (accepts.includes('float')) {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        if (numericValue < 0) {
          return {
            isValid: false,
            error: 'Power supply count cannot be negative',
            expectedFormat: this.generateExpectedFormat(params)
          };
        }
        return { isValid: true, parsedValue: numericValue };
      }
    }

    // Invalid input
    return {
      isValid: false,
      error: `Invalid input. Expected: ${accepts.join(', ')}`,
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Calculate PS count based on input and context
   */
  private calculatePsCount(
    parsedValue: PsOverrideParsedValue,
    context: ValidationContext | undefined,
    counts: {
      savedLedCount: number;
      defaultLedCount: number;
      savedPsCount: number;
      defaultPsCount: number;
      actualLedCount: number;
    }
  ): number {
    if (!context) return 0;

    // Handle different input types
    if (typeof parsedValue === 'number') {
      // Explicit numeric override
      return parsedValue;
    }

    if (parsedValue === 'yes') {
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
   * Calculate default PS count based on customer preferences and LED count
   */
  private calculateDefaultPsCount(context?: ValidationContext): number {
    const counts = this.resolveCounts(context);
    return counts.defaultPsCount;
  }

  /**
   * Calculate power supply count from LED count and wattage
   */
  private calculatePsFromLeds(ledCount: number, context: ValidationContext): number {
    if (ledCount === 0) return 0;

    try {
      // Get LED type from field8 or customer preference
      const ledType = this.getLedType(context);

      // Calculate total wattage
      const wattsPerLed = this.getWattsPerLed(ledType);
      const totalWattage = ledCount * wattsPerLed;

      // Determine power supply type and calculate count
      const psType = this.getPowerSupplyType(totalWattage, context);
      const psWattageCapacity = this.getPsWattageCapacity(psType);

      // Calculate number of power supplies needed
      const psCount = Math.ceil(totalWattage / psWattageCapacity);

      return Math.max(psCount, 1); // Minimum 1 PS if LEDs exist
    } catch (error) {
      console.warn('Error calculating PS from LEDs:', error);
      return 1; // Fallback: 1 power supply
    }
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

  private getSavedPsCount(
    context: ValidationContext | undefined,
    savedLedCount: number
  ): number {
    if (!context) {
      if (savedLedCount <= 0) {
        return 0;
      }
      // Fallback: assume standard wattage when context unavailable
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

    return Math.max(0, this.calculatePsFromLeds(savedLedCount, context));
  }

  private getDefaultPsCount(
    context: ValidationContext | undefined,
    defaultLedCount: number,
    savedPsCount: number
  ): number {
    if (!context) return 0;

    const defaultPs = context.calculatedValues?.defaultPsCount;
    if (typeof defaultPs === 'number') {
      return Math.max(0, defaultPs);
    }

    if (defaultLedCount > 0 && context.customerPreferences.requires_transformers) {
      return savedPsCount > 0 ? savedPsCount : this.calculatePsFromLeds(defaultLedCount, context);
    }

    return 0;
  }

  private resolveCounts(context?: ValidationContext) {
    const savedLedCount = this.getSavedLedCount(context);
    const defaultLedCount = this.getDefaultLedCount(context, savedLedCount);
    const savedPsCount = this.getSavedPsCount(context, savedLedCount);
    const defaultPsCount = this.getDefaultPsCount(context, defaultLedCount, savedPsCount);
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
   * Determine power supply type based on wattage and UL requirements
   */
  private getPowerSupplyType(totalWattage: number, context: ValidationContext): string {
    const isUL = context.gridContext?.hasAnyUL || false;

    // Check field10 override first
    const field10Value = context.rowData.field10;
    if (field10Value && field10Value.trim()) {
      return field10Value.trim();
    }

    // Auto-select based on wattage and UL requirement
    if (totalWattage <= 60) {
      return isUL ? 'UL-DC-60W' : 'DC-60W';
    } else if (totalWattage <= 100) {
      return isUL ? 'UL-DC-100W' : 'DC-100W';
    } else {
      return 'Speedbox'; // High wattage solution
    }
  }

  /**
   * Get power supply wattage capacity
   */
  private getPsWattageCapacity(psType: string): number {
    const capacityMap: Record<string, number> = {
      'DC-60W': 60,
      'UL-DC-60W': 60,
      'DC-100W': 100,
      'UL-DC-100W': 100,
      'Speedbox': 300
    };

    return capacityMap[psType] || 60; // Default 60W capacity
  }

  /**
   * Generate warnings for potentially confusing input
   */
  private generateWarnings(parsedValue: PsOverrideParsedValue, context?: ValidationContext): string[] {
    const warnings: string[] = [];

    if (!context) return warnings;

    const ledCount = this.getLedCount(context);

    // Warning only when auto-calculating without LEDs; explicit counts are allowed
    if (parsedValue === 'yes' && ledCount === 0) {
      warnings.push('Power supplies requested but no LEDs detected');
    }

    return warnings;
  }

  /**
   * Generate expected format description
   */
  private generateExpectedFormat(params: PsOverrideParams): string {
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
