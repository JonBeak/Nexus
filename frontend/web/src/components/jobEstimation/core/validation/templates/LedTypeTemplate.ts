// LED Type validation template - validates LED type selection based on LED count
// Should show error if LED type is selected but there are no LEDs

import { ValidationTemplate, ValidationResult, ValidationContext } from './ValidationTemplate';
import { calculateChannelLetterMetrics, ChannelLetterMetrics } from '../utils/channelLetterParser';
import { validateNumericInput } from '../utils/numericValidation';

export type LedTypeParams = {
  led_count_field: string; // Which field contains LED count (e.g., 'field3' for Channel Letters, 'field1' for LED)
};

export class LedTypeTemplate implements ValidationTemplate {
  async validate(
    value: string,
    params: LedTypeParams = {},
    context?: ValidationContext
  ): Promise<ValidationResult> {
    try {
      // Handle empty values - always valid (no selection is fine)
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return {
          isValid: true,
          parsedValue: null,
          expectedFormat: 'LED type selection (optional when LEDs are present)'
        };
      }

      const cleanValue = value.trim();

      // Check if there are any LEDs in this row
      if (!params.led_count_field) {
        throw new Error('led_count_field parameter is required');
      }
      const ledCount = this.calculateLedCount(context, params.led_count_field);

      if (ledCount === 0) {
        return {
          isValid: false,
          error: 'Cannot select LED type when there are no LEDs',
          expectedFormat: 'LED type can only be selected when LEDs are present (field3 > 0)',
          calculatedValue: { ledCount }
        };
      }

      // If there are LEDs, any selection is valid
      return {
        isValid: true,
        parsedValue: cleanValue,
        calculatedValue: { ledCount },
        expectedFormat: 'Any LED type (LEDs are present)'
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: 'LED type selection (optional when LEDs are present)'
      };
    }
  }

  /**
   * Calculate LED count from specified field and context
   */
  private calculateLedCount(context: ValidationContext | undefined, ledCountField: string): number {
    if (!context) return 0;

    if (typeof context.calculatedValues?.ledCount === 'number') {
      return context.calculatedValues.ledCount;
    }

    const ledFieldValue = context.rowData[ledCountField];
    if (!ledFieldValue || ledFieldValue.trim() === '') {
      return context.customerPreferences?.use_leds ? this.calculateLedsFromData(context) : 0;
    }

    const cleanValue = ledFieldValue.trim().toLowerCase();

    if (cleanValue === 'no') {
      return 0;
    }

    if (cleanValue === 'yes') {
      return this.calculateLedsFromData(context);
    }

    const numericResult = validateNumericInput(cleanValue, {
      allowNegative: false,
      minValue: 0,
      allowEmpty: false
    });
    if (numericResult.isValid && numericResult.value !== undefined) {
      return numericResult.value;
    }

    return this.calculateLedsFromData(context);
  }

  /**
   * Calculate LEDs from field2 dimensions
   */
  private calculateLedsFromData(context?: ValidationContext): number {
    if (!context) return 0;

    const metrics = this.getChannelLetterMetrics(context);
    return metrics?.ledCount || 0;
  }

  private getChannelLetterMetrics(context: ValidationContext): ChannelLetterMetrics | null {
    return (
      (context.calculatedValues?.channelLetterMetrics as ChannelLetterMetrics | undefined) ||
      calculateChannelLetterMetrics(context.rowData.field2)
    );
  }

  getDescription(): string {
    return 'Validates LED type selection based on whether LEDs are present in the row';
  }

  getParameterSchema(): Record<string, unknown> {
    return {
      led_count_field: {
        type: 'string',
        required: true,
        description: 'Field containing LED count (e.g., "field3" for Channel Letters, "field1" for LED)'
      }
    };
  }
}
