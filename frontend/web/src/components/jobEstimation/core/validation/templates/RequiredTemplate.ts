// Required validation template - ensures fields are not empty
// Supports parameters for whitespace handling

import { ValidationResult, RequiredParams, ValidationContext } from './ValidationTemplate';
import { BaseValidationTemplate } from './BaseValidationTemplate';

export class RequiredTemplate extends BaseValidationTemplate {
  async validate(value: string, params: RequiredParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      // Check if value is null, undefined, or empty string
      if (value === null || value === undefined || value === '') {
        return this.createError('This field is required', params);
      }

      // Convert to string if not already
      const stringValue = String(value);

      // Handle whitespace-only values based on parameters
      if (params.allow_whitespace === false) {
        const trimmedValue = stringValue.trim();
        if (trimmedValue === '') {
          return this.createError('Field cannot be empty or contain only spaces', params);
        }
      } else {
        // Default behavior: allow whitespace-only values
        if (stringValue === '') {
          return this.createError('This field is required', params);
        }
      }

      // Value is valid
      return this.createSuccess(stringValue, stringValue, params);
    });
  }

  protected generateExpectedFormat(_params: RequiredParams = {}): string {
    return 'Any non-empty value';
  }

  getDescription(): string {
    return 'Validates that a field contains a non-empty value, with optional whitespace handling';
  }

  getParameterSchema(): Record<string, any> {
    return {
      allow_whitespace: {
        type: 'boolean',
        required: false,
        description: 'Whether whitespace-only values are considered empty (default: true - whitespace allowed)',
        default: true
      }
    };
  }
}
