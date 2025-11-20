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

import { orderRepository } from '../repositories/orderRepository';
import { standardizeOrderSpecifications, StandardizedOrderSpecs } from './orderSpecificationStandardizationService';

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

/**
 * Specification validation rules configuration
 * Supports:
 * - Simple required fields
 * - Conditional required fields (field required based on another field's value)
 * - OR logic (at least one of multiple fields required)
 */
interface SpecValidationRule {
  templateName: string;
  requiredFields?: string[];  // Simple required fields (all must be present)
  conditionalFields?: ConditionalField[];  // Fields required based on conditions
  orFields?: string[][];  // Array of field groups where at least one from each group is required
  errorMessage: (missingFields: string[], context?: any) => string;
}

/**
 * Conditional field requirement
 * Field is required only when the condition is met
 */
interface ConditionalField {
  field: string;  // The field that may be required
  condition: {
    field: string;  // The field to check
    value: any;  // The value that triggers the requirement (supports true, false, string values)
    operator?: 'equals' | 'notEquals' | 'exists';  // Comparison operator (default: equals)
  };
}

export class OrderValidationService {
  /**
   * Comprehensive validation rules for all specification templates
   * Updated: 2025-11-20 - Complete validation coverage
   */
  private specValidationRules: SpecValidationRule[] = [
    // ============================================
    // CONSTRUCTION SPECS
    // ============================================
    {
      templateName: 'Face',
      requiredFields: ['material', 'colour'],
      errorMessage: (missing) =>
        `Face specification requires both material and colour. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Back',
      requiredFields: ['material'],
      errorMessage: (missing) =>
        `Back specification requires material`
    },
    {
      templateName: 'Material',
      requiredFields: ['substrate', 'colour'],
      errorMessage: (missing) =>
        `Material specification requires both substrate and colour. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Neon Base',
      requiredFields: ['thickness', 'material', 'colour'],
      errorMessage: (missing) =>
        `Neon Base specification requires thickness, material, and colour. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Box Material',
      requiredFields: ['material', 'colour'],
      errorMessage: (missing) =>
        `Box Material specification requires both material and colour. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Return',
      requiredFields: ['depth', 'colour'],
      errorMessage: (missing) =>
        `Return specification requires both depth and colour. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Trim',
      requiredFields: ['colour'],
      errorMessage: (missing) =>
        `Trim specification requires colour`
    },

    // ============================================
    // FABRICATION SPECS
    // ============================================
    {
      templateName: 'Extr. Colour',
      requiredFields: ['colour'],
      errorMessage: (missing) =>
        `Extr. Colour specification requires colour`
    },
    {
      templateName: 'Cutting',
      requiredFields: ['method'],
      errorMessage: (missing) =>
        `Cutting specification requires method`
    },
    {
      templateName: 'Acrylic',
      requiredFields: ['thickness', 'colour'],
      errorMessage: (missing) =>
        `Acrylic specification requires both thickness and colour. Missing: ${missing.join(', ')}`
    },

    // ============================================
    // GRAPHICS/FINISHING SPECS
    // ============================================
    {
      templateName: 'Vinyl',
      requiredFields: ['colours', 'application', 'size'],
      errorMessage: (missing) =>
        `Vinyl specification requires colours, application, and size. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Digital Print',
      requiredFields: ['colour', 'type', 'application'],
      errorMessage: (missing) =>
        `Digital Print specification requires colour, type, and application. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Painting',
      requiredFields: ['colour', 'component', 'timing'],
      errorMessage: (missing) =>
        `Painting specification requires colour, component, and timing. Missing: ${missing.join(', ')}`
    },

    // ============================================
    // ASSEMBLY SPECS
    // ============================================
    {
      templateName: 'D-Tape',
      requiredFields: ['include', 'thickness'],
      errorMessage: (missing) =>
        `D-Tape specification requires include (yes/no) and thickness. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Pins',
      requiredFields: ['count'],
      orFields: [['pins', 'spacers']],  // At least one of pins OR spacers required
      errorMessage: (missing, context) => {
        if (missing.includes('count')) {
          return `Pins specification requires count. Missing: ${missing.join(', ')}`;
        }
        if (context?.orFieldsViolation) {
          return `Pins specification requires either pins or spacers to be specified`;
        }
        return `Pins specification is incomplete. Missing: ${missing.join(', ')}`;
      }
    },
    {
      templateName: 'Cut',
      requiredFields: ['include'],
      errorMessage: (missing) =>
        `Cut specification requires include (yes/no)`
    },
    {
      templateName: 'Peel',
      requiredFields: ['include'],
      errorMessage: (missing) =>
        `Peel specification requires include (yes/no)`
    },
    {
      templateName: 'Mask',
      requiredFields: ['include'],
      errorMessage: (missing) =>
        `Mask specification requires include (yes/no)`
    },
    // Assembly template - no required fields
    // Notes template - no required fields

    // ============================================
    // ELECTRICAL SPECS
    // ============================================
    {
      templateName: 'LEDs',
      requiredFields: ['count', 'led_type'],
      errorMessage: (missing) =>
        `LEDs specification requires count and LED type. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Neon LED',
      requiredFields: ['stroke_width', 'colour'],
      errorMessage: (missing) =>
        `Neon LED specification requires stroke width and colour. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Power Supply',
      requiredFields: ['count', 'ps_type'],
      errorMessage: (missing) =>
        `Power Supply specification requires count and PS type. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'Wire Length',
      requiredFields: ['length', 'wire_gauge'],
      errorMessage: (missing) =>
        `Wire Length specification requires length and wire gauge. Missing: ${missing.join(', ')}`
    },
    {
      templateName: 'UL',
      requiredFields: ['include'],
      errorMessage: (missing) =>
        `UL specification requires include (yes/no)`
    },

    // ============================================
    // OTHER SPECS
    // ============================================
    {
      templateName: 'Drain Holes',
      requiredFields: ['include'],
      conditionalFields: [
        {
          field: 'size',
          condition: { field: 'include', value: true, operator: 'equals' }
        }
      ],
      errorMessage: (missing, context) => {
        if (missing.includes('include')) {
          return `Drain Holes specification requires include (yes/no)`;
        }
        if (context?.conditionalViolation) {
          return `Drain Holes size is required when include is set to yes`;
        }
        return `Drain Holes specification is incomplete. Missing: ${missing.join(', ')}`;
      }
    }
    // Notes template - no required fields (optional)
  ];

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
    const parts = await orderRepository.getOrderParts(orderId);

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

  /**
   * Add a new validation rule
   * Useful for dynamically adding rules without modifying the service
   */
  addValidationRule(rule: SpecValidationRule): void {
    // Check if rule already exists for this template
    const existingIndex = this.specValidationRules.findIndex(
      r => r.templateName === rule.templateName
    );

    if (existingIndex >= 0) {
      // Replace existing rule
      this.specValidationRules[existingIndex] = rule;
    } else {
      // Add new rule
      this.specValidationRules.push(rule);
    }
  }

  /**
   * Remove a validation rule by template name
   */
  removeValidationRule(templateName: string): void {
    this.specValidationRules = this.specValidationRules.filter(
      r => r.templateName !== templateName
    );
  }

  /**
   * Get all current validation rules
   */
  getValidationRules(): SpecValidationRule[] {
    return [...this.specValidationRules];
  }
}

export const orderValidationService = new OrderValidationService();
