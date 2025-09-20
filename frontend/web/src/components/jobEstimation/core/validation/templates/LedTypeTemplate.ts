// LED Type validation template - validates LED type selection based on LED count
// Should show error if LED type is selected but there are no LEDs

import { ValidationTemplate, ValidationResult, ValidationContext } from './ValidationTemplate';

export interface LedTypeParams {
  // No specific parameters needed - validation is purely context-dependent
}

export class LedTypeTemplate implements ValidationTemplate {
  async validate(value: string, params: LedTypeParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    try {
      // Handle empty values - always valid (no selection is fine)
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return {
          isValid: true,
          parsedValue: null,
          expectedFormat: 'LED type selection (optional when LEDs are present)'
        };
      }

      const cleanValue = value.trim();

      // Check if there are any LEDs in this row
      const ledCount = this.calculateLedCount(context);

      if (ledCount === 0) {
        return {
          isValid: false,
          error: 'Cannot select LED type when there are no LEDs',
          expectedFormat: 'LED type can only be selected when LEDs are present (field3 > 0)',
          calculatedValue: { ledCount }
        };
      }

      // If there are LEDs, any selection is valid
      return {
        isValid: true,
        parsedValue: cleanValue,
        calculatedValue: { ledCount },
        expectedFormat: 'Any LED type (LEDs are present)'
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: 'LED type selection (optional when LEDs are present)'
      };
    }
  }

  /**
   * Calculate LED count from field3 and context
   */
  private calculateLedCount(context?: ValidationContext): number {
    if (!context) return 0;

    // Check calculated values first (from ValidationEngine Phase 1)
    if (context.calculatedValues?.ledCount !== undefined) {
      return context.calculatedValues.ledCount;
    }

    // Fallback: calculate from field3 directly
    const field3Value = context.rowData.field3;
    if (!field3Value || field3Value.trim() === '') {
      // Use customer default
      return context.customerPreferences?.use_leds ? this.calculateLedsFromDimensions(context) : 0;
    }

    const cleanValue = field3Value.trim().toLowerCase();

    // Handle different field3 input types
    if (cleanValue === 'no') {
      return 0;
    }

    if (cleanValue === 'yes') {
      return this.calculateLedsFromDimensions(context);
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
   * Calculate LEDs from field2 dimensions
   */
  private calculateLedsFromDimensions(context?: ValidationContext): number {
    if (!context) return 0;

    const field1 = context.rowData.field1; // Letter type
    const field2 = context.rowData.field2; // Dimensions

    if (!field1 || !field2 || field1.trim() === '' || field2.trim() === '') {
      return 0;
    }

    try {
      // Parse dimensions (could be multiple formats)
      // Simple case: assume single dimension like "12x8" -> perimeter = 2*(12+8) = 40
      // Multiple case: "12x8,15x10" -> calculate each perimeter and sum

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

      // 1 LED per 3 inches of perimeter, minimum 4 LEDs per segment
      const segmentCount = dimensionGroups.length;
      const ledsFromPerimeter = Math.ceil(totalPerimeter / 3);
      const minimumLeds = segmentCount * 4;

      return Math.max(ledsFromPerimeter, minimumLeds);
    } catch (error) {
      return 0;
    }
  }

  getDescription(): string {
    return 'Validates LED type selection based on whether LEDs are present in the row';
  }

  getParameterSchema(): Record<string, any> {
    return {
      // No parameters needed - purely context-dependent validation
    };
  }
}