// Float or Groups validation template - handles either a float or specific group format
// Supports: float (e.g., "32") or groups format (e.g., "10,. . . . . 6,")

import { ValidationTemplate, ValidationResult } from './ValidationTemplate';

export interface FloatOrGroupsParams {
  min_value?: number;          // Minimum value for float or individual numbers
  max_value?: number;          // Maximum value for float or individual numbers
  allow_negative?: boolean;    // Allow negative numbers (default: true)
  group_separator?: string;    // Separator between groups (default: ". . . . . ")
  number_separator?: string;   // Separator between numbers (default: ",")
}

export class FloatOrGroupsTemplate implements ValidationTemplate {
  async validate(value: string, params: FloatOrGroupsParams = {}): Promise<ValidationResult> {
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
      const groupSeparator = params.group_separator || '. . . . . ';
      const numberSeparator = params.number_separator || ',';

      // First, try to parse as a simple float
      const floatResult = this.tryParseAsFloat(cleanValue, params);
      if (floatResult.isValid) {
        return floatResult;
      }

      // If not a float, try to parse as groups format
      const groupsResult = this.tryParseAsGroups(cleanValue, params, groupSeparator, numberSeparator);
      if (groupsResult.isValid) {
        return groupsResult;
      }

      // Neither format worked
      return {
        isValid: false,
        error: 'Value must be either a number or groups format',
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
   * Try to parse value as a simple float
   */
  private tryParseAsFloat(value: string, params: FloatOrGroupsParams): ValidationResult {
    const numericValue = parseFloat(value);

    // Check if parsing was successful
    if (isNaN(numericValue)) {
      return { isValid: false };
    }

    // Check for scientific notation (not allowed)
    if (value.toLowerCase().includes('e')) {
      return { isValid: false };
    }

    // Check if the original string represents the same number (catches cases like "123abc")
    if (value !== numericValue.toString() &&
        value !== numericValue.toFixed(0) &&
        !this.isValidNumberFormat(value)) {
      return { isValid: false };
    }

    // Check negative constraint
    if (params.allow_negative === false && numericValue < 0) {
      return {
        isValid: false,
        error: 'Negative numbers are not allowed',
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    // Check value range constraints
    const rangeResult = this.validateRange(numericValue, params, value);
    if (!rangeResult.isValid) {
      return rangeResult;
    }

    return {
      isValid: true,
      parsedValue: numericValue,
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Try to parse value as groups format: "numbers, . . . . . numbers,"
   */
  private tryParseAsGroups(value: string, params: FloatOrGroupsParams, groupSeparator: string, numberSeparator: string): ValidationResult {
    const normalizedTarget = groupSeparator.replace(/\s+/g, ' ');
    let groups: string[] | null = null;

    if (normalizedTarget === '. . . . . ') {
      const separatorRegex = /\.\s\.\s\.\s\.\s\.\s+/;
      const match = value.match(separatorRegex);
      if (!match) {
        return { isValid: false };
      }
      // Require spaces between dots (reject legacy "....." styles)
      const matchedSeparator = match[0];
      if (!matchedSeparator.includes(' ')) {
        return {
          isValid: false,
          error: 'Groups separator must include spaces between dots',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }
      groups = value.split(separatorRegex);
    } else if (value.includes(groupSeparator)) {
      groups = value.split(groupSeparator);
    } else {
      return { isValid: false };
    }

    if (!groups || groups.length !== 2) {
      return {
        isValid: false,
        error: `Expected exactly 2 groups separated by "${groupSeparator.trim()}"`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }
    const [group1Raw, group2Raw] = groups;

    // Parse each group
    const group1Result = this.parseNumberGroup(group1Raw.trim(), numberSeparator, params, 1);
    if (!group1Result.isValid) {
      return group1Result;
    }

    const group2Result = this.parseNumberGroup(group2Raw.trim(), numberSeparator, params, 2);
    if (!group2Result.isValid) {
      return group2Result;
    }

    // Check that both groups have the same number of numbers
    const group1Numbers = group1Result.parsedValue as number[];
    const group2Numbers = group2Result.parsedValue as number[];

    if (group1Numbers.length !== group2Numbers.length) {
      return {
        isValid: false,
        error: `Both groups must have the same number of values. Group 1 has ${group1Numbers.length}, Group 2 has ${group2Numbers.length}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    return {
      isValid: true,
      parsedValue: { group1: group1Numbers, group2: group2Numbers },
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Parse a group of numbers ending with comma
   */
  private parseNumberGroup(groupText: string, numberSeparator: string, params: FloatOrGroupsParams, groupNum: number): ValidationResult & { parsedValue?: number[] } {
    // Group should end with comma
    if (!groupText.endsWith(numberSeparator)) {
      return {
        isValid: false,
        error: `Group ${groupNum} must end with "${numberSeparator}"`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    // Remove trailing comma and split
    const numbersText = groupText.slice(0, -numberSeparator.length);
    const numberStrings = numbersText.split(numberSeparator);

    const parsedNumbers: number[] = [];

    for (let i = 0; i < numberStrings.length; i++) {
      const numberStr = numberStrings[i].trim();

      if (numberStr === '') {
        return {
          isValid: false,
          error: `Empty number at position ${i + 1} in group ${groupNum}`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      const numericValue = parseFloat(numberStr);

      if (isNaN(numericValue)) {
        return {
          isValid: false,
          error: `"${numberStr}" in group ${groupNum} is not a valid number`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      // Check for scientific notation
      if (numberStr.toLowerCase().includes('e')) {
        return {
          isValid: false,
          error: `"${numberStr}" in group ${groupNum} uses scientific notation, which is not allowed`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      // Check negative constraint
      if (params.allow_negative === false && numericValue < 0) {
        return {
          isValid: false,
          error: `"${numberStr}" in group ${groupNum} is negative, which is not allowed`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      // Check value range constraints
      const rangeResult = this.validateRange(numericValue, params, numberStr);
      if (!rangeResult.isValid) {
        return {
          ...rangeResult,
          error: `${rangeResult.error} (in group ${groupNum})`
        };
      }

      parsedNumbers.push(numericValue);
    }

    return { isValid: true, parsedValue: parsedNumbers };
  }

  /**
   * Validate numeric range constraints
   */
  private validateRange(value: number, params: FloatOrGroupsParams, originalText: string): ValidationResult {
    if (params.min_value !== undefined && value < params.min_value) {
      return {
        isValid: false,
        error: `"${originalText}" (${value}) is below minimum ${params.min_value}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    if (params.max_value !== undefined && value > params.max_value) {
      return {
        isValid: false,
        error: `"${originalText}" (${value}) is above maximum ${params.max_value}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    return { isValid: true };
  }

  /**
   * Check if a string represents a valid number format
   */
  private isValidNumberFormat(input: string): boolean {
    // Allow formats like: "123", "123.45", "-123", "-123.45", "123.", ".45"
    const validPatterns = [
      /^-?\d+$/,           // Integer: 123, -123
      /^-?\d+\.\d*$/,      // Decimal: 123.45, 123.
      /^-?\.\d+$/,         // Leading decimal: .45
    ];

    return validPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Generate helpful format description for users
   */
  private generateExpectedFormat(params: FloatOrGroupsParams): string {
    const groupSeparator = params.group_separator || '. . . . . ';
    const numberSeparator = params.number_separator || ',';

    let formatDesc = 'Either:\n';
    formatDesc += '• A single number (e.g., "32", "15.5")\n';
    formatDesc += `• Two groups of numbers: "num,num,${numberSeparator}${groupSeparator}num,num,${numberSeparator}"\n`;
    formatDesc += `Examples: "10,${groupSeparator}6," or "7,9,5,${groupSeparator}3,5,2,"`;

    // Add constraints
    const constraints: string[] = [];
    if (params.min_value !== undefined) {
      constraints.push(`min: ${params.min_value}`);
    }
    if (params.max_value !== undefined) {
      constraints.push(`max: ${params.max_value}`);
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
    return 'Validates either a single float or two groups of numbers separated by dots, commonly used for LED counts or measurements';
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
      allow_negative: {
        type: 'boolean',
        required: false,
        description: 'Allow negative numbers (default: true)',
        default: true
      },
      group_separator: {
        type: 'string',
        required: false,
        description: 'Separator between groups (default: ". . . . . ")',
        default: '. . . . . '
      },
      number_separator: {
        type: 'string',
        required: false,
        description: 'Separator between numbers (default: ",")',
        default: ','
      }
    };
  }
}
