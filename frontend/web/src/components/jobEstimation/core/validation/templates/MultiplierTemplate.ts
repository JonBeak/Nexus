// Multiplier validation template
// Validates Field 1 and Field 2 for Multiplier special item (Product Type 23)
// Both fields accept positive float values, no scientific notation

import { ValidationResult, ValidationContext } from './ValidationTemplate';
import { validateNumericInput } from '../utils/numericValidation';
import { BaseValidationTemplate } from './BaseValidationTemplate';

export class MultiplierTemplate extends BaseValidationTemplate {
  async validate(value: string, params: any = {}, context?: ValidationContext): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      // Handle empty values - at least one field must have a value
      // This is enforced at the structure level, so individual fields can be empty
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.createSuccess(undefined, undefined, params); // Empty is OK for optional multiplier field
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
        return this.createError(numericResult.error || 'Invalid multiplier format', params);
      }

      // Additional validation: multiplier must be > 0 (not just >= 0)
      if (numericResult.value !== undefined && numericResult.value <= 0) {
        return this.createError('Multiplier must be greater than 0', params);
      }

      return this.createSuccess(numericResult.value, numericResult.value, params);
    });
  }

  /**
   * Generate helpful format description for users
   */
  protected generateExpectedFormat(_params?: any): string {
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
