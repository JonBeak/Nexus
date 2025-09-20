// Float validation template - handles numeric input with range and format controls
// Supports parameters for min/max values, decimal places, negative numbers

import { ValidationTemplate, ValidationResult, FloatParams } from './ValidationTemplate';

export class FloatTemplate implements ValidationTemplate {
  async validate(value: string, params: FloatParams, context?: any): Promise<ValidationResult> {
    try {
      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return {
          isValid: false,
          error: 'Value is required',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      // Clean the input
      const cleanValue = value.trim();

      // Try to parse as float
      const parsedValue = parseFloat(cleanValue);

      // Check if parsing was successful
      if (isNaN(parsedValue)) {
        return {
          isValid: false,
          error: `"${cleanValue}" is not a valid number`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      // Check if the original string represents the same number (catches cases like "123abc")
      if (cleanValue !== parsedValue.toString() &&
          cleanValue !== parsedValue.toFixed(0) &&
          !this.isValidNumberFormat(cleanValue, parsedValue)) {
        return {
          isValid: false,
          error: `"${cleanValue}" contains invalid characters`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      // Validate negative numbers
      if (params.allow_negative === false && parsedValue < 0) {
        return {
          isValid: false,
          error: 'Negative numbers are not allowed',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      // Validate range constraints
      const rangeResult = this.validateRange(parsedValue, params, cleanValue);
      if (!rangeResult.isValid) {
        return rangeResult;
      }

      // Validate decimal places if specified
      if (params.decimal_places !== undefined) {
        const decimalResult = this.validateDecimalPlaces(parsedValue, params.decimal_places, cleanValue);
        if (!decimalResult.isValid) {
          return decimalResult;
        }
      }

      return {
        isValid: true,
        parsedValue: parsedValue,
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
   * Check if a string represents a valid number format
   */
  private isValidNumberFormat(input: string, parsed: number): boolean {
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
  private validateRange(value: number, params: FloatParams, originalText: string): ValidationResult {
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
  private generateExpectedFormat(params: FloatParams): string {
    const parts: string[] = [];

    // Base description
    if (params.decimal_places === 0) {
      parts.push('whole numbers only');
    } else if (params.decimal_places !== undefined) {
      parts.push(`numbers with up to ${params.decimal_places} decimal places`);
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