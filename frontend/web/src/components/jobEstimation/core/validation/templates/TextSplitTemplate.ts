// TextSplit validation template - handles 1D and 2D text splitting with comprehensive controls
// Supports formats like "12+5+3", "12x8,15x10", "width:12|height:8,depth:5"

import { ValidationTemplate, ValidationResult, TextSplitParams, ValidationContext } from './ValidationTemplate';

export class TextSplitTemplate implements ValidationTemplate {
  async validate(value: string, params: TextSplitParams, context?: ValidationContext): Promise<ValidationResult> {
    try {
      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        if (params.allow_empty) {
          return { isValid: true, parsedValue: [] };
        }
        return {
          isValid: false,
          error: 'Value is required',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      // Apply whitespace trimming
      const processedValue = params.trim_whitespace !== false ? value.trim() : value;

      // Parse based on whether we have 1D or 2D splitting
      if (params.delimiter2) {
        return await this.validate2D(processedValue, params);
      } else {
        return await this.validate1D(processedValue, params);
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }
  }

  /**
   * 1D validation - single delimiter
   * Example: "12 + 5 + 3" with delimiter="+"
   */
  private async validate1D(value: string, params: TextSplitParams): Promise<ValidationResult> {
    // Split by primary delimiter
    const parts = value.split(params.delimiter);

    // Clean parts based on settings
    const cleanParts = parts.map(part =>
      params.trim_whitespace !== false ? part.trim() : part
    );

    // Filter empty parts if not allowed
    const validParts = params.allow_empty ? cleanParts : cleanParts.filter(part => part !== '');

    // Validate count constraints
    const countResult = this.validateCount(validParts.length, params, '1st dimension');
    if (!countResult.isValid) {
      return countResult;
    }

    // Parse individual values
    const parseResult = await this.parseValues(validParts, params);
    if (!parseResult.isValid) {
      return parseResult;
    }

    return {
      isValid: true,
      parsedValue: parseResult.parsedValue,
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * 2D validation - two delimiters
   * Example: "12x8, 15x10, 20x12" with delimiter="," delimiter2="x"
   */
  private async validate2D(value: string, params: TextSplitParams): Promise<ValidationResult> {
    // Split by primary delimiter to get groups
    const groups = value.split(params.delimiter);

    // Clean groups
    const cleanGroups = groups.map(group =>
      params.trim_whitespace !== false ? group.trim() : group
    );

    // Filter empty groups if not allowed
    const validGroups = params.allow_empty ? cleanGroups : cleanGroups.filter(group => group !== '');

    // Validate 1st dimension count (number of groups)
    const groupCountResult = this.validateCount(validGroups.length, params, 'groups');
    if (!groupCountResult.isValid) {
      return groupCountResult;
    }

    // Process each group
    const parsedGroups: any[] = [];

    for (let i = 0; i < validGroups.length; i++) {
      const group = validGroups[i];

      // Split group by secondary delimiter
      const groupParts = group.split(params.delimiter2!);

      // Clean group parts
      const cleanGroupParts = groupParts.map(part =>
        params.trim_whitespace !== false ? part.trim() : part
      );

      // Filter empty parts in group if not allowed
      const validGroupParts = params.allow_empty ? cleanGroupParts : cleanGroupParts.filter(part => part !== '');

      // Validate 2nd dimension count (items per group)
      const groupPartsCountResult = this.validateCount2(validGroupParts.length, params, `group ${i + 1}`);
      if (!groupPartsCountResult.isValid) {
        return groupPartsCountResult;
      }

      // Parse values in this group
      const groupParseResult = await this.parseValues(validGroupParts, params);
      if (!groupParseResult.isValid) {
        return {
          ...groupParseResult,
          error: `Group ${i + 1}: ${groupParseResult.error}`
        };
      }

      parsedGroups.push(groupParseResult.parsedValue);
    }

    return {
      isValid: true,
      parsedValue: parsedGroups,
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Validate count constraints for 1st dimension
   */
  private validateCount(actualCount: number, params: TextSplitParams, dimensionName: string): ValidationResult {
    if (params.required_count !== undefined && actualCount !== params.required_count) {
      return {
        isValid: false,
        error: `Expected exactly ${params.required_count} items in ${dimensionName}, got ${actualCount}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    if (params.min_count !== undefined && actualCount < params.min_count) {
      return {
        isValid: false,
        error: `Expected at least ${params.min_count} items in ${dimensionName}, got ${actualCount}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    if (params.max_count !== undefined && actualCount > params.max_count) {
      return {
        isValid: false,
        error: `Expected at most ${params.max_count} items in ${dimensionName}, got ${actualCount}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    return { isValid: true };
  }

  /**
   * Validate count constraints for 2nd dimension
   */
  private validateCount2(actualCount: number, params: TextSplitParams, groupName: string): ValidationResult {
    if (params.required_count2 !== undefined && actualCount !== params.required_count2) {
      return {
        isValid: false,
        error: `Expected exactly ${params.required_count2} items in ${groupName}, got ${actualCount}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    if (params.min_count2 !== undefined && actualCount < params.min_count2) {
      return {
        isValid: false,
        error: `Expected at least ${params.min_count2} items in ${groupName}, got ${actualCount}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    if (params.max_count2 !== undefined && actualCount > params.max_count2) {
      return {
        isValid: false,
        error: `Expected at most ${params.max_count2} items in ${groupName}, got ${actualCount}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    return { isValid: true };
  }

  /**
   * Parse individual values according to parse_as setting
   */
  private async parseValues(parts: string[], params: TextSplitParams): Promise<ValidationResult> {
    const parsedValues: any[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      try {
        let parsedValue: any;

        switch (params.parse_as) {
          case 'float':
            parsedValue = parseFloat(part);
            if (isNaN(parsedValue)) {
              return {
                isValid: false,
                error: `"${part}" is not a valid number`,
                expectedFormat: this.generateExpectedFormat(params)
              };
            }
            break;

          case 'integer':
            parsedValue = parseInt(part, 10);
            if (isNaN(parsedValue) || !Number.isInteger(parseFloat(part))) {
              return {
                isValid: false,
                error: `"${part}" is not a valid integer`,
                expectedFormat: this.generateExpectedFormat(params)
              };
            }
            break;

          case 'string':
            parsedValue = part;
            break;

          default:
            return {
              isValid: false,
              error: `Unknown parse_as type: ${params.parse_as}`,
              expectedFormat: this.generateExpectedFormat(params)
            };
        }

        // Validate numeric constraints
        if (params.parse_as !== 'string') {
          const numericResult = this.validateNumericConstraints(parsedValue, params, part);
          if (!numericResult.isValid) {
            return numericResult;
          }
        }

        parsedValues.push(parsedValue);
      } catch (error) {
        return {
          isValid: false,
          error: `Failed to parse "${part}": ${error.message}`,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }
    }

    return {
      isValid: true,
      parsedValue: parsedValues
    };
  }

  /**
   * Validate numeric value constraints (min/max)
   */
  private validateNumericConstraints(value: number, params: TextSplitParams, originalText: string): ValidationResult {
    if (params.min !== undefined && value < params.min) {
      return {
        isValid: false,
        error: `"${originalText}" (${value}) is below minimum ${params.min}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    if (params.max !== undefined && value > params.max) {
      return {
        isValid: false,
        error: `"${originalText}" (${value}) is above maximum ${params.max}`,
        expectedFormat: this.generateExpectedFormat(params)
      };
    }

    return { isValid: true };
  }

  /**
   * Generate helpful format description for users
   */
  private generateExpectedFormat(params: TextSplitParams): string {
    const parts: string[] = [];

    // Basic format
    if (params.delimiter2) {
      parts.push(`Items separated by "${params.delimiter}", with sub-items separated by "${params.delimiter2}"`);
    } else {
      parts.push(`Items separated by "${params.delimiter}"`);
    }

    // Value type
    if (params.parse_as === 'float') {
      parts.push('numbers (decimals allowed)');
    } else if (params.parse_as === 'integer') {
      parts.push('whole numbers only');
    } else {
      parts.push('text values');
    }

    // Count constraints
    const countDesc = this.generateCountDescription(params);
    if (countDesc) {
      parts.push(countDesc);
    }

    // Value constraints
    if (params.parse_as !== 'string' && (params.min !== undefined || params.max !== undefined)) {
      const valueDesc = this.generateValueRangeDescription(params);
      if (valueDesc) {
        parts.push(valueDesc);
      }
    }

    return parts.join(', ');
  }

  /**
   * Generate count constraint description
   */
  private generateCountDescription(params: TextSplitParams): string {
    const parts: string[] = [];

    // 1st dimension counts
    if (params.required_count !== undefined) {
      parts.push(`exactly ${params.required_count} items`);
    } else {
      const countParts: string[] = [];
      if (params.min_count !== undefined) {
        countParts.push(`at least ${params.min_count}`);
      }
      if (params.max_count !== undefined) {
        countParts.push(`at most ${params.max_count}`);
      }
      if (countParts.length > 0) {
        parts.push(countParts.join(' and ') + ' items');
      }
    }

    // 2nd dimension counts (if applicable)
    if (params.delimiter2) {
      if (params.required_count2 !== undefined) {
        parts.push(`exactly ${params.required_count2} sub-items per group`);
      } else {
        const count2Parts: string[] = [];
        if (params.min_count2 !== undefined) {
          count2Parts.push(`at least ${params.min_count2}`);
        }
        if (params.max_count2 !== undefined) {
          count2Parts.push(`at most ${params.max_count2}`);
        }
        if (count2Parts.length > 0) {
          parts.push(count2Parts.join(' and ') + ' sub-items per group');
        }
      }
    }

    return parts.join(', ');
  }

  /**
   * Generate value range description
   */
  private generateValueRangeDescription(params: TextSplitParams): string {
    if (params.min !== undefined && params.max !== undefined) {
      return `each value between ${params.min} and ${params.max}`;
    } else if (params.min !== undefined) {
      return `each value >= ${params.min}`;
    } else if (params.max !== undefined) {
      return `each value <= ${params.max}`;
    }
    return '';
  }

  getDescription(): string {
    return 'Validates text that can be split by one or two delimiters, with flexible parsing and constraint options';
  }

  getParameterSchema(): Record<string, any> {
    return {
      delimiter: { type: 'string', required: true, description: 'Primary delimiter character' },
      delimiter2: { type: 'string', required: false, description: 'Secondary delimiter for 2D parsing' },
      parse_as: { type: 'string', enum: ['string', 'float', 'integer'], required: true },
      required_count: { type: 'number', required: false, description: 'Exact number of items in 1st dimension' },
      min_count: { type: 'number', required: false, description: 'Minimum items in 1st dimension' },
      max_count: { type: 'number', required: false, description: 'Maximum items in 1st dimension' },
      required_count2: { type: 'number', required: false, description: 'Exact number of items in 2nd dimension' },
      min_count2: { type: 'number', required: false, description: 'Minimum items in 2nd dimension' },
      max_count2: { type: 'number', required: false, description: 'Maximum items in 2nd dimension' },
      min: { type: 'number', required: false, description: 'Minimum value for numeric parsing' },
      max: { type: 'number', required: false, description: 'Maximum value for numeric parsing' },
      allow_empty: { type: 'boolean', required: false, description: 'Allow empty values between delimiters' },
      trim_whitespace: { type: 'boolean', required: false, description: 'Remove leading/trailing spaces' }
    };
  }
}