// Power Supply Override validation template - context-aware PS count validation
// Accepts float, "yes", "no" and calculates PS count based on LED wattage

import { ValidationTemplate, ValidationResult, PsOverrideParams, ValidationContext } from './ValidationTemplate';

export class PsOverrideTemplate implements ValidationTemplate {
  async validate(value: string, params: PsOverrideParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    try {
      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        // Empty is valid - will use default behavior
        return {
          isValid: true,
          parsedValue: null,
          calculatedValue: this.calculateDefaultPsCount(context),
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      const cleanValue = value.trim().toLowerCase();

      // Parse input based on type
      const parseResult = this.parseInput(cleanValue, params, context);
      if (!parseResult.isValid) {
        return parseResult;
      }

      // Calculate PS count based on parsed input and context
      const calculatedPsCount = this.calculatePsCount(parseResult.parsedValue, context);

      // Generate warnings if applicable
      const warnings = this.generateWarnings(parseResult.parsedValue, context);

      return {
        isValid: true,
        parsedValue: parseResult.parsedValue,
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
  private parseInput(value: string, params: PsOverrideParams, context?: ValidationContext): ValidationResult {
    const accepts = params.accepts || ['float', 'yes', 'no'];

    // Check for "yes" - but reject if there are no LEDs
    if (accepts.includes('yes') && value === 'yes') {
      const ledCount = context?.calculatedValues?.ledCount || 0;
      if (ledCount === 0) {
        return {
          isValid: false,
          error: 'Cannot use "yes" for power supplies when there are no LEDs',
          expectedFormat: 'Use a specific number or "no" when no LEDs are present'
        };
      }
      return { isValid: true, parsedValue: 'yes' };
    }

    // Check for "no" - note: this means "don't use PS" even if LEDs exist
    if (accepts.includes('no') && value === 'no') {
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
  private calculatePsCount(parsedValue: any, context?: ValidationContext): number {
    if (!context) return 0;

    const ledCount = context.calculatedValues?.ledCount || 0;

    // Handle different input types
    if (typeof parsedValue === 'number') {
      // Explicit numeric override
      return parsedValue;
    }

    if (parsedValue === 'yes') {
      if (ledCount > 0) {
        // Calculate from LED wattage
        return this.calculatePsFromLeds(ledCount, context);
      } else {
        // No LEDs to power
        return 0;
      }
    }

    if (parsedValue === 'no') {
      // Explicit override to no power supplies
      return 0;
    }

    // No explicit input - use default behavior
    return this.calculateDefaultPsCount(context);
  }

  /**
   * Calculate default PS count based on customer preferences and LED count
   */
  private calculateDefaultPsCount(context?: ValidationContext): number {
    if (!context) return 0;

    const ledCount = context.calculatedValues?.ledCount || 0;

    // No LEDs = no power supplies needed
    if (ledCount === 0) return 0;

    // Check customer preference for power supplies
    if (context.customerPreferences.requires_transformers) {
      // Customer default: include power supplies when LEDs exist
      return this.calculatePsFromLeds(ledCount, context);
    }

    // Default: no power supplies unless explicitly requested
    return 0;
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
  private generateWarnings(parsedValue: any, context?: ValidationContext): string[] {
    const warnings: string[] = [];

    if (!context) return warnings;

    const ledCount = context.calculatedValues?.ledCount || 0;

    // Warning: requesting PS without LEDs
    if ((parsedValue === 'yes' || typeof parsedValue === 'number') && ledCount === 0) {
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

  getParameterSchema(): Record<string, any> {
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