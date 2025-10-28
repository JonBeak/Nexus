// Float or Formula validation template
// Accepts either a simple number OR an arithmetic formula
// Supports formulas like: "50 + 25x9" → 275

import { ValidationTemplate, ValidationResult, FloatParams } from './ValidationTemplate';
import { parsePinFormula, looksLikeFormula } from '../utils/pinFormulaParser';

export class FloatOrFormulaTemplate implements ValidationTemplate {
  async validate(value: string, params: FloatParams = {}): Promise<ValidationResult> {
    try {
      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return {
          isValid: false,
          error: 'Value is required',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      const cleanValue = value.trim();
      let numericValue: number;

      // Check if it looks like a formula
      if (looksLikeFormula(cleanValue)) {
        // Parse as formula
        try {
          const result = parsePinFormula(cleanValue);
          numericValue = result.value;

          console.log('Formula parsed:', {
            input: cleanValue,
            result: numericValue
          });
        } catch (error) {
          return {
            isValid: false,
            error: error instanceof Error ? error.message : 'Invalid formula',
            expectedFormat: this.generateExpectedFormat(params)
          };
        }
      } else {
        // Parse as simple number
        numericValue = parseFloat(cleanValue);

        if (isNaN(numericValue)) {
          return {
            isValid: false,
            error: 'Must be a number or formula (e.g., "50 + 25x9")',
            expectedFormat: this.generateExpectedFormat(params)
          };
        }
      }

      // Validate negative constraint
      if (params.allow_negative === false && numericValue < 0) {
        return {
          isValid: false,
          error: `Result ${numericValue} is negative (only positive values allowed)`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      // Validate range constraints
      if (params.min !== undefined && numericValue < params.min) {
        return {
          isValid: false,
          error: `Result ${numericValue} is below minimum ${params.min}`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      if (params.max !== undefined && numericValue > params.max) {
        return {
          isValid: false,
          error: `Result ${numericValue} is above maximum ${params.max}`,
          expectedFormat: this.generateExpectedFormat(params)
        };
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

      return {
        isValid: true,
        parsedValue: numericValue,
        expectedFormat: this.generateExpectedFormat(params)
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }
  }

  /**
   * Generate helpful format description for users
   */
  private generateExpectedFormat(params: FloatParams = {}): string {
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
