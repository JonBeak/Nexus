// LED Override validation template - context-aware LED count validation
// Accepts float, "yes", "no" and calculates LED count based on business logic

import { ValidationTemplate, ValidationResult, LedOverrideParams, ValidationContext } from './ValidationTemplate';
import { calculateChannelLetterMetrics, ChannelLetterMetrics } from '../utils/channelLetterParser';

type LedOverrideParsedValue = number | 'yes' | 'no' | null;

export class LedOverrideTemplate implements ValidationTemplate {
  async validate(value: string, params: LedOverrideParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    try {
      // DEBUG: LedOverrideTemplate validation

      const savedLedCount = this.getSavedLedCount(context);
      const defaultLedCount = this.getDefaultLedCount(context);
      const hasChannelData = savedLedCount > 0;

      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        // Empty is valid - will use default behavior
        return {
          isValid: true,
          parsedValue: null,
          calculatedValue: defaultLedCount,
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      const cleanValue = value.trim();
      const normalizedValue = cleanValue.toLowerCase();

      // Parse input based on type
      const parseResult = this.parseInput(normalizedValue, params, {
        savedLedCount,
        defaultLedCount,
        hasChannelData
      });
      if (!parseResult.isValid) {
        return parseResult;
      }

      // Calculate LED count based on parsed input and context
      const parsedValue = parseResult.parsedValue as LedOverrideParsedValue;
      const calculatedLedCount = this.calculateLedCount(parsedValue, {
        savedLedCount,
        defaultLedCount,
        hasChannelData
      });

      // Generate warnings if applicable
      const warnings = this.generateWarnings(parsedValue, context);

      return {
        isValid: true,
        parsedValue,
        calculatedValue: calculatedLedCount,
        warnings: warnings.length > 0 ? warnings : undefined,
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
   * Parse input value into structured format
   */
  private parseInput(
    value: string,
    params: LedOverrideParams,
    info: { savedLedCount: number; defaultLedCount: number; hasChannelData: boolean }
  ): ValidationResult {
    const accepts = params.accepts || ['float', 'yes', 'no'];
    // Check for "yes"
    if (accepts.includes('yes') && value === 'yes') {
      if (info.defaultLedCount > 0) {
        return {
          isValid: false,
          error: 'LEDs are already included by default. Enter a number or "no" instead.',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      if (!info.hasChannelData) {
        return {
          isValid: false,
          error: 'Channel letter data is required before enabling LEDs.',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      return { isValid: true, parsedValue: 'yes' };
    }

    // Check for "no"
    if (accepts.includes('no') && value === 'no') {
      if (info.defaultLedCount === 0) {
        return {
          isValid: false,
          error: 'LEDs are already disabled by default. Enter a number if needed.',
          expectedFormat: this.generateExpectedFormat(params)
        };
      }

      return { isValid: true, parsedValue: 'no' };
    }

    // Check for numeric value
    if (accepts.includes('float')) {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        if (numericValue < 0) {
          return {
            isValid: false,
            error: 'LED count cannot be negative',
            expectedFormat: this.generateExpectedFormat(params)
          };
        }
        return { isValid: true, parsedValue: numericValue };
      }
    }

    // Invalid input
    return {
      isValid: false,
      error: `Invalid input. Expected: ${accepts.join(', ')}`,
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Calculate LED count based on input and context
   */
  private calculateLedCount(
    parsedValue: LedOverrideParsedValue,
    info: { savedLedCount: number; defaultLedCount: number; hasChannelData: boolean }
  ): number {
    // Handle different input types
    if (typeof parsedValue === 'number') {
      // Explicit numeric override
      return parsedValue;
    }

    if (parsedValue === 'yes') {
      return info.savedLedCount;
    }

    if (parsedValue === 'no') {
      // Explicit override to no LEDs
      return 0;
    }

    // No explicit input - use default behavior
    return info.defaultLedCount;
  }

  /**
   * Check if channel letters exist (field1 and field2 filled)
   */
  private hasChannelLetters(context: ValidationContext, metrics?: ChannelLetterMetrics | null): boolean {
    const field1 = context.rowData.field1;
    const field2 = context.rowData.field2;
    const hasPairs = (metrics?.pairs?.length || 0) > 0 || (!!metrics && metrics.ledCount > 0);
    return !!(field1 && field1.trim() && field2 && field2.trim() && hasPairs);
  }

  private getChannelLetterMetrics(context: ValidationContext): ChannelLetterMetrics | null {
    return (
      (context.calculatedValues?.channelLetterMetrics as ChannelLetterMetrics | undefined) ||
      calculateChannelLetterMetrics(context.rowData.field2)
    );
  }

  private getSavedLedCount(context?: ValidationContext): number {
    if (!context) return 0;
    const saved = context.calculatedValues?.savedLedCount;
    if (typeof saved === 'number') {
      return Math.max(0, saved);
    }

    const metrics = this.getChannelLetterMetrics(context);
    return Math.max(0, metrics?.ledCount || 0);
  }

  private getDefaultLedCount(context?: ValidationContext): number {
    if (!context) return 0;
    const defaultCount = context.calculatedValues?.defaultLedCount;
    if (typeof defaultCount === 'number') {
      return Math.max(0, defaultCount);
    }

    const saved = this.getSavedLedCount(context);
    return context.customerPreferences.use_leds ? saved : 0;
  }

  /**
   * Generate warnings for potentially confusing input
   */
  private generateWarnings(parsedValue: LedOverrideParsedValue, context?: ValidationContext): string[] {
    const warnings: string[] = [];

    if (!context) return warnings;

    const metrics = this.getChannelLetterMetrics(context);
    const hasChannelLetters = this.hasChannelLetters(context, metrics);

    // Warning: yes/no without channel letters
    if ((parsedValue === 'yes' || parsedValue === 'no') && !hasChannelLetters) {
      warnings.push('yes/no has no effect without channel letters data');
    }

    return warnings;
  }

  /**
   * Generate expected format description
   */
  private generateExpectedFormat(params: LedOverrideParams): string {
    const accepts = params.accepts || ['float', 'yes', 'no'];
    const formats: string[] = [];

    if (accepts.includes('float')) {
      formats.push('number (LED count)');
    }
    if (accepts.includes('yes')) {
      formats.push('"yes" (calculate from channel letters)');
    }
    if (accepts.includes('no')) {
      formats.push('"no" (no LEDs)');
    }

    return `Accepts: ${formats.join(', ')}`;
  }

  getDescription(): string {
    return 'Context-aware LED count validation with customer preferences and channel letters integration';
  }

  getParameterSchema(): Record<string, unknown> {
    return {
      accepts: {
        type: 'array',
        items: { type: 'string', enum: ['float', 'yes', 'no'] },
        required: false,
        description: 'Allowed input types',
        default: ['float', 'yes', 'no']
      }
    };
  }
}
