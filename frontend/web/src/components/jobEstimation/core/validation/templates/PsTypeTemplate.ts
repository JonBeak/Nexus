// PS Type validation template - validates PS type selection based on PS count
// Should show error if PS type is selected but there are no power supplies

import { ValidationTemplate, ValidationResult, ValidationContext } from './ValidationTemplate';
import { calculateChannelLetterMetrics, ChannelLetterMetrics } from '../utils/channelLetterParser';
import { validateNumericInput } from '../utils/numericValidation';

export type PsTypeParams = {
  ps_count_field: string; // Which field contains PS count (e.g., 'field9' for Channel Letters, 'field4' for LED)
};

export class PsTypeTemplate implements ValidationTemplate {
  async validate(
    value: string,
    params: PsTypeParams = {},
    context?: ValidationContext
  ): Promise<ValidationResult> {
    try {
      // Handle empty values - always valid (no selection is fine)
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return {
          isValid: true,
          parsedValue: null,
          expectedFormat: 'PS type selection (optional when power supplies are present)'
        };
      }

      const cleanValue = value.trim();

      // Check if there are any power supplies in this row
      if (!params.ps_count_field) {
        throw new Error('ps_count_field parameter is required');
      }
      const psCount = this.calculatePsCount(context, params.ps_count_field);

      if (psCount === 0) {
        return {
          isValid: false,
          error: 'Cannot select PS type when there are no power supplies',
          expectedFormat: 'PS type can only be selected when power supplies are present (field9 > 0)',
          calculatedValue: { psCount }
        };
      }

      // If there are PSs, any selection is valid
      return {
        isValid: true,
        parsedValue: cleanValue,
        calculatedValue: { psCount },
        expectedFormat: 'Any PS type (power supplies are present)'
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
        expectedFormat: 'PS type selection (optional when power supplies are present)'
      };
    }
  }

  /**
   * Calculate PS count from specified field and context
   */
  private calculatePsCount(context: ValidationContext | undefined, psCountField: string): number {
    if (!context) return 0;

    const psFieldValue = context.rowData[psCountField];
    if (psFieldValue && psFieldValue.trim() !== '') {
      const cleanValue = psFieldValue.trim().toLowerCase();

      if (cleanValue === 'no') {
        return 0;
      }

      if (cleanValue === 'yes') {
        return this.calculatePsFromLeds(context);
      }

      const numericResult = validateNumericInput(cleanValue, {
        allowNegative: false,
        minValue: 0,
        allowEmpty: false
      });
      if (numericResult.isValid && numericResult.value !== undefined) {
        return numericResult.value;
      }
    }

    // Check calculated values from Phase 1 when no explicit override exists
    if (typeof context.calculatedValues?.psCount === 'number') {
      return context.calculatedValues.psCount;
    }

    if (context.customerPreferences?.requires_transformers) {
      return this.calculatePsFromLeds(context);
    }

    return 0;
  }

  /**
   * Calculate PS count from LED count and wattage
   */
  private calculatePsFromLeds(context?: ValidationContext): number {
    if (!context) return 0;

    const ledCount = this.getLedCount(context);

    if (ledCount === 0) return 0;

    // Calculate total wattage (assume 1.2W per LED)
    const totalWattage = ledCount * 1.2;

    // Calculate PS count (60W per PS)
    return Math.ceil(totalWattage / 60);
  }

  private getLedCount(context: ValidationContext): number {
    if (typeof context.calculatedValues?.ledCount === 'number') {
      return context.calculatedValues.ledCount;
    }

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
    return 'Validates PS type selection based on whether power supplies are present in the row';
  }

  getParameterSchema(): Record<string, unknown> {
    return {
      ps_count_field: {
        type: 'string',
        required: true,
        description: 'Field containing PS count (e.g., "field9" for Channel Letters, "field4" for LED)'
      }
    };
  }
}
