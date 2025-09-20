// Required validation template - ensures fields are not empty
// Supports parameters for whitespace handling

import { ValidationTemplate, ValidationResult, RequiredParams } from './ValidationTemplate';

export class RequiredTemplate implements ValidationTemplate {
  async validate(value: string, params: RequiredParams = {}, context?: any): Promise<ValidationResult> {
    try {
      // Check if value is null, undefined, or empty string
      if (value === null || value === undefined || value === '') {
        return {
          isValid: false,
          error: 'This field is required',
          expectedFormat: 'Please enter a value'
        };
      }

      // Convert to string if not already
      const stringValue = String(value);

      // Handle whitespace-only values based on parameters
      if (params.allow_whitespace === false) {
        const trimmedValue = stringValue.trim();
        if (trimmedValue === '') {
          return {
            isValid: false,
            error: 'Field cannot be empty or contain only spaces',
            expectedFormat: 'Please enter a non-empty value'
          };
        }
      } else {
        // Default behavior: allow whitespace-only values
        if (stringValue === '') {
          return {
            isValid: false,
            error: 'This field is required',
            expectedFormat: 'Please enter a value'
          };
        }
      }

      // Value is valid
      return {
        isValid: true,
        parsedValue: stringValue,
        expectedFormat: 'Any non-empty value'
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: 'Any non-empty value'
      };
    }
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