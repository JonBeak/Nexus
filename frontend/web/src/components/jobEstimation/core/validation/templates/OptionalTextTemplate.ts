// Optional Text validation template
// Accepts any text input (including empty)
// Returns the trimmed text as parsedValue

import { ValidationTemplate, ValidationResult } from './ValidationTemplate';

export class OptionalTextTemplate implements ValidationTemplate {
  async validate(value: string, params: any = {}): Promise<ValidationResult> {
    try {
      // Handle empty values - empty is valid
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return {
          isValid: true,
          parsedValue: '', // Return empty string so it gets stored
          expectedFormat: 'any text'
        };
      }

      // Return trimmed text as parsedValue
      const trimmedValue = value.trim();

      return {
        isValid: true,
        parsedValue: trimmedValue,
        expectedFormat: 'any text'
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: 'any text'
      };
    }
  }

  getDescription(): string {
    return 'Accepts any text input (optional, can be empty)';
  }

  getParameterSchema(): Record<string, any> {
    return {
      // Optional text template has no configurable parameters
    };
  }
}
