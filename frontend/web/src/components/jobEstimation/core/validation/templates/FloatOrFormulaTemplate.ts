// Float or Formula validation template
// Accepts either a simple number OR an arithmetic formula
// Supports formulas like: "50 + 25x9" → 275

import { ValidationResult, FloatParams, ValidationContext } from './ValidationTemplate';
import { parsePinFormula, looksLikeFormula } from '../utils/pinFormulaParser';
import { BaseValidationTemplate } from './BaseValidationTemplate';

export class FloatOrFormulaTemplate extends BaseValidationTemplate {
  async validate(value: string, params: FloatParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.createError('Value is required', params);
      }

      const cleanValue = value.trim();
      let numericValue: number;

      // Check if it looks like a formula
      if (looksLikeFormula(cleanValue)) {
        // Parse as formula
        try {
          const result = parsePinFormula(cleanValue);
          numericValue = result.value;
        } catch (error) {
          return this.createError(error instanceof Error ? error.message : 'Invalid formula', params);
        }
      } else {
        // Parse as simple number
        numericValue = parseFloat(cleanValue);

        if (isNaN(numericValue)) {
          return this.createError('Must be a number or formula (e.g., "50 + 25x9")', params);
        }
      }

      // Validate negative constraint
      if (params.allow_negative === false && numericValue < 0) {
        return this.createError(`Result ${numericValue} is negative (only positive values allowed)`, params);
      }

      // Validate range constraints
      if (params.min !== undefined && numericValue < params.min) {
        return this.createError(`Result ${numericValue} is below minimum ${params.min}`, params);
      }

      if (params.max !== undefined && numericValue > params.max) {
        return this.createError(`Result ${numericValue} is above maximum ${params.max}`, params);
      }

      // Validate decimal places
      if (params.decimal_places !== undefined) {
        const decimalPlaces = typeof params.decimal_places === 'string'
          ? parseInt(params.decimal_places, 10)
          : params.decimal_places;

        if (!isNaN(decimalPlaces) && decimalPlaces >= 0) {
          const valueStr = numericValue.toString();
          const decimalIndex = valueStr.indexOf('.');

          if (decimalIndex !== -1) {
            const actualDecimals = valueStr.length - decimalIndex - 1;
            if (actualDecimals > decimalPlaces) {
              // Round to the specified decimal places
              numericValue = parseFloat(numericValue.toFixed(decimalPlaces));
            }
          }
        }
      }

      return this.createSuccess(numericValue, numericValue, params);
    });
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
    parts.push('number or formula (e.g., "50 + 25x9")');

    if (decimalPlaces === 0) {
      parts.push('whole numbers only');
    } else if (decimalPlaces !== undefined && !Number.isNaN(decimalPlaces)) {
      parts.push(`up to ${decimalPlaces} decimal places`);
    }

    // Negative constraint
    if (params.allow_negative === false) {
      parts.push('positive values only');
    }

    // Range constraints
    if (params.min !== undefined && params.max !== undefined) {
      parts.push(`result between ${params.min} and ${params.max}`);
    } else if (params.min !== undefined) {
      parts.push(`result minimum ${params.min}`);
    } else if (params.max !== undefined) {
      parts.push(`result maximum ${params.max}`);
    }

    return parts.join(', ');
  }

  getDescription(): string {
    return 'Validates numeric input or arithmetic formula (e.g., "50 + 25x9"). Supports +, -, x, *, / operators with proper order of operations.';
  }

  getParameterSchema(): Record<string, any> {
    return {
      min: {
        type: 'number',
        required: false,
        description: 'Minimum allowed value (applied to result)'
      },
      max: {
        type: 'number',
        required: false,
        description: 'Maximum allowed value (applied to result)'
      },
      decimal_places: {
        type: 'number',
        required: false,
        description: 'Maximum number of decimal places allowed (result will be rounded)'
      },
      allow_negative: {
        type: 'boolean',
        required: false,
        description: 'Whether negative results are allowed (default: true)'
      }
    };
  }
}
