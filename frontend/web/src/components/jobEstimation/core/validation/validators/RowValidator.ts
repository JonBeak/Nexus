// Row-level validation
// Checks row completeness, mandatory fields, and pricing calculation eligibility

import { GridRowCore } from '../../types/CoreTypes';
import { FieldValidationConfig } from '../ValidationEngine';
import { ValidationContext } from '../templates/ValidationTemplate';

export interface RowValidationResult {
  isValid: boolean;
  incompleteFields?: string[]; // Fields that are required but missing (based on complimentary_fields dependencies)
  pricingStatus: 'blocked' | 'allowed'; // Whether pricing calculations should proceed
  estimatePreviewStatus: 'show' | 'hide'; // Whether row appears in estimate preview
}

export class RowValidator {
  constructor(
    private productValidations: Map<number, Record<string, FieldValidationConfig>>
  ) {}

  /**
   * Validate a complete row for completeness, business rules, and pricing eligibility
   * @param row - Row to validate
   * @param context - Optional validation context with customer prefs and grid state
   * @returns Row validation result with pricing and preview status
   */
  async validateRow(row: GridRowCore, context?: ValidationContext): Promise<RowValidationResult> {
    const result: RowValidationResult = {
      isValid: true,
      incompleteFields: [],
      pricingStatus: 'allowed',
      estimatePreviewStatus: 'show'
    };


    // Get validation config for this product type
    const productValidation = this.productValidations.get(row.productTypeId || 0);
    if (!productValidation) {
      // No validation rules configured
      const hasAnyData = this.hasAnyData(row);
      if (!hasAnyData) {
        result.pricingStatus = 'blocked';
        // Sub-items should always show in preview, even when empty, as they represent cost components
        if (row.rowType === 'subItem') {
          result.estimatePreviewStatus = 'show';
        } else {
          result.estimatePreviewStatus = 'hide';
        }
      }
      return result;
    }

    // Check if row is completely empty
    if (!this.hasAnyData(row)) {
      result.pricingStatus = 'blocked';
      result.estimatePreviewStatus = 'hide';
      return result; // Empty rows: no validation, no pricing, no preview
    }

    // NOTE: Field dependencies (complimentary_fields, supplementary_to) are now validated
    // in ValidationEngine.validateCells() - no need for category-based logic here

    // Row has data and dependencies are checked elsewhere
    result.isValid = true;
    result.pricingStatus = 'allowed';
    result.estimatePreviewStatus = 'show';

    return result;
  }

  /**
   * Check if row has any data at all
   */
  private hasAnyData(row: GridRowCore): boolean {
    return Object.values(row.data).some(value => value && typeof value === 'string' && value.trim() !== '');
  }

  /**
   * Check if row has input in any field other than quantity
   */
  private hasNonQuantityFieldInput(row: GridRowCore): boolean {
    return Object.entries(row.data)
      .filter(([key]) => key !== 'quantity')
      .some(([_, value]) => value && typeof value === 'string' && value.trim() !== '');
  }

  /**
   * Check if a field has content
   */
  private isFieldFilled(row: GridRowCore, fieldName: string): boolean {
    const value = row.data[fieldName] || '';
    return value && typeof value === 'string' && value.trim() !== '';
  }

  /**
   * Get row status summary for UI display
   */
  getRowStatusSummary(row: GridRowCore, context?: ValidationContext): RowStatusSummary {
    const isEmpty = !this.hasAnyData(row);

    return {
      isEmpty,
      canPrice: !isEmpty,
      showInEstimate: !isEmpty,
      completionStatus: isEmpty ? 'empty' : 'complete'
    };
  }

}

export interface RowStatusSummary {
  isEmpty: boolean;
  canPrice: boolean;
  showInEstimate: boolean;
  completionStatus: 'empty' | 'complete';
}
