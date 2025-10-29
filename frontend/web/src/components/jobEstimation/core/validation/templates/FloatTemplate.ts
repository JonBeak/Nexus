// Float validation template - handles numeric input with range and format controls
// Supports parameters for min/max values, decimal places, negative numbers

import { ValidationResult, FloatParams, ValidationContext } from './ValidationTemplate';
import { validateNumericInput } from '../utils/numericValidation';
import { BaseValidationTemplate } from './BaseValidationTemplate';

export class FloatTemplate extends BaseValidationTemplate {
  async validate(value: string, params: FloatParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      // Handle empty values - FloatTemplate treats empty as error (required field)
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.createError('Value is required', params);
      }

      // Clean the input
      const cleanValue = value.trim();

      // Use strict numeric validation
      const numericResult = validateNumericInput(cleanValue, {
        allowNegative: params.allow_negative !== false,
        minValue: params.min,
        maxValue: params.max,
        decimalPlaces: typeof params.decimal_places === 'string'
          ? parseInt(params.decimal_places, 10)
          : params.decimal_places,
        allowEmpty: false
      });

      if (!numericResult.isValid) {
        return this.createError(numericResult.error || 'Invalid number format', params);
      }

      return this.createSuccess(numericResult.value, numericResult.value, params);
    });
  }

  /**
   * Check if a string represents a valid number format
   */
  private isValidNumberFormat(input: string): boolean {
    // Allow formats like: "123", "123.45", "-123", "-123.45", "123.", ".45"
    const validPatterns = [
      /^-?\d+$/,           // Integer: 123, -123
      /^-?\d+\.\d*$/,      // Decimal: 123.45, 123.
      /^-?\.\d+$/,         // Leading decimal: .45
      /^-?\d+\.?\d*e[+-]?\d+$/i  // Scientific notation: 1e5, 1.23e-4
    ];

    return validPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate numeric range constraints
   */
  private validateRange(value: number, params: FloatParams = {}, originalText: string): ValidationResult {
    if (params.min !== undefined && value < params.min) {
      return {
        isValid: false,
        error: `"${originalText}" (${value}) is below minimum ${params.min}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    if (params.max !== undefined && value > params.max) {
      return {
        isValid: false,
        error: `"${originalText}" (${value}) is above maximum ${params.max}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    return { isValid: true };
  }

  /**
   * Validate decimal places constraint
   */
  private validateDecimalPlaces(value: number, maxDecimals: number, originalText: string): ValidationResult {
    const valueStr = value.toString();
    const decimalIndex = valueStr.indexOf('.');

    if (decimalIndex !== -1) {
      const actualDecimals = valueStr.length - decimalIndex - 1;
      if (actualDecimals > maxDecimals) {
        return {
          isValid: false,
          error: `"${originalText}" has too many decimal places (max ${maxDecimals})`,
          expectedFormat: this.generateExpectedFormat({ decimal_places: maxDecimals })
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Generate helpful format description for users
   */
  protected generateExpectedFormat(params: FloatParams = {}): string {
    const parts: string[] = [];
    const decimalPlaces = typeof params.decimal_places === 'string'
      ? parseInt(params.decimal_places, 10)
      : params.decimal_places;

    // Base description
    if (decimalPlaces === 0) {
      parts.push('whole numbers only');
    } else if (decimalPlaces !== undefined && !Number.isNaN(decimalPlaces)) {
      parts.push(`numbers with up to ${decimalPlaces} decimal places`);
    } else {
      parts.push('numbers (decimals allowed)');
    }

    // Negative constraint
    if (params.allow_negative === false) {
      parts.push('positive values only');
    }

    // Range constraints
    if (params.min !== undefined && params.max !== undefined) {
      parts.push(`between ${params.min} and ${params.max}`);
    } else if (params.min !== undefined) {
      parts.push(`minimum ${params.min}`);
    } else if (params.max !== undefined) {
      parts.push(`maximum ${params.max}`);
    }

    return parts.join(', ');
  }

  getDescription(): string {
    return 'Validates numeric input with configurable range, decimal places, and negative number constraints';
  }

  getParameterSchema(): Record<string, any> {
    return {
      min: {
        type: 'number',
        required: false,
        description: 'Minimum allowed value'
      },
      max: {
        type: 'number',
        required: false,
        description: 'Maximum allowed value'
      },
      decimal_places: {
        type: 'number',
        required: false,
        description: 'Maximum number of decimal places allowed'
      },
      allow_negative: {
        type: 'boolean',
        required: false,
        description: 'Whether negative numbers are allowed (default: true)'
      }
    };
  }
}
