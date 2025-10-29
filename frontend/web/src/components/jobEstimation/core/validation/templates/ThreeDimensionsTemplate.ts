// Three Dimensions validation template - handles X x Y x Z format for 3D dimensions
// Used for backer products that require three dimensional specifications

import { ValidationResult } from './ValidationTemplate';
import { BaseValidationTemplate } from './BaseValidationTemplate';
import { validateNumericInput } from '../utils/numericValidation';

export interface ThreeDimensionsParams {
  min_value?: number;          // Minimum value for individual dimensions
  max_value?: number;          // Maximum value for individual dimensions (before adjustment)
  max_value_x?: number;        // Maximum value for adjusted X dimension (after X + Z*2)
  max_value_y?: number;        // Maximum value for adjusted Y dimension (after Y + Z*2)
  allow_negative?: boolean;    // Allow negative numbers (default: false)
  delimiter?: string;          // Delimiter for dimensions (default: "x")
}

export class ThreeDimensionsTemplate extends BaseValidationTemplate {
  async validate(value: string, params: ThreeDimensionsParams = {}): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.createError('Value is required', params);
      }

      const cleanValue = value.trim();
      const delimiter = params.delimiter || 'x';

      // Parse as three dimensions (X x Y x Z)
      const dimensionsResult = this.parseAsThreeDimensions(cleanValue, delimiter, params);

      return dimensionsResult;
    });
  }

  /**
   * Parse value as three dimensions (X x Y x Z format)
   * Returns an array [X, Y, Z] if successful
   */
  private parseAsThreeDimensions(value: string, delimiter: string, params: ThreeDimensionsParams): ValidationResult {
    // Split by delimiter and handle spaces
    const parts = value.split(delimiter);

    // Must have exactly 3 parts (X, Y, Z)
    const cleanParts = parts.map(part => part.trim()).filter(part => part !== '');

    if (cleanParts.length !== 3) {
      return this.createError(`Expected exactly 3 dimensions separated by "${delimiter}" (e.g., "48${delimiter}24${delimiter}6")`, params);
    }

    const [xStr, yStr, zStr] = cleanParts;
    const parsedDimensions: number[] = [];

    // Validate X dimension
    const xResult = validateNumericInput(xStr, {
      allowNegative: params.allow_negative !== undefined ? params.allow_negative : false,
      minValue: params.min_value,
      maxValue: params.max_value,
      allowEmpty: false
    });

    if (!xResult.isValid) {
      return this.createError(`X dimension "${xStr}": ${xResult.error}`, params);
    }

    parsedDimensions.push(xResult.value!);

    // Validate Y dimension
    const yResult = validateNumericInput(yStr, {
      allowNegative: params.allow_negative !== undefined ? params.allow_negative : false,
      minValue: params.min_value,
      maxValue: params.max_value,
      allowEmpty: false
    });

    if (!yResult.isValid) {
      return this.createError(`Y dimension "${yStr}": ${yResult.error}`, params);
    }

    parsedDimensions.push(yResult.value!);

    // Validate Z dimension
    const zResult = validateNumericInput(zStr, {
      allowNegative: params.allow_negative !== undefined ? params.allow_negative : false,
      minValue: params.min_value,
      maxValue: params.max_value,
      allowEmpty: false
    });

    if (!zResult.isValid) {
      return this.createError(`Z dimension "${zStr}": ${zResult.error}`, params);
    }

    parsedDimensions.push(zResult.value!);

    // Check adjusted dimensions if max values specified
    if (params.max_value_x !== undefined || params.max_value_y !== undefined) {
      const x = parsedDimensions[0];
      const y = parsedDimensions[1];
      const z = parsedDimensions[2];

      // Calculate adjusted dimensions: Length = X + Z*2, Width = Y + Z*2
      const adjustedX = x + z * 2;
      const adjustedY = y + z * 2;

      // Normalize: longest dimension first
      const normalizedX = Math.max(adjustedX, adjustedY);
      const normalizedY = Math.min(adjustedX, adjustedY);

      if (params.max_value_x !== undefined && normalizedX > params.max_value_x) {
        return this.createError(`Adjusted X dimension (${normalizedX.toFixed(1)}") exceeds maximum ${params.max_value_x}"`, params);
      }

      if (params.max_value_y !== undefined && normalizedY > params.max_value_y) {
        return this.createError(`Adjusted Y dimension (${normalizedY.toFixed(1)}") exceeds maximum ${params.max_value_y}"`, params);
      }
    }

    // Return as tuple [X, Y, Z]
    return this.createSuccess(parsedDimensions as [number, number, number], parsedDimensions as [number, number, number], params);
  }

  /**
   * Generate helpful format description for users
   */
  protected generateExpectedFormat(params: ThreeDimensionsParams): string {
    const delimiter = params.delimiter || 'x';

    let formatDesc = `Three dimensions in X${delimiter}Y${delimiter}Z format (e.g., "48${delimiter}24${delimiter}6")`;

    // Add constraints
    const constraints: string[] = [];
    if (params.min_value !== undefined) {
      constraints.push(`min: ${params.min_value}"`);
    }
    if (params.max_value !== undefined) {
      constraints.push(`max per dimension: ${params.max_value}"`);
    }
    if (params.max_value_x !== undefined && params.max_value_y !== undefined) {
      constraints.push(`adjusted max: ${params.max_value_x}" × ${params.max_value_y}"`);
    }
    if (params.allow_negative === false || params.allow_negative === undefined) {
      constraints.push('positive values only');
    }

    if (constraints.length > 0) {
      formatDesc += `\nConstraints: ${constraints.join(', ')}`;
    }

    return formatDesc;
  }

  getDescription(): string {
    return 'Validates three-dimensional input in X x Y x Z format, used for backer products';
  }

  getParameterSchema(): Record<string, any> {
    return {
      min_value: {
        type: 'number',
        required: false,
        description: 'Minimum value for individual dimensions'
      },
      max_value: {
        type: 'number',
        required: false,
        description: 'Maximum value for individual dimensions'
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
