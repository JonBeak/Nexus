// Two Dimensions validation template - handles 2D dimensions (X x Y format) ONLY
// Used for fields that require explicit width and height dimensions
// Does NOT accept single float values

import { ValidationTemplate, ValidationResult } from './ValidationTemplate';
import { validateNumericInput } from '../utils/numericValidation';

export interface TwoDimensionsParams {
  min_value?: number;          // Minimum value for individual dimensions
  max_value?: number;          // Maximum value for X dimension
  max_value_y?: number;        // Maximum value for Y dimension (when different from X)
  max_area?: number;           // Maximum area (X * Y) in square inches
  allow_negative?: boolean;    // Allow negative numbers (default: false)
  delimiter?: string;          // Delimiter for dimensions (default: "x")
}

export class TwoDimensionsTemplate implements ValidationTemplate {
  async validate(value: string, params: TwoDimensionsParams = {}): Promise<ValidationResult> {
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

      // Parse as dimensions (X x Y) - ONLY format accepted
      return this.parseAsDimensions(cleanValue, delimiter, params);

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }
  }

  /**
   * Parse value as dimensions (X x Y format)
   * Returns an array [x, y] if successful
   */
  private parseAsDimensions(value: string, delimiter: string, params: TwoDimensionsParams): ValidationResult {
    // Must contain delimiter
    if (!value.includes(delimiter)) {
      return {
        isValid: false,
        error: `Value must contain "${delimiter}" separator for dimensions (e.g., "48${delimiter}24")`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    const parts = value.split(delimiter);
    const cleanParts = parts.map(part => part.trim()).filter(part => part !== '');

    // Must have exactly 2 parts (X and Y)
    if (cleanParts.length !== 2) {
      return {
        isValid: false,
        error: `Expected exactly 2 dimensions separated by "${delimiter}"`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    const [xStr, yStr] = cleanParts;
    const parsedDimensions: number[] = [];

    // Validate X dimension
    const xResult = validateNumericInput(xStr, {
      allowNegative: params.allow_negative !== false,
      minValue: params.min_value,
      maxValue: params.max_value,
      allowEmpty: false
    });

    if (!xResult.isValid) {
      return {
        isValid: false,
        error: `X dimension "${xStr}": ${xResult.error}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    parsedDimensions.push(xResult.value!);

    // Validate Y dimension (use max_value_y if specified, otherwise max_value)
    const yResult = validateNumericInput(yStr, {
      allowNegative: params.allow_negative !== false,
      minValue: params.min_value,
      maxValue: params.max_value_y !== undefined ? params.max_value_y : params.max_value,
      allowEmpty: false
    });

    if (!yResult.isValid) {
      return {
        isValid: false,
        error: `Y dimension "${yStr}": ${yResult.error}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    parsedDimensions.push(yResult.value!);

    // Check max area if specified
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

    // Return as tuple [x, y]
    return {
      isValid: true,
      parsedValue: parsedDimensions as [number, number],
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Generate helpful format description for users
   */
  private generateExpectedFormat(params: TwoDimensionsParams): string {
    const delimiter = params.delimiter || 'x';

    let formatDesc = `Dimensions in X${delimiter}Y format (e.g., "48${delimiter}24")`;

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
    return 'Validates two dimensions in X x Y format (does not accept single float values)';
  }

  getParameterSchema(): Record<string, any> {
    return {
      min_value: {
        type: 'number',
        required: false,
        description: 'Minimum value for each dimension'
      },
      max_value: {
        type: 'number',
        required: false,
        description: 'Maximum value for X dimension'
      },
      max_value_y: {
        type: 'number',
        required: false,
        description: 'Maximum value for Y dimension (uses max_value if not specified)'
      },
      max_area: {
        type: 'number',
        required: false,
        description: 'Maximum area in square inches (X * Y)'
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
