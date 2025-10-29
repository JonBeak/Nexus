// Conditional Dimensions validation template - validates 2D or 3D based on another field's value
// Used for Push Thru field3: validates XxYxZ if field1="Aluminum", XxY if field1="ACM"

import { ValidationResult, ValidationContext } from './ValidationTemplate';
import { BaseValidationTemplate } from './BaseValidationTemplate';
import { validateNumericInput } from '../utils/numericValidation';

export interface ConditionalDimensionsParams {
  condition_field: string;     // Field to check (e.g., "field1")
  aluminum_value: string;      // Value that triggers 3D validation (e.g., "Aluminum")
  acm_value: string;          // Value that triggers 2D validation (e.g., "ACM")
  delimiter?: string;          // Delimiter for dimensions (default: "x")
  min_value?: number;          // Minimum value for individual dimensions
  max_value_alum_x: number;    // REQUIRED: Maximum value for Aluminum X (after adjustment)
  max_value_alum_y: number;    // REQUIRED: Maximum value for Aluminum Y (after adjustment)
  max_value_acm_x: number;     // REQUIRED: Maximum value for ACM X
  max_value_acm_y: number;     // REQUIRED: Maximum value for ACM Y
  allow_negative?: boolean;    // Allow negative numbers (default: false)
}

export class ConditionalDimensionsTemplate extends BaseValidationTemplate {
  async validate(
    value: string,
    params: ConditionalDimensionsParams,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.createError('Value is required', params);
      }

      // Check if we have context with the condition field
      if (!context || !context.rowData) {
        return this.createError('Validation context required', params);
      }

      const conditionFieldValue = context.rowData[params.condition_field];

      // If condition field is not set, we can't validate
      if (!conditionFieldValue || conditionFieldValue.trim() === '') {
        return this.createError(`Please select ${params.condition_field} first`, params);
      }

      const cleanValue = value.trim();
      const cleanCondition = conditionFieldValue.trim();
      const delimiter = params.delimiter || 'x';

      // Determine validation mode based on condition field
      if (cleanCondition === params.aluminum_value) {
        // Validate as 3D (X x Y x Z)
        return this.validateThreeDimensions(cleanValue, delimiter, params);
      } else if (cleanCondition === params.acm_value) {
        // Validate as 2D (X x Y)
        return this.validateTwoDimensions(cleanValue, delimiter, params);
      } else {
        return this.createError(`Invalid ${params.condition_field} value: "${cleanCondition}"`, params);
      }
    });
  }

  /**
   * Validate as three dimensions (X x Y x Z format)
   */
  private validateThreeDimensions(
    value: string,
    delimiter: string,
    params: ConditionalDimensionsParams
  ): ValidationResult {
    const parts = value.split(delimiter);
    const cleanParts = parts.map(part => part.trim()).filter(part => part !== '');

    if (cleanParts.length !== 3) {
      return this.createError(`Expected 3 dimensions for Aluminum (X${delimiter}Y${delimiter}Z, e.g., "48${delimiter}24${delimiter}6")`, params);
    }

    const [xStr, yStr, zStr] = cleanParts;
    const parsedDimensions: number[] = [];

    // Validate X dimension (no max yet, will check after adjustment)
    const xResult = validateNumericInput(xStr, {
      allowNegative: params.allow_negative !== undefined ? params.allow_negative : false,
      minValue: params.min_value,
      allowEmpty: false
    });

    if (!xResult.isValid) {
      return this.createError(`X dimension "${xStr}": ${xResult.error}`, params);
    }

    parsedDimensions.push(xResult.value!);

    // Validate Y dimension (no max yet, will check after adjustment)
    const yResult = validateNumericInput(yStr, {
      allowNegative: params.allow_negative !== undefined ? params.allow_negative : false,
      minValue: params.min_value,
      allowEmpty: false
    });

    if (!yResult.isValid) {
      return this.createError(`Y dimension "${yStr}": ${yResult.error}`, params);
    }

    parsedDimensions.push(yResult.value!);

    // Validate Z dimension (no max yet, will check after adjustment)
    const zResult = validateNumericInput(zStr, {
      allowNegative: params.allow_negative !== undefined ? params.allow_negative : false,
      minValue: params.min_value,
      allowEmpty: false
    });

    if (!zResult.isValid) {
      return this.createError(`Z dimension "${zStr}": ${zResult.error}`, params);
    }

    parsedDimensions.push(zResult.value!);

    // Check adjusted dimensions for Aluminum (REQUIRED)
    const x = parsedDimensions[0];
    const y = parsedDimensions[1];
    const z = parsedDimensions[2];

    // Calculate adjusted dimensions: Length = X + Z*2, Width = Y + Z*2
    const adjustedX = x + z * 2;
    const adjustedY = y + z * 2;

    // Normalize: longest dimension first
    const normalizedX = Math.max(adjustedX, adjustedY);
    const normalizedY = Math.min(adjustedX, adjustedY);

    if (normalizedX > params.max_value_alum_x) {
      return this.createError(`Adjusted X dimension (${normalizedX.toFixed(1)}") exceeds maximum ${params.max_value_alum_x}"`, params);
    }

    if (normalizedY > params.max_value_alum_y) {
      return this.createError(`Adjusted Y dimension (${normalizedY.toFixed(1)}") exceeds maximum ${params.max_value_alum_y}"`, params);
    }

    // Return as tuple [X, Y, Z]
    return this.createSuccess(parsedDimensions as [number, number, number], parsedDimensions as [number, number, number], params);
  }

  /**
   * Validate as two dimensions (X x Y format)
   */
  private validateTwoDimensions(
    value: string,
    delimiter: string,
    params: ConditionalDimensionsParams
  ): ValidationResult {
    const parts = value.split(delimiter);
    const cleanParts = parts.map(part => part.trim()).filter(part => part !== '');

    if (cleanParts.length !== 2) {
      return this.createError(`Expected 2 dimensions for ACM (X${delimiter}Y, e.g., "48${delimiter}24")`, params);
    }

    const [xStr, yStr] = cleanParts;
    const parsedDimensions: number[] = [];

    // Validate X dimension for ACM (REQUIRED)
    const xResult = validateNumericInput(xStr, {
      allowNegative: params.allow_negative !== undefined ? params.allow_negative : false,
      minValue: params.min_value,
      maxValue: params.max_value_acm_x,
      allowEmpty: false
    });

    if (!xResult.isValid) {
      return this.createError(`X dimension "${xStr}": ${xResult.error}`, params);
    }

    parsedDimensions.push(xResult.value!);

    // Validate Y dimension for ACM (REQUIRED)
    const yResult = validateNumericInput(yStr, {
      allowNegative: params.allow_negative !== undefined ? params.allow_negative : false,
      minValue: params.min_value,
      maxValue: params.max_value_acm_y,
      allowEmpty: false
    });

    if (!yResult.isValid) {
      return this.createError(`Y dimension "${yStr}": ${yResult.error}`, params);
    }

    parsedDimensions.push(yResult.value!);

    // Return as tuple [X, Y]
    return this.createSuccess(parsedDimensions as [number, number], parsedDimensions as [number, number], params);
  }

  /**
   * Generate helpful format description for users
   */
  protected generateExpectedFormat(params: ConditionalDimensionsParams, context?: ValidationContext): string {
    const delimiter = params.delimiter || 'x';

    // If we have context, show specific format based on condition field
    if (context && context.rowData && params.condition_field) {
      const conditionValue = context.rowData[params.condition_field];

      if (conditionValue === params.aluminum_value) {
        return `Three dimensions for Aluminum: X${delimiter}Y${delimiter}Z (e.g., "48${delimiter}24${delimiter}6")`;
      } else if (conditionValue === params.acm_value) {
        return `Two dimensions for ACM: X${delimiter}Y (e.g., "48${delimiter}24")`;
      }
    }

    // Generic format if condition field not set
    return `Dimensions depend on ${params.condition_field}:\n• ${params.aluminum_value}: X${delimiter}Y${delimiter}Z (3D)\n• ${params.acm_value}: X${delimiter}Y (2D)`;
  }

  getDescription(): string {
    return 'Validates dimensions conditionally based on another field - 3D for Aluminum, 2D for ACM';
  }

  getParameterSchema(): Record<string, any> {
    return {
      condition_field: {
        type: 'string',
        required: true,
        description: 'Field name to check for condition (e.g., "field1")'
      },
      aluminum_value: {
        type: 'string',
        required: true,
        description: 'Value that triggers 3D validation'
      },
      acm_value: {
        type: 'string',
        required: true,
        description: 'Value that triggers 2D validation'
      },
      min_value: {
        type: 'number',
        required: false,
        description: 'Minimum value for individual dimensions'
      },
      max_value_alum_x: {
        type: 'number',
        required: true,
        description: 'Maximum value for Aluminum X dimension (after Z adjustment)'
      },
      max_value_alum_y: {
        type: 'number',
        required: true,
        description: 'Maximum value for Aluminum Y dimension (after Z adjustment)'
      },
      max_value_acm_x: {
        type: 'number',
        required: true,
        description: 'Maximum value for ACM X dimension'
      },
      max_value_acm_y: {
        type: 'number',
        required: true,
        description: 'Maximum value for ACM Y dimension'
      },
      allow_negative: {
        type: 'boolean',
        required: false,
        description: 'Allow negative numbers (default: false)',
        default: false
      },
      delimiter: {
        type: 'string',
        required: false,
        description: 'Delimiter for dimensions (default: "x")',
        default: 'x'
      }
    };
  }
}
