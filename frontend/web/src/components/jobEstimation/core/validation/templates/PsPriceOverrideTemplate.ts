// PS Price Override validation template - validates PS price override based on PS count
// Should show error if PS price is entered but there are no power supplies

import { ValidationResult, ValidationContext } from './ValidationTemplate';
import { validateNumericInput } from '../utils/numericValidation';
import { BaseValidationTemplate } from './BaseValidationTemplate';

export type PsPriceOverrideParams = {
  ps_count_field: string; // Which field contains PS count (e.g., 'field9' for Channel Letters, 'field4' for LED)
  min?: number;
  allow_negative?: boolean;
  decimal_places?: number;
};

export class PsPriceOverrideTemplate extends BaseValidationTemplate {
  async validate(
    value: string,
    params: PsPriceOverrideParams,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    return this.wrapValidation(params, async () => {
      // Handle empty values - always valid (no override is fine)
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return this.createSuccess(null, null, params);
      }

      const cleanValue = value.trim();

      // Check required parameter
      if (!params.ps_count_field) {
        throw new Error('ps_count_field parameter is required');
      }

      // Check if there are any power supplies in this row
      const psCount = this.calculatePsCount(context, params.ps_count_field);

      if (psCount === 0) {
        return this.createError('Cannot enter PS price when there are no power supplies', params);
      }

      // Validate as numeric input
      const numericResult = validateNumericInput(cleanValue, {
        allowNegative: params.allow_negative ?? false,
        minValue: params.min ?? 0,
        allowEmpty: false
      });

      if (!numericResult.isValid) {
        return this.createError(numericResult.error || 'Invalid numeric value', params);
      }

      // If there are PSs and value is valid, accept it
      return this.createSuccess(numericResult.value, { psCount }, params);
    });
  }

  protected generateExpectedFormat(_params: PsPriceOverrideParams): string {
    return 'PS price override (optional when power supplies are present)';
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
        return this.calculatePsFromCalculatedValues(context);
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
      return this.calculatePsFromCalculatedValues(context);
    }

    return 0;
  }

  /**
   * Calculate PS count from calculated values
   */
  private calculatePsFromCalculatedValues(context?: ValidationContext): number {
    if (!context) return 0;

    if (typeof context.calculatedValues?.psCount === 'number') {
      return context.calculatedValues.psCount;
    }

    const ledCount = typeof context.calculatedValues?.ledCount === 'number'
      ? context.calculatedValues.ledCount
      : 0;

    if (ledCount === 0) return 0;

    // Calculate total wattage (assume 1.2W per LED)
    const totalWattage = ledCount * 1.2;

    // Calculate PS count (60W per PS)
    return Math.ceil(totalWattage / 60);
  }

  getDescription(): string {
    return 'Validates PS price override based on whether power supplies are present in the row';
  }

  getParameterSchema(): Record<string, unknown> {
    return {
      ps_count_field: {
        type: 'string',
        required: true,
        description: 'Field containing PS count (e.g., "field9" for Channel Letters, "field4" for LED)'
      },
      min: {
        type: 'number',
        required: false,
        description: 'Minimum allowed value',
        default: 0
      },
      allow_negative: {
        type: 'boolean',
        required: false,
        description: 'Whether negative values are allowed',
        default: false
      },
      decimal_places: {
        type: 'number',
        required: false,
        description: 'Maximum decimal places allowed'
      }
    };
  }
}
