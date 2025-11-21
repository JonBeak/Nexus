// File Clean up Finished: 2025-11-20
// Changes:
//   - Removed 3 unused dynamic methods: addValidationRule(), removeValidationRule(), getValidationRules()
//   - Extracted validation rules to orderValidationRules.ts (separation of concerns - data vs logic)
//   - File reduced from 535 → 289 lines (saved 246 lines, well below 500 line limit!)
//   - New file: orderValidationRules.ts (236 lines) - centralized rule configuration
//   - Architecture: ✓ Clean 3-layer (Route → Controller → Service → Repository)
//   - Database: ✓ No direct DB calls (uses orderRepository.getOrderParts)
//   - Dependencies: ✓ All cleaned (orderRepository, orderSpecificationStandardizationService)

/**
 * Order Validation Service
 * Business logic for validating orders before preparation
 *
 * Created: 2025-11-20
 * Enhanced: 2025-11-20 - Added access to standardized specs alongside raw specs
 *
 * Handles specification validation rules for order preparation workflow.
 * Provides validation logic with access to BOTH:
 * - Raw specifications (database JSON structure)
 * - Standardized specifications (sorted, grouped, ready for PDF/tasks)
 */

import { orderPartRepository } from '../repositories/orderPartRepository';
import { standardizeOrderSpecifications, StandardizedOrderSpecs } from './orderSpecificationStandardizationService';
import { SPEC_VALIDATION_RULES, SpecValidationRule } from './orderValidationRules';

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  partNumber?: number;
  templateName?: string;
}

/**
 * Validation result with both raw and standardized specs
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  standardizedSpecs?: StandardizedOrderSpecs;  // Available for additional validation or processing
}

export class OrderValidationService {
  /**
   * Validation rules loaded from configuration
   * See orderValidationRules.ts for rule definitions
   */
  private specValidationRules: SpecValidationRule[] = SPEC_VALIDATION_RULES;

  /**
   * Validate order for preparation
   *
   * Returns validation result with access to BOTH:
   * - Raw part specifications (validated via extractTemplateRows)
   * - Standardized specifications (sorted, grouped, ready for PDF/tasks)
   */
  async validateOrderForPreparation(orderId: number): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Get all order parts (raw data)
    const parts = await orderPartRepository.getOrderParts(orderId);

    if (!parts || parts.length === 0) {
      errors.push({
        field: 'order_parts',
        message: 'Order has no parts to validate'
      });
      return { isValid: false, errors };
    }

    // Validate each part's raw specifications
    for (const part of parts) {
      const partErrors = this.validatePartSpecifications(part);
      errors.push(...partErrors);
    }

    // Generate standardized specifications (for additional validation or reference)
    let standardizedSpecs: StandardizedOrderSpecs | undefined;
    try {
      standardizedSpecs = await standardizeOrderSpecifications(orderId, 'master');
      console.log(`[VALIDATION] Generated standardized specs: ${standardizedSpecs.flattenedSpecs.length} total specs across ${standardizedSpecs.partColumns.length} columns`);
    } catch (error) {
      console.error('[VALIDATION] Failed to generate standardized specs:', error);
      // Don't fail validation if standardization fails - raw validation is primary
    }

    return {
      isValid: errors.length === 0,
      errors,
      standardizedSpecs  // Available for PrepareOrderModal or future enhancements
    };
  }

  /**
   * Validate specifications for a single part
   */
  private validatePartSpecifications(part: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!part.specifications) {
      return errors;
    }

    try {
      // Parse specifications JSON
      const specs = typeof part.specifications === 'string'
        ? JSON.parse(part.specifications)
        : part.specifications;

      if (!specs || Object.keys(specs).length === 0) {
        return errors;
      }

      // Find all template rows in the specifications
      const templateRows = this.extractTemplateRows(specs);

      // Validate each template row against rules
      for (const templateRow of templateRows) {
        const rule = this.specValidationRules.find(
          r => r.templateName === templateRow.templateName
        );

        if (rule) {
          const rowErrors = this.validateTemplateRow(
            part.part_number,
            templateRow,
            rule
          );
          errors.push(...rowErrors);
        }
      }
    } catch (error) {
      console.error('Error parsing part specifications:', error);
      errors.push({
        field: 'specifications',
        message: `Invalid specification format for part ${part.part_number}`,
        partNumber: part.part_number
      });
    }

    return errors;
  }

  /**
   * Extract template rows from specifications
   */
  private extractTemplateRows(specs: Record<string, any>): Array<{
    templateName: string;
    rowNum: string;
    fields: Record<string, any>;
  }> {
    const templateRows: Array<{
      templateName: string;
      rowNum: string;
      fields: Record<string, any>;
    }> = [];

    // Find all _template_N keys
    Object.keys(specs).forEach(key => {
      if (key.startsWith('_template_')) {
        const rowNum = key.replace('_template_', '');
        const templateName = specs[key];

        if (!templateName) return;

        // Collect all fields for this row
        const fields: Record<string, any> = {};
        Object.keys(specs).forEach(fieldKey => {
          if (fieldKey.startsWith(`row${rowNum}_`)) {
            const fieldName = fieldKey.replace(`row${rowNum}_`, '');
            fields[fieldName] = specs[fieldKey];
          }
        });

        templateRows.push({
          templateName,
          rowNum,
          fields
        });
      }
    });

    return templateRows;
  }

  /**
   * Validate a single template row against its rule
   * Supports: simple required fields, conditional fields, and OR logic
   */
  private validateTemplateRow(
    partNumber: number,
    templateRow: { templateName: string; rowNum: string; fields: Record<string, any> },
    rule: SpecValidationRule
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const missingFields: string[] = [];
    const context: any = {};

    // Helper: Check if a field value is empty
    const isEmpty = (value: any): boolean => {
      if (value === null || value === undefined || value === '') {
        return true;
      }
      if (typeof value === 'string' && value.trim() === '') {
        return true;
      }
      // For boolean fields, false is a valid value (not empty)
      if (typeof value === 'boolean') {
        return false;
      }
      return false;
    };

    // 1. Validate simple required fields
    if (rule.requiredFields) {
      for (const requiredField of rule.requiredFields) {
        const value = templateRow.fields[requiredField];
        if (isEmpty(value)) {
          missingFields.push(requiredField);
        }
      }
    }

    // 2. Validate conditional required fields
    if (rule.conditionalFields) {
      for (const conditionalField of rule.conditionalFields) {
        const { field, condition } = conditionalField;
        const conditionValue = templateRow.fields[condition.field];
        const operator = condition.operator || 'equals';

        // Check if condition is met
        let conditionMet = false;
        switch (operator) {
          case 'equals':
            conditionMet = conditionValue === condition.value;
            break;
          case 'notEquals':
            conditionMet = conditionValue !== condition.value;
            break;
          case 'exists':
            conditionMet = !isEmpty(conditionValue);
            break;
        }

        // If condition is met, check if the field has a value
        if (conditionMet) {
          const fieldValue = templateRow.fields[field];
          if (isEmpty(fieldValue)) {
            missingFields.push(field);
            context.conditionalViolation = true;
          }
        }
      }
    }

    // 3. Validate OR fields (at least one from each group required)
    if (rule.orFields) {
      for (const orGroup of rule.orFields) {
        // Check if at least one field in the group has a value
        const hasValue = orGroup.some(fieldName => {
          const value = templateRow.fields[fieldName];
          return !isEmpty(value);
        });

        if (!hasValue) {
          // None of the fields in the OR group have values
          context.orFieldsViolation = true;
        }
      }
    }

    // Generate error if any validation failed
    if (missingFields.length > 0 || context.orFieldsViolation || context.conditionalViolation) {
      errors.push({
        field: 'specifications',
        message: rule.errorMessage(missingFields, context),
        partNumber: partNumber,
        templateName: templateRow.templateName
      });
    }

    return errors;
  }
}

export const orderValidationService = new OrderValidationService();
