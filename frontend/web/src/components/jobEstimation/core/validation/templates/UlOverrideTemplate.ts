// UL Override validation template - context-aware UL certification validation
// Accepts float, "yes", "no", "$amount" and determines UL requirements based on LED count

import { ValidationTemplate, ValidationResult, UlOverrideParams, ValidationContext } from './ValidationTemplate';

export class UlOverrideTemplate implements ValidationTemplate {
  async validate(value: string, params: UlOverrideParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    try {
      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        // Empty is valid - will use default behavior
        return {
          isValid: true,
          parsedValue: null,
          calculatedValue: this.calculateDefaultUlRequirement(context),
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      const cleanValue = value.trim();

      // Parse input based on type
      const parseResult = this.parseInput(cleanValue, params);
      if (!parseResult.isValid) {
        return parseResult;
      }

      // Calculate UL requirement based on parsed input and context
      const calculatedUlRequirement = this.calculateUlRequirement(parseResult.parsedValue, context);

      // Generate warnings if applicable
      const warnings = this.generateWarnings(parseResult.parsedValue, context);

      return {
        isValid: true,
        parsedValue: parseResult.parsedValue,
        calculatedValue: calculatedUlRequirement,
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
  private parseInput(value: string, params: UlOverrideParams): ValidationResult {
    const accepts = params.accepts || ['float', 'yes', 'no', 'currency'];
    const lower = value.toLowerCase();

    // Check for "yes"
    if (accepts.includes('yes') && lower === 'yes') {
      return { isValid: true, parsedValue: 'yes' };
    }

    // Check for "no"
    if (accepts.includes('no') && lower === 'no') {
      return { isValid: true, parsedValue: 'no' };
    }

    // Check for currency format: $amount
    if (accepts.includes('currency') && value.startsWith('$')) {
      const amountStr = value.substring(1);
      const amount = parseFloat(amountStr);

      if (isNaN(amount)) {
        return {
          isValid: false,
          error: 'Invalid currency format',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      if (amount < 0) {
        return {
          isValid: false,
          error: 'UL cost cannot be negative',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      return {
        isValid: true,
        parsedValue: { type: 'currency', amount: amount }
      };
    }

    // Check for numeric value (float)
    if (accepts.includes('float')) {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        if (numericValue < 0) {
          return {
            isValid: false,
            error: 'UL cost cannot be negative',
            expectedFormat: this.generateExpectedFormat(params)
          };
        }
        return {
          isValid: true,
          parsedValue: { type: 'float', amount: numericValue }
        };
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
   * Calculate UL requirement based on input and context
   */
  private calculateUlRequirement(parsedValue: any, context?: ValidationContext): any {
    if (!context) return null;

    // Handle different input types
    if (parsedValue === 'yes') {
      // Explicit yes - include UL with default cost
      return { required: true, cost: 'default' };
    }

    if (parsedValue === 'no') {
      // Explicit no - exclude UL
      return { required: false, cost: 0 };
    }

    if (typeof parsedValue === 'object' && parsedValue.type) {
      // Explicit cost override (currency or float)
      return { required: true, cost: parsedValue.amount };
    }

    // No explicit input - use default behavior
    return this.calculateDefaultUlRequirement(context);
  }

  /**
   * Calculate default UL requirement based on LED count and customer preferences
   */
  private calculateDefaultUlRequirement(context?: ValidationContext): any {
    if (!context) return null;

    const ledCount = context.calculatedValues?.ledCount || 0;

    // UL certification only applies when LEDs exist
    if (ledCount > 0 && context.customerPreferences.default_ul_requirement) {
      // Customer default: include UL when LEDs exist
      return { required: true, cost: 'default' };
    }

    // Default: no UL requirement
    return { required: false, cost: 0 };
  }

  /**
   * Generate warnings for potentially confusing input
   */
  private generateWarnings(parsedValue: any, context?: ValidationContext): string[] {
    const warnings: string[] = [];

    if (!context) return warnings;

    // Note: UL can be standalone product, so no warning for UL without LEDs
    // This is explicitly allowed per business requirements

    return warnings;
  }

  /**
   * Generate expected format description
   */
  private generateExpectedFormat(params: UlOverrideParams): string {
    const accepts = params.accepts || ['float', 'yes', 'no', 'currency'];
    const formats: string[] = [];

    if (accepts.includes('yes')) {
      formats.push('"yes" (include UL with default cost)');
    }
    if (accepts.includes('no')) {
      formats.push('"no" (no UL certification)');
    }
    if (accepts.includes('float')) {
      formats.push('number (custom UL cost)');
    }
    if (accepts.includes('currency')) {
      formats.push('$amount (custom UL cost with currency symbol)');
    }

    return `Accepts: ${formats.join(', ')}`;
  }

  getDescription(): string {
    return 'Context-aware UL certification validation with LED count dependencies and currency support';
  }

  getParameterSchema(): Record<string, any> {
    return {
      accepts: {
        type: 'array',
        items: { type: 'string', enum: ['float', 'yes', 'no', 'currency'] },
        required: false,
        description: 'Allowed input types',
        default: ['float', 'yes', 'no', 'currency']
      },
      require_symbol: {
        type: 'boolean',
        required: false,
        description: 'Whether currency input must have $ symbol',
        default: false
      }
    };
  }
}
