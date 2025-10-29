// UL Override validation template - validates UL field input format for Channel Letters
// Accepts "yes", "no", float numbers, or "$float" format with redundancy checking
// NOTE: 0 and $0 are automatically converted to "no"

import { ValidationResult, ValidationContext } from './ValidationTemplate';
import { BaseValidationTemplate } from './BaseValidationTemplate';

export class UlOverrideTemplate extends BaseValidationTemplate {
  async validate(value: string, _params: Record<string, unknown> = {}, context?: ValidationContext): Promise<ValidationResult> {
    return this.wrapValidation(_params, async () => {
      // Handle empty values - always valid
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.handleEmptyValue(null, _params);
      }

      const cleanValue = value.trim();

      // Parse and validate input
      const parseResult = this.parseInput(cleanValue, context, _params);
      if (!parseResult.isValid) {
        return parseResult;
      }

      // Check for redundancy with customer preferences
      const redundancyCheck = this.checkRedundancy(parseResult.parsedValue, context, _params);
      if (!redundancyCheck.isValid) {
        return redundancyCheck;
      }

      return this.createSuccess(parseResult.parsedValue, parseResult.parsedValue, _params);
    });
  }

  /**
   * Parse input value and validate format
   */
  private parseInput(value: string, _context: ValidationContext | undefined, params: Record<string, unknown>): ValidationResult {
    const lower = value.toLowerCase();

    // Check for "yes"
    if (lower === 'yes') {
      return { isValid: true, parsedValue: 'yes' };
    }

    // Check for "no"
    if (lower === 'no') {
      return { isValid: true, parsedValue: 'no' };
    }

    // Check for currency format: $amount or -$amount or $-amount
    if (value.includes('$')) {
      // Handle different negative formats
      let cleanedValue = value.replace(/\s/g, ''); // Remove spaces
      let isNegative = false;
      let amountStr = '';

      if (cleanedValue.startsWith('-$')) {
        // Format: -$123.45
        isNegative = true;
        amountStr = cleanedValue.substring(2);
      } else if (cleanedValue.startsWith('$-')) {
        // Format: $-123.45
        isNegative = true;
        amountStr = cleanedValue.substring(2);
      } else if (cleanedValue.startsWith('$')) {
        // Format: $123.45
        amountStr = cleanedValue.substring(1);
        // Check if amount itself is negative
        if (amountStr.startsWith('-')) {
          isNegative = true;
          amountStr = amountStr.substring(1);
        }
      } else {
        return this.createError('Invalid currency format. Use $123.45, -$123.45, or $-123.45', params);
      }

      // Validate the numeric part
      const numValue = this.validateNumericFormat(amountStr);
      if (numValue === null) {
        return this.createError('Invalid number format in currency value', params);
      }

      const finalValue = isNegative ? -numValue : numValue;

      // Treat $0 as "no"
      if (finalValue === 0) {
        return {
          isValid: true,
          parsedValue: 'no'
        };
      }

      return {
        isValid: true,
        parsedValue: { type: 'currency', amount: finalValue }
      };
    }

    // Check for plain numeric value (float)
    const numValue = this.validateNumericFormat(value);
    if (numValue !== null) {
      // Treat 0 as "no"
      if (numValue === 0) {
        return {
          isValid: true,
          parsedValue: 'no'
        };
      }

      return {
        isValid: true,
        parsedValue: { type: 'float', amount: numValue }
      };
    }

    // Invalid input
    return this.createError('Invalid input. Expected: "yes", "no", number, or $amount', params);
  }

  /**
   * Validate numeric format (no scientific notation)
   */
  private validateNumericFormat(value: string): number | null {
    // Remove spaces
    const cleaned = value.trim();

    // Check for scientific notation
    if (cleaned.toLowerCase().includes('e')) {
      return null; // Reject scientific notation
    }

    // Check for valid number format
    const isNegative = cleaned.startsWith('-');
    const absoluteValue = isNegative ? cleaned.substring(1) : cleaned;

    // Validate format: optional digits, optional decimal point, optional digits
    // Must have at least one digit somewhere
    const validFormat = /^\d*\.?\d+$/.test(absoluteValue);
    if (!validFormat) {
      return null;
    }

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      return null;
    }

    return parsed;
  }

  /**
   * Check for redundancy with customer preferences
   */
  private checkRedundancy(parsedValue: any, context: ValidationContext | undefined, params: Record<string, unknown>): ValidationResult {
    if (!context || !context.customerPreferences) {
      // Can't check redundancy without customer preferences
      return { isValid: true, parsedValue };
    }

    const customerULPref = context.customerPreferences.pref_ul_required;

    // Check if yes/no matches customer preference (redundant)
    if (parsedValue === 'yes' && customerULPref === true) {
      return this.createError('Redundant: "yes" matches customer UL preference', params);
    }

    if (parsedValue === 'no' && customerULPref === false) {
      return this.createError('Redundant: "no" matches customer UL preference', params);
    }

    // Numeric values are never redundant
    return { isValid: true, parsedValue };
  }

  /**
   * Generate expected format description
   */
  protected generateExpectedFormat(_params?: Record<string, unknown>): string {
    return 'Accepts: "yes", "no", number (0 = no), or $amount';
  }

  getDescription(): string {
    return 'UL field validation for Channel Letters - validates format and checks redundancy';
  }

  getParameterSchema(): Record<string, any> {
    return {
      productTypeId: {
        type: 'number',
        required: false,
        description: 'Product type ID for product-specific validation',
        default: 1
      }
    };
  }
}
