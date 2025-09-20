// Row-level validation
// Checks row completeness, mandatory fields, and pricing calculation eligibility

import { GridRowCore } from '../../types/CoreTypes';
import { FieldValidationConfig } from '../ValidationEngine';
import { ValidationContext } from '../templates/ValidationTemplate';

export interface RowValidationResult {
  isValid: boolean;
  incompleteFields?: string[]; // Fields that are required but missing (only for partially completed complete_set fields)
  warnings?: string[]; // Non-blocking warnings
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
      warnings: [],
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
        result.estimatePreviewStatus = 'hide';
      }
      return result;
    }

    // Check if row is completely empty
    if (!this.hasAnyData(row)) {
      result.pricingStatus = 'blocked';
      result.estimatePreviewStatus = 'hide';
      return result; // Empty rows: no validation, no pricing, no preview
    }

    // Analyze field completion by category
    const fieldAnalysis = this.analyzeFieldCompletion(row, productValidation, context);

    // Check for incomplete mandatory fields (partial completion warning)
    if (fieldAnalysis.hasMandatoryFields && fieldAnalysis.mandatoryPartiallyComplete) {
      result.isValid = false;
      result.incompleteFields = fieldAnalysis.incompleteMandatoryFields;
      result.pricingStatus = 'blocked';
      result.estimatePreviewStatus = 'hide';
    }

    // Check pricing and preview eligibility
    const pricingEligibility = this.checkPricingEligibility(fieldAnalysis);
    result.pricingStatus = pricingEligibility.allowPricing ? 'allowed' : 'blocked';
    result.estimatePreviewStatus = pricingEligibility.showInPreview ? 'show' : 'hide';

    // Add business rule warnings
    const businessWarnings = this.checkBusinessRules(row, fieldAnalysis);
    result.warnings = businessWarnings;

    return result;
  }

  /**
   * Check if row has any data at all
   */
  private hasAnyData(row: GridRowCore): boolean {
    return Object.values(row.data).some(value => value && typeof value === 'string' && value.trim() !== '');
  }

  /**
   * Analyze field completion by category (complete_set/sufficient/supplementary/context_dependent)
   */
  private analyzeFieldCompletion(
    row: GridRowCore,
    validationConfig: Record<string, FieldValidationConfig>,
    context?: ValidationContext
  ): FieldAnalysis {
    const analysis: FieldAnalysis = {
      hasMandatoryFields: false,
      hasSufficientFields: false,
      hasSupplementaryFields: false,
      mandatoryComplete: true,
      mandatoryPartiallyComplete: false,
      sufficientFieldsFilled: false,
      onlySupplementaryFilled: false,
      incompleteMandatoryFields: [],
      filledFieldCategories: new Set()
    };

    // Categorize all fields
    const completeSetFields: string[] = [];
    const sufficientFields: string[] = [];
    const supplementaryFields: string[] = [];

    for (const [fieldName, config] of Object.entries(validationConfig)) {
      const category = this.resolveFieldCategory(config, context);

      if (category === 'complete_set') {
        completeSetFields.push(fieldName);
        analysis.hasMandatoryFields = true;
      } else if (category === 'sufficient') {
        sufficientFields.push(fieldName);
        analysis.hasSufficientFields = true;
      } else if (category === 'supplementary') {
        supplementaryFields.push(fieldName);
        analysis.hasSupplementaryFields = true;
      }
    }

    // Check which categories have filled fields
    const filledCompleteSet = completeSetFields.filter(field => this.isFieldFilled(row, field));
    const filledSufficient = sufficientFields.filter(field => this.isFieldFilled(row, field));
    const filledSupplementary = supplementaryFields.filter(field => this.isFieldFilled(row, field));

    if (filledCompleteSet.length > 0) analysis.filledFieldCategories.add('complete_set');
    if (filledSufficient.length > 0) analysis.filledFieldCategories.add('sufficient');
    if (filledSupplementary.length > 0) analysis.filledFieldCategories.add('supplementary');

    // Analyze complete_set field completion
    if (analysis.hasMandatoryFields) {
      analysis.mandatoryComplete = filledCompleteSet.length === completeSetFields.length;
      analysis.mandatoryPartiallyComplete = filledCompleteSet.length > 0 && filledCompleteSet.length < completeSetFields.length;
      analysis.incompleteMandatoryFields = completeSetFields.filter(field => !this.isFieldFilled(row, field));
    }

    // Check sufficient fields
    analysis.sufficientFieldsFilled = filledSufficient.length > 0;

    // Check if only supplementary fields are filled
    analysis.onlySupplementaryFilled =
      filledSupplementary.length > 0 &&
      filledCompleteSet.length === 0 &&
      filledSufficient.length === 0;

    return analysis;
  }

  /**
   * Check if a field has content
   */
  private isFieldFilled(row: GridRowCore, fieldName: string): boolean {
    const value = row.data[fieldName] || '';
    return value && typeof value === 'string' && value.trim() !== '';
  }

  /**
   * Determine pricing and estimate preview eligibility
   */
  private checkPricingEligibility(analysis: FieldAnalysis): PricingEligibility {
    // Block pricing only for:
    // 1. Empty rows (handled earlier)
    // 2. Partial mandatory completion
    const allowPricing = !analysis.mandatoryPartiallyComplete;

    // Show in estimate preview only if:
    // 1. All complete_set fields complete (if any exist)
    // 2. OR at least one sufficient field filled
    const showInPreview =
      (analysis.hasMandatoryFields ? analysis.mandatoryComplete : true) &&
      (analysis.sufficientFieldsFilled || analysis.mandatoryComplete) &&
      !analysis.onlySupplementaryFilled;

    return { allowPricing, showInPreview };
  }

  /**
   * Check business rules and generate warnings
   */
  private checkBusinessRules(row: GridRowCore, analysis: FieldAnalysis): string[] {
    const warnings: string[] = [];

    // Warning: Only supplementary fields filled
    if (analysis.onlySupplementaryFilled) {
      warnings.push('Only supplementary fields filled - row will not appear in estimate preview');
    }

    // Warning: Sub-items should have meaningful data
    if (row.rowType === 'subItem' && analysis.filledFieldCategories.size === 0) {
      warnings.push('Sub-items should have at least one field filled to be included in calculations');
    }

    // Warning: Main products should have product type if data is entered
    if (row.rowType === 'main' && !row.productTypeId && analysis.filledFieldCategories.size > 0) {
      warnings.push('Main products should have a product type selected for accurate pricing');
    }

    return warnings;
  }

  /**
   * Get row status summary for UI display
   */
  getRowStatusSummary(row: GridRowCore, context?: ValidationContext): RowStatusSummary {
    const productValidation = this.productValidations.get(row.productTypeId || 0);
    if (!productValidation) {
      return {
        isEmpty: !this.hasAnyData(row),
        canPrice: this.hasAnyData(row),
        showInEstimate: this.hasAnyData(row),
        completionStatus: 'unknown'
      };
    }

    const analysis = this.analyzeFieldCompletion(row, productValidation, context);
    const pricing = this.checkPricingEligibility(analysis);

    let completionStatus: 'empty' | 'supplementary_only' | 'partial_mandatory' | 'sufficient' | 'complete';

    if (!this.hasAnyData(row)) {
      completionStatus = 'empty';
    } else if (analysis.onlySupplementaryFilled) {
      completionStatus = 'supplementary_only';
    } else if (analysis.mandatoryPartiallyComplete) {
      completionStatus = 'partial_complete_set';
    } else if (analysis.sufficientFieldsFilled || analysis.mandatoryComplete) {
      completionStatus = analysis.mandatoryComplete ? 'complete' : 'sufficient';
    } else {
      completionStatus = 'partial_mandatory';
    }

    return {
      isEmpty: !this.hasAnyData(row),
      canPrice: pricing.allowPricing,
      showInEstimate: pricing.showInPreview,
      completionStatus
    };
  }

  /**
   * Resolve field category based on static config and context
   */
  private resolveFieldCategory(
    config: FieldValidationConfig,
    context?: ValidationContext
  ): 'complete_set' | 'sufficient' | 'supplementary' {
    if (config.field_category === 'context_dependent') {
      // Handle context-dependent field categories
      // For now, default to sufficient - can be extended for specific business rules
      return 'sufficient';
    }

    // Return static category
    return config.field_category || 'supplementary';
  }
}

// Supporting interfaces
interface FieldAnalysis {
  hasMandatoryFields: boolean;
  hasSufficientFields: boolean;
  hasSupplementaryFields: boolean;
  mandatoryComplete: boolean;
  mandatoryPartiallyComplete: boolean;
  sufficientFieldsFilled: boolean;
  onlySupplementaryFilled: boolean;
  incompleteMandatoryFields: string[];
  filledFieldCategories: Set<'complete_set' | 'sufficient' | 'supplementary'>;
}

interface PricingEligibility {
  allowPricing: boolean;
  showInPreview: boolean;
}

export interface RowStatusSummary {
  isEmpty: boolean;
  canPrice: boolean;
  showInEstimate: boolean;
  completionStatus: 'empty' | 'supplementary_only' | 'partial_complete_set' | 'sufficient' | 'complete';
}