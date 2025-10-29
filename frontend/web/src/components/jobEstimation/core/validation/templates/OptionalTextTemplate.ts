// Optional Text validation template
// Accepts any text input (including empty)
// Returns the trimmed text as parsedValue

import { ValidationResult, ValidationContext } from './ValidationTemplate';
import { BaseValidationTemplate } from './BaseValidationTemplate';

export class OptionalTextTemplate extends BaseValidationTemplate {
  async validate(value: string, params: Record<string, unknown> = {}, context?: ValidationContext): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      // Handle empty values - empty is valid
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.createSuccess('', '', params); // Return empty string so it gets stored
      }

      // Return trimmed text as parsedValue
      const trimmedValue = value.trim();
      return this.createSuccess(trimmedValue, trimmedValue, params);
    });
  }

  protected generateExpectedFormat(_params?: Record<string, unknown>): string {
    return 'any text';
  }

  getDescription(): string {
    return 'Accepts any text input (optional, can be empty)';
  }

  getParameterSchema(): Record<string, unknown> {
    return {
      // Optional text template has no configurable parameters
    };
  }
}
