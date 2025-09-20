// LED Override validation template - context-aware LED count validation
// Accepts float, "yes", "no" and calculates LED count based on business logic

import { ValidationTemplate, ValidationResult, LedOverrideParams, ValidationContext } from './ValidationTemplate';

export class LedOverrideTemplate implements ValidationTemplate {
  async validate(value: string, params: LedOverrideParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    try {
      // DEBUG: LedOverrideTemplate validation

      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        // Empty is valid - will use default behavior
        return {
          isValid: true,
          parsedValue: null,
          calculatedValue: this.calculateDefaultLedCount(context),
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      const cleanValue = value.trim().toLowerCase();

      // Parse input based on type
      const parseResult = this.parseInput(cleanValue, params);
      if (!parseResult.isValid) {
        return parseResult;
      }

      // Calculate LED count based on parsed input and context
      const calculatedLedCount = this.calculateLedCount(parseResult.parsedValue, context);

      // Generate warnings if applicable
      const warnings = this.generateWarnings(parseResult.parsedValue, context);

      return {
        isValid: true,
        parsedValue: parseResult.parsedValue,
        calculatedValue: calculatedLedCount,
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
  private parseInput(value: string, params: LedOverrideParams): ValidationResult {
    const accepts = params.accepts || ['float', 'yes', 'no'];
    // Check for "yes"
    if (accepts.includes('yes') && value === 'yes') {
      return { isValid: true, parsedValue: 'yes' };
    }

    // Check for "no"
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
            error: 'LED count cannot be negative',
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
   * Calculate LED count based on input and context
   */
  private calculateLedCount(parsedValue: any, context?: ValidationContext): number {
    if (!context) return 0;

    const hasChannelLetters = this.hasChannelLetters(context);

    // Handle different input types
    if (typeof parsedValue === 'number') {
      // Explicit numeric override
      return parsedValue;
    }

    if (parsedValue === 'yes') {
      if (hasChannelLetters) {
        // Calculate from channel letters data
        return this.calculateLedsFromChannelLetters(context);
      } else {
        // No channel letters to calculate from
        return 0;
      }
    }

    if (parsedValue === 'no') {
      // Explicit override to no LEDs
      return 0;
    }

    // No explicit input - use default behavior
    return this.calculateDefaultLedCount(context);
  }

  /**
   * Calculate default LED count based on customer preferences and context
   */
  private calculateDefaultLedCount(context?: ValidationContext): number {
    if (!context) return 0;

    const hasChannelLetters = this.hasChannelLetters(context);

    if (hasChannelLetters && context.customerPreferences.use_leds) {
      // Customer default: include LEDs with channel letters
      return this.calculateLedsFromChannelLetters(context);
    }

    // Default: no LEDs
    return 0;
  }

  /**
   * Check if channel letters exist (field1 and field2 filled)
   */
  private hasChannelLetters(context: ValidationContext): boolean {
    const field1 = context.rowData.field1;
    const field2 = context.rowData.field2;
    return !!(field1 && field1.trim() && field2 && field2.trim());
  }

  /**
   * Calculate LED count from channel letters data (field2)
   */
  private calculateLedsFromChannelLetters(context: ValidationContext): number {
    const letterData = context.rowData.field2;
    if (!letterData || !letterData.trim()) return 0;

    try {
      // Parse letter data to calculate LED count
      // Format expected: "width x height, width x height" or similar
      const segments = letterData.split(',').map(s => s.trim());
      let totalLedCount = 0;

      for (const segment of segments) {
        const dimensions = segment.split('x').map(d => parseFloat(d.trim()));
        if (dimensions.length >= 2 && !isNaN(dimensions[0]) && !isNaN(dimensions[1])) {
          // Simple LED calculation: perimeter-based
          const perimeter = 2 * (dimensions[0] + dimensions[1]);
          const ledsForSegment = Math.ceil(perimeter / 3); // Rough estimate: 1 LED per 3 inches
          totalLedCount += ledsForSegment;
        }
      }

      return Math.max(totalLedCount, 4); // Minimum 4 LEDs
    } catch (error) {
      console.warn('Error calculating LEDs from channel letters:', error);
      return 4; // Fallback minimum
    }
  }

  /**
   * Generate warnings for potentially confusing input
   */
  private generateWarnings(parsedValue: any, context?: ValidationContext): string[] {
    const warnings: string[] = [];

    if (!context) return warnings;

    const hasChannelLetters = this.hasChannelLetters(context);

    // Warning: yes/no without channel letters
    if ((parsedValue === 'yes' || parsedValue === 'no') && !hasChannelLetters) {
      warnings.push('yes/no has no effect without channel letters data');
    }

    return warnings;
  }

  /**
   * Generate expected format description
   */
  private generateExpectedFormat(params: LedOverrideParams): string {
    const accepts = params.accepts || ['float', 'yes', 'no'];
    const formats: string[] = [];

    if (accepts.includes('float')) {
      formats.push('number (LED count)');
    }
    if (accepts.includes('yes')) {
      formats.push('"yes" (calculate from channel letters)');
    }
    if (accepts.includes('no')) {
      formats.push('"no" (no LEDs)');
    }

    return `Accepts: ${formats.join(', ')}`;
  }

  getDescription(): string {
    return 'Context-aware LED count validation with customer preferences and channel letters integration';
  }

  getParameterSchema(): Record<string, any> {
    return {
      accepts: {
        type: 'array',
        items: { type: 'string', enum: ['float', 'yes', 'no'] },
        required: false,
        description: 'Allowed input types',
        default: ['float', 'yes', 'no']
      }
    };
  }
}