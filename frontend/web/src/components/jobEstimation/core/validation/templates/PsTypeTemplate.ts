// PS Type validation template - validates PS type selection based on PS count
// Should show error if PS type is selected but there are no power supplies

import { ValidationTemplate, ValidationResult, ValidationContext } from './ValidationTemplate';

export interface PsTypeParams {
  // No specific parameters needed - validation is purely context-dependent
}

export class PsTypeTemplate implements ValidationTemplate {
  async validate(value: string, params: PsTypeParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    try {
      // Handle empty values - always valid (no selection is fine)
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return {
          isValid: true,
          parsedValue: null,
          expectedFormat: 'PS type selection (optional when power supplies are present)'
        };
      }

      const cleanValue = value.trim();

      // Check if there are any power supplies in this row
      const psCount = this.calculatePsCount(context);

      if (psCount === 0) {
        return {
          isValid: false,
          error: 'Cannot select PS type when there are no power supplies',
          expectedFormat: 'PS type can only be selected when power supplies are present (field9 > 0)',
          calculatedValue: { psCount }
        };
      }

      // If there are PSs, any selection is valid
      return {
        isValid: true,
        parsedValue: cleanValue,
        calculatedValue: { psCount },
        expectedFormat: 'Any PS type (power supplies are present)'
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: 'PS type selection (optional when power supplies are present)'
      };
    }
  }

  /**
   * Calculate PS count from field9 and context
   */
  private calculatePsCount(context?: ValidationContext): number {
    if (!context) return 0;

    // Check calculated values first (from ValidationEngine Phase 1)
    if (context.calculatedValues?.psCount !== undefined) {
      return context.calculatedValues.psCount;
    }

    // Fallback: calculate from field9 directly
    const field9Value = context.rowData.field9;
    if (!field9Value || field9Value.trim() === '') {
      // Auto-calculate from LEDs if customer requires transformers
      if (context.customerPreferences?.requires_transformers) {
        return this.calculatePsFromLeds(context);
      }
      return 0;
    }

    const cleanValue = field9Value.trim().toLowerCase();

    // Handle different field9 input types
    if (cleanValue === 'no') {
      return 0;
    }

    if (cleanValue === 'yes') {
      return this.calculatePsFromLeds(context);
    }

    // Try to parse as number
    const numericValue = parseFloat(cleanValue);
    if (!isNaN(numericValue)) {
      return Math.max(0, numericValue); // Ensure non-negative
    }

    // Default to 0 if can't parse
    return 0;
  }

  /**
   * Calculate PS count from LED count and wattage
   */
  private calculatePsFromLeds(context?: ValidationContext): number {
    if (!context) return 0;

    // Get LED count (use calculated value or calculate)
    let ledCount = 0;
    if (context.calculatedValues?.ledCount !== undefined) {
      ledCount = context.calculatedValues.ledCount;
    } else {
      // Calculate LED count from field3
      const field3Value = context.rowData.field3;
      if (!field3Value || field3Value.trim() === '') {
        ledCount = context.customerPreferences?.use_leds ? this.calculateLedsFromDimensions(context) : 0;
      } else {
        const cleanValue = field3Value.trim().toLowerCase();
        if (cleanValue === 'no') {
          ledCount = 0;
        } else if (cleanValue === 'yes') {
          ledCount = this.calculateLedsFromDimensions(context);
        } else {
          const numericValue = parseFloat(cleanValue);
          ledCount = !isNaN(numericValue) ? Math.max(0, numericValue) : 0;
        }
      }
    }

    if (ledCount === 0) return 0;

    // Calculate total wattage (assume 1.2W per LED)
    const totalWattage = ledCount * 1.2;

    // Calculate PS count (60W per PS)
    return Math.ceil(totalWattage / 60);
  }

  /**
   * Calculate LEDs from field2 dimensions (same logic as LedTypeTemplate)
   */
  private calculateLedsFromDimensions(context?: ValidationContext): number {
    if (!context) return 0;

    const field1 = context.rowData.field1; // Letter type
    const field2 = context.rowData.field2; // Dimensions

    if (!field1 || !field2 || field1.trim() === '' || field2.trim() === '') {
      return 0;
    }

    try {
      const dimensionGroups = field2.split(',').map(d => d.trim()).filter(d => d !== '');
      let totalPerimeter = 0;

      for (const dimGroup of dimensionGroups) {
        if (dimGroup.includes('x')) {
          const [width, height] = dimGroup.split('x').map(d => parseFloat(d.trim()));
          if (!isNaN(width) && !isNaN(height)) {
            totalPerimeter += 2 * (width + height);
          }
        }
      }

      const segmentCount = dimensionGroups.length;
      const ledsFromPerimeter = Math.ceil(totalPerimeter / 3);
      const minimumLeds = segmentCount * 4;

      return Math.max(ledsFromPerimeter, minimumLeds);
    } catch (error) {
      return 0;
    }
  }

  getDescription(): string {
    return 'Validates PS type selection based on whether power supplies are present in the row';
  }

  getParameterSchema(): Record<string, any> {
    return {
      // No parameters needed - purely context-dependent validation
    };
  }
}