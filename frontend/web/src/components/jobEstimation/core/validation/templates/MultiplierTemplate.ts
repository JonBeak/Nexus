// Multiplier validation template
// Validates Field 1 and Field 2 for Multiplier special item (Product Type 23)
// Both fields accept positive float values, no scientific notation

import { ValidationTemplate, ValidationResult } from './ValidationTemplate';
import { validateNumericInput } from '../utils/numericValidation';

export class MultiplierTemplate implements ValidationTemplate {
  async validate(value: string, params: any = {}): Promise<ValidationResult> {
    try {
      // Handle empty values - at least one field must have a value
      // This is enforced at the structure level, so individual fields can be empty
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return {
          isValid: true, // Empty is OK for optional multiplier field
          parsedValue: undefined,
          expectedFormat: this.generateExpectedFormat()
        };
      }

      // Clean the input
      const cleanValue = value.trim();

      // Use strict numeric validation
      // - Positive values only (multiplier must be > 0)
      // - No scientific notation (user-friendly input)
      // - Decimals allowed (e.g., 1.5x multiplier)
      const numericResult = validateNumericInput(cleanValue, {
        allowNegative: false,          // Multipliers must be positive
        minValue: 0,                   // Zero is technically invalid but caught below
        maxValue: undefined,           // No upper limit
        decimalPlaces: undefined,      // Allow any decimal precision
        allowEmpty: false
      });

      if (!numericResult.isValid) {
        return {
          isValid: false,
          error: numericResult.error || 'Invalid multiplier format',
          expectedFormat: this.generateExpectedFormat()
        };
      }

      // Additional validation: multiplier must be > 0 (not just >= 0)
      if (numericResult.value !== undefined && numericResult.value <= 0) {
        return {
          isValid: false,
          error: 'Multiplier must be greater than 0',
          expectedFormat: this.generateExpectedFormat()
        };
      }

      return {
        isValid: true,
        parsedValue: numericResult.value,
        expectedFormat: this.generateExpectedFormat()
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: this.generateExpectedFormat()
      };
    }
  }

  /**
   * Generate helpful format description for users
   */
  private generateExpectedFormat(): string {
    return 'positive number (e.g., 2, 1.5, 3.25)';
  }

  getDescription(): string {
    return 'Validates positive numeric multiplier values (no scientific notation, decimals allowed)';
  }

  getParameterSchema(): Record<string, any> {
    return {
      // Multiplier template has no configurable parameters
      // It always validates positive numbers with decimals
    };
  }
}
