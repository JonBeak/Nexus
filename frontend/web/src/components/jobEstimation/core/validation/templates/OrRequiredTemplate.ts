// OrRequired validation template
// Validates that at least one of specified fields is filled when this field has a value
// Used for bidirectional OR dependencies (e.g., "if UnitPrice exists, ProductName OR Description required")
// Optionally validates the value format (e.g., float)

import { ValidationTemplate, ValidationResult, ValidationContext, FloatParams } from './ValidationTemplate';
import { validateNumericInput } from '../utils/numericValidation';

export interface OrRequiredParams {
  required_fields: number[]; // Field numbers (1-10) where at least one must be filled
  field_labels?: string[]; // Optional human-readable labels for error messages
  validate_as?: 'float' | 'text'; // Optional: validate value format (default: 'text')
  float_params?: FloatParams; // Optional: float validation parameters (when validate_as = 'float')
}

export class OrRequiredTemplate implements ValidationTemplate {
  async validate(
    value: string,
    params: OrRequiredParams,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    try {
      // If current field is empty, validation passes (optional field)
      if (!value || value.trim() === '') {
        return {
          isValid: true,
          parsedValue: value,
          expectedFormat: 'Optional field'
        };
      }

      const cleanValue = value.trim();

      // STEP 1: Validate value format if specified
      if (params.validate_as === 'float') {
        const floatParams = params.float_params || {};
        const numericResult = validateNumericInput(cleanValue, {
          allowNegative: floatParams.allow_negative !== false,
          minValue: floatParams.min,
          maxValue: floatParams.max,
          decimalPlaces: typeof floatParams.decimal_places === 'string'
            ? parseInt(floatParams.decimal_places, 10)
            : floatParams.decimal_places,
          allowEmpty: false
        });

        if (!numericResult.isValid) {
          return {
            isValid: false,
            error: numericResult.error || 'Invalid number format',
            expectedFormat: this.generateFloatFormat(floatParams)
          };
        }
      }

      // STEP 2: Check OR dependency - at least one required field must be filled
      if (!context || !context.rowData) {
        return {
          isValid: false,
          error: 'Validation context required for OR dependency check',
          expectedFormat: 'Context with row data'
        };
      }

      if (!params.required_fields || params.required_fields.length === 0) {
        return {
          isValid: false,
          error: 'OrRequired template requires required_fields parameter',
          expectedFormat: 'Array of field numbers'
        };
      }

      // Check if at least one of the required fields is filled
      const filledFields = params.required_fields.filter(fieldNum => {
        const fieldValue = context.rowData[`field${fieldNum}`];
        return fieldValue && fieldValue.trim() !== '';
      });

      if (filledFields.length === 0) {
        // None of the required fields are filled - validation fails
        const fieldLabels = params.field_labels && params.field_labels.length === params.required_fields.length
          ? params.field_labels.join(' OR ')
          : params.required_fields.map(num => `field${num}`).join(' OR ');

        return {
          isValid: false,
          error: `At least one of these fields is required: ${fieldLabels}`,
          expectedFormat: `Fill at least one: ${fieldLabels}`
        };
      }

      // Both format validation and OR dependency passed
      return {
        isValid: true,
        parsedValue: params.validate_as === 'float' ? parseFloat(cleanValue) : cleanValue,
        expectedFormat: 'Valid value with required fields filled'
      };

    } catch (error) {
      return {
        isValid: false,
        error: `OR validation error: ${error.message}`,
        expectedFormat: 'At least one required field must be filled'
      };
    }
  }

  /**
   * Generate format description for float validation
   */
  private generateFloatFormat(params: FloatParams = {}): string {
    const parts: string[] = ['Number'];
    const decimalPlaces = typeof params.decimal_places === 'string'
      ? parseInt(params.decimal_places, 10)
      : params.decimal_places;

    if (decimalPlaces !== undefined && !Number.isNaN(decimalPlaces)) {
      parts.push(`up to ${decimalPlaces} decimals`);
    }
    if (params.allow_negative === false) {
      parts.push('positive only');
    }
    if (params.min !== undefined) {
      parts.push(`min ${params.min}`);
    }
    if (params.max !== undefined) {
      parts.push(`max ${params.max}`);
    }

    return parts.join(', ');
  }

  getDescription(): string {
    return 'Validates that when this field has a value, at least one of the specified fields must also be filled (OR dependency)';
  }

  getParameterSchema(): Record<string, any> {
    return {
      required_fields: {
        type: 'number[]',
        required: true,
        description: 'Array of field numbers (1-10) where at least one must be filled when current field has a value',
        example: [1, 2]
      },
      field_labels: {
        type: 'string[]',
        required: false,
        description: 'Optional human-readable labels for error messages (must match length of required_fields)',
        example: ['Product Name', 'Description']
      },
      validate_as: {
        type: 'string',
        required: false,
        description: 'Optional value format validation (float or text)',
        example: 'float'
      },
      float_params: {
        type: 'object',
        required: false,
        description: 'Float validation parameters (when validate_as = "float")',
        example: { min: 0, allow_negative: false }
      }
    };
  }
}
