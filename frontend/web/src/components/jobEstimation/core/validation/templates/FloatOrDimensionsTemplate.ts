// Float or Dimensions validation template - handles either a float (total sqft) or 2D dimensions (WxH format)
// Used for digital print fields that can accept either:
// - A single float representing total square footage (e.g., "15.5")
// - Two dimensions in WxH format (e.g., "24x36")

import { ValidationTemplate, ValidationResult } from './ValidationTemplate';
import { validateNumericInput } from '../utils/numericValidation';

export interface FloatOrDimensionsParams {
  min_value?: number;          // Minimum value for float or individual dimensions
  max_value?: number;          // Maximum value for float or X dimension
  max_value_y?: number;        // Maximum value for Y dimension (when different from X)
  max_area?: number;           // Maximum area (X * Y) in square inches for dimensions
  allow_negative?: boolean;    // Allow negative numbers (default: false)
  delimiter?: string;          // Delimiter for dimensions (default: "x")
}

export class FloatOrDimensionsTemplate implements ValidationTemplate {
  async validate(value: string, params: FloatOrDimensionsParams = {}): Promise<ValidationResult> {
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
      const delimiter = params.delimiter || 'x';

      // First, try to parse as dimensions (WxH)
      if (cleanValue.includes(delimiter)) {
        const dimensionsResult = this.tryParseAsDimensions(cleanValue, delimiter, params);
        if (dimensionsResult.isValid) {
          return dimensionsResult;
        }
      }

      // If not dimensions or failed, try to parse as a simple float (total sqft)
      const floatResult = this.tryParseAsFloat(cleanValue, params);
      if (floatResult.isValid) {
        return floatResult;
      }

      // Neither format worked
      return {
        isValid: false,
        error: 'Value must be either a number (total sqft) or dimensions (WxH)',
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
   * Try to parse value as dimensions (WxH format)
   * Returns an array [width, height] if successful
   */
  private tryParseAsDimensions(value: string, delimiter: string, params: FloatOrDimensionsParams): ValidationResult {
    const parts = value.split(delimiter);

    // Must have exactly 2 parts (width and height)
    const cleanParts = parts.map(part => part.trim()).filter(part => part !== '');

    if (cleanParts.length !== 2) {
      return {
        isValid: false,
        error: `Expected exactly 2 dimensions separated by "${delimiter}"`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    const [widthStr, heightStr] = cleanParts;
    const parsedDimensions: number[] = [];

    // Validate width
    const widthResult = validateNumericInput(widthStr, {
      allowNegative: params.allow_negative !== false,
      minValue: params.min_value,
      maxValue: params.max_value,
      allowEmpty: false
    });

    if (!widthResult.isValid) {
      return {
        isValid: false,
        error: `Width "${widthStr}": ${widthResult.error}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    parsedDimensions.push(widthResult.value!);

    // Validate height (use max_value_y if specified, otherwise max_value)
    const heightResult = validateNumericInput(heightStr, {
      allowNegative: params.allow_negative !== false,
      minValue: params.min_value,
      maxValue: params.max_value_y !== undefined ? params.max_value_y : params.max_value,
      allowEmpty: false
    });

    if (!heightResult.isValid) {
      return {
        isValid: false,
        error: `Height "${heightStr}": ${heightResult.error}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    parsedDimensions.push(heightResult.value!);

    // Check max area if specified (for dimensions only, not float)
    if (params.max_area !== undefined) {
      const area = parsedDimensions[0] * parsedDimensions[1];
      if (area > params.max_area) {
        return {
          isValid: false,
          error: `Area (${parsedDimensions[0]} × ${parsedDimensions[1]} = ${area.toFixed(2)} sq in) exceeds maximum of ${params.max_area} sq in`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }
    }

    // Return as tuple [width, height]
    return {
      isValid: true,
      parsedValue: parsedDimensions as [number, number],
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Try to parse value as a simple float (total square footage)
   */
  private tryParseAsFloat(value: string, params: FloatOrDimensionsParams): ValidationResult {
    // Use strict numeric validation for float parsing
    const numericResult = validateNumericInput(value, {
      allowNegative: params.allow_negative !== false,
      minValue: params.min_value,
      maxValue: params.max_value,
      allowEmpty: false
    });

    if (!numericResult.isValid) {
      return { isValid: false };
    }

    return {
      isValid: true,
      parsedValue: numericResult.value,
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Generate helpful format description for users
   */
  private generateExpectedFormat(params: FloatOrDimensionsParams): string {
    const delimiter = params.delimiter || 'x';

    let formatDesc = 'Either:\n';
    formatDesc += '• Total square footage (e.g., "15.5", "32")\n';
    formatDesc += `• Dimensions in W${delimiter}H format (e.g., "24${delimiter}36")`;

    // Add constraints
    const constraints: string[] = [];
    if (params.min_value !== undefined) {
      constraints.push(`min: ${params.min_value}"`);
    }
    if (params.max_value !== undefined) {
      if (params.max_value_y !== undefined && params.max_value !== params.max_value_y) {
        constraints.push(`max: ${params.max_value}" × ${params.max_value_y}"`);
      } else {
        constraints.push(`max: ${params.max_value}"`);
      }
    }
    if (params.max_area !== undefined) {
      constraints.push(`max area: ${params.max_area} sq in`);
    }
    if (params.allow_negative === false) {
      constraints.push('no negative numbers');
    }

    if (constraints.length > 0) {
      formatDesc += `\nConstraints: ${constraints.join(', ')}`;
    }

    return formatDesc;
  }

  getDescription(): string {
    return 'Validates either a single float (total sqft) or two dimensions in WxH format, commonly used for digital print sizing';
  }

  getParameterSchema(): Record<string, any> {
    return {
      min_value: {
        type: 'number',
        required: false,
        description: 'Minimum value for numbers'
      },
      max_value: {
        type: 'number',
        required: false,
        description: 'Maximum value for numbers'
      },
      max_area: {
        type: 'number',
        required: false,
        description: 'Maximum area in square inches (X * Y) for dimensions'
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
