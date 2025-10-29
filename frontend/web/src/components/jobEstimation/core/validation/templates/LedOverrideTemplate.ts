// LED Override validation template - context-aware LED count validation
// Accepts float, "yes", "no" and calculates LED count based on business logic

import { ValidationResult, LedOverrideParams, ValidationContext } from './ValidationTemplate';
import { calculateChannelLetterMetrics, ChannelLetterMetrics } from '../utils/channelLetterParser';
import { validateNumericInput } from '../utils/numericValidation';
import { BaseValidationTemplate } from './BaseValidationTemplate';

type LedOverrideParsedValue = number | 'yes' | 'no' | null;

export class LedOverrideTemplate extends BaseValidationTemplate {
  async validate(value: string, params: LedOverrideParams = {}, context?: ValidationContext): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      const savedLedCount = this.getSavedLedCount(context);
      const defaultLedCount = this.getDefaultLedCount(context);
      const hasChannelData = savedLedCount > 0;

      // Handle empty values
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.handleEmptyValue(defaultLedCount, params);
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

      return this.createSuccess(parsedValue, calculatedLedCount, params);
    });
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
        return this.createError('LEDs are already included by default. Enter a number or "no" instead.', params);
      }

      if (!info.hasChannelData) {
        return this.createError('Channel letter data is required before enabling LEDs.', params);
      }

      return { isValid: true, parsedValue: 'yes' };
    }

    // Check for "no"
    if (accepts.includes('no') && value === 'no') {
      if (info.defaultLedCount === 0) {
        return this.createError('LEDs are already disabled by default. Enter a number if needed.', params);
      }

      return { isValid: true, parsedValue: 'no' };
    }

    // Check for numeric value using strict validation
    if (accepts.includes('float')) {
      const numericResult = validateNumericInput(value, {
        allowNegative: false,
        minValue: 0,
        allowEmpty: false
      });

      if (numericResult.isValid && numericResult.value !== undefined) {
        // Reject "0" when there's no channel data (same as "no")
        if (numericResult.value === 0 && !info.hasChannelData) {
          return this.createError('LEDs are already disabled by default. Enter a number if needed.', params);
        }

        // Allow explicit numeric values - enables standalone LED components
        return { isValid: true, parsedValue: numericResult.value };
      }

      // If validation failed but we have an error, use the specific error
      if (numericResult.error) {
        return this.createError(numericResult.error, params);
      }
    }

    // Invalid input
    return this.createError(`Invalid input. Expected: ${accepts.join(', ')}`, params);
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
   * Generate expected format description
   */
  protected generateExpectedFormat(params: LedOverrideParams): string {
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
