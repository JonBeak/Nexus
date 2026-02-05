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
import { OrderPart } from '../types/orders';

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
  cleanedSpecRows?: number;  // Count of empty spec rows removed during validation
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
   *
   * Also cleans up empty spec rows before validation (removes specs with no values)
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

    // NEW: Merge orphaned specs (parts without Item Name) to parent BEFORE cleanup
    const mergeResult = await this.mergeOrphanedSpecsToParent(parts);
    if (mergeResult.mergedCount > 0) {
      console.log(`[VALIDATION] Merged specs from ${mergeResult.mergedCount} part(s) without Item Name to parent parts`);
      // Re-fetch parts after merge
      const mergedParts = await orderPartRepository.getOrderParts(orderId);
      parts.length = 0;
      parts.push(...mergedParts);
    }

    // Add any merge errors (orphaned specs with no parent)
    errors.push(...mergeResult.errors);

    // Clean up empty spec rows BEFORE validation
    // This removes spec templates that have no filled-in values
    let cleanedSpecRows = 0;
    for (const part of parts) {
      const wasClean = await orderPartRepository.cleanEmptySpecRows(part.part_id);
      if (wasClean) cleanedSpecRows++;
    }
    if (cleanedSpecRows > 0) {
      console.log(`[VALIDATION] Cleaned empty specs from ${cleanedSpecRows} part(s)`);
      // Re-fetch parts after cleanup to validate clean data
      const cleanedParts = await orderPartRepository.getOrderParts(orderId);
      parts.length = 0;
      parts.push(...cleanedParts);
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
      standardizedSpecs,  // Available for PrepareOrderModal or future enhancements
      cleanedSpecRows     // Report how many parts had empty specs removed
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

    // 3. Validate prohibited fields (must be empty when condition is met)
    if (rule.prohibitedFields) {
      for (const prohibitedField of rule.prohibitedFields) {
        const { field, condition } = prohibitedField;
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

        // If condition is met, check if the field is NOT empty (violation)
        if (conditionMet) {
          const fieldValue = templateRow.fields[field];
          if (!isEmpty(fieldValue)) {
            context.prohibitedViolation = true;
          }
        }
      }
    }

    // 4. Validate OR fields (at least one from each group required)
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
    if (missingFields.length > 0 || context.orFieldsViolation || context.conditionalViolation || context.prohibitedViolation) {
      errors.push({
        field: 'specifications',
        message: rule.errorMessage(missingFields, context),
        partNumber: partNumber,
        templateName: templateRow.templateName
      });
    }

    return errors;
  }

  // =============================================
  // ORPHANED SPECS MERGE OPERATIONS
  // =============================================

  /**
   * Merge specs from parts without Item Name to the first part above with Item Name
   * Called BEFORE cleanEmptySpecRows to preserve orphaned specs
   *
   * When a part has no specs_display_name (Item Name not selected) but has spec data,
   * those specs would otherwise be deleted by cleanEmptySpecRows. This method
   * preserves them by merging into the nearest parent part that has an Item Name.
   */
  private async mergeOrphanedSpecsToParent(parts: OrderPart[]): Promise<{
    mergedCount: number;
    errors: ValidationError[];
  }> {
    let mergedCount = 0;
    const errors: ValidationError[] = [];

    // Parts are already ordered by part_number
    // Track the last part that had an Item Name selection
    let lastParentWithItemName: OrderPart | null = null;

    for (const part of parts) {
      // Skip header rows
      if (part.is_header_row) {
        continue;
      }

      if (part.specs_display_name) {
        // This part has an Item Name - it can receive orphaned specs
        lastParentWithItemName = part;
      } else {
        // This part has NO Item Name
        // Check if it has any specs that need merging
        const specs = typeof part.specifications === 'string'
          ? JSON.parse(part.specifications)
          : part.specifications;

        if (specs && this.hasAnySpecs(specs)) {
          if (lastParentWithItemName) {
            // Merge these specs into the parent
            await this.mergeSpecsIntoParent(part, lastParentWithItemName);
            mergedCount++;
            console.log(`[VALIDATION] Merged specs from part ${part.part_number} (no Item Name) into part ${lastParentWithItemName.part_number}`);
          } else {
            // No valid parent found - add validation error
            errors.push({
              field: 'specifications',
              message: `Part ${part.part_number} has specifications but no Item Name selected, and no parent part above to merge into`,
              partNumber: part.part_number
            });
          }
        }
      }
    }

    return { mergedCount, errors };
  }

  /**
   * Check if a specifications object has any template rows with values
   */
  private hasAnySpecs(specs: Record<string, any>): boolean {
    if (!specs || typeof specs !== 'object') {
      return false;
    }

    // Find all template keys
    const templateKeys = Object.keys(specs).filter(key => key.match(/^_template(_\d+)?$/));

    for (const templateKey of templateKeys) {
      const templateName = specs[templateKey];
      if (!templateName || templateName.trim() === '') {
        continue;
      }

      // Get row number from template key
      const rowNum = templateKey === '_template' ? '' : templateKey.replace('_template_', '');
      const rowPrefix = rowNum ? `row${rowNum}_` : 'row_';

      // Check if any field for this row has a value
      for (const key of Object.keys(specs)) {
        if (key.startsWith(rowPrefix)) {
          const value = specs[key];
          if (value !== null && value !== undefined && value !== '') {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Merge spec rows from source part into target parent part
   * Copies each template row from source to parent with new sequential row numbers
   */
  private async mergeSpecsIntoParent(sourcePart: OrderPart, parentPart: OrderPart): Promise<void> {
    // Parse source specs
    const sourceSpecs = typeof sourcePart.specifications === 'string'
      ? JSON.parse(sourcePart.specifications)
      : sourcePart.specifications || {};

    // Parse parent specs
    const parentSpecs = typeof parentPart.specifications === 'string'
      ? JSON.parse(parentPart.specifications)
      : parentPart.specifications || {};

    // Find the next available row number in parent
    const parentTemplateKeys = Object.keys(parentSpecs).filter(key => key.match(/^_template(_\d+)?$/));
    let nextRowNum = 1;
    for (const key of parentTemplateKeys) {
      const num = key === '_template' ? 0 : parseInt(key.replace('_template_', ''), 10);
      if (num >= nextRowNum) {
        nextRowNum = num + 1;
      }
    }

    // Extract valid template rows from source
    const sourceTemplateKeys = Object.keys(sourceSpecs)
      .filter(key => key.match(/^_template(_\d+)?$/))
      .sort((a, b) => {
        const numA = a === '_template' ? 0 : parseInt(a.replace('_template_', ''), 10);
        const numB = b === '_template' ? 0 : parseInt(b.replace('_template_', ''), 10);
        return numA - numB;
      });

    // Copy each template row from source to parent with new row numbers
    for (const sourceTemplateKey of sourceTemplateKeys) {
      const templateName = sourceSpecs[sourceTemplateKey];
      if (!templateName || templateName.trim() === '') {
        continue;
      }

      const sourceRowNum = sourceTemplateKey === '_template' ? '' : sourceTemplateKey.replace('_template_', '');
      const sourceRowPrefix = sourceRowNum ? `row${sourceRowNum}_` : 'row_';

      // Check if this row has any values
      let hasValues = false;
      const fields: Record<string, any> = {};

      for (const key of Object.keys(sourceSpecs)) {
        if (key.startsWith(sourceRowPrefix)) {
          const fieldName = key.replace(sourceRowPrefix, '');
          const value = sourceSpecs[key];
          fields[fieldName] = value;
          if (value !== null && value !== undefined && value !== '') {
            hasValues = true;
          }
        }
      }

      // Only copy if row has values
      if (hasValues) {
        // Add template to parent with new row number
        parentSpecs[`_template_${nextRowNum}`] = templateName;

        // Add all fields with new row prefix
        for (const [fieldName, value] of Object.entries(fields)) {
          parentSpecs[`row${nextRowNum}_${fieldName}`] = value;
        }

        nextRowNum++;
      }
    }

    // Update parent's _row_count
    parentSpecs._row_count = nextRowNum - 1;

    // Save parent specs to database
    await orderPartRepository.updateOrderPart(parentPart.part_id, {
      specifications: parentSpecs
    });

    // Clear source part's specs (set to minimal object)
    await orderPartRepository.updateOrderPart(sourcePart.part_id, {
      specifications: { _row_count: 1 }
    });
  }
}

export const orderValidationService = new OrderValidationService();
