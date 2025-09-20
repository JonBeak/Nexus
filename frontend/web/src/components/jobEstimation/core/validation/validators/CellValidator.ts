// Cell-level validation using templates
// Validates individual field values against their configured rules

import { ValidationTemplateRegistry } from '../templates/ValidationTemplateRegistry';
import { ValidationResult, ValidationContext } from '../templates/ValidationTemplate';
import { FieldValidationConfig } from '../ValidationEngine';

export class CellValidator {
  constructor(
    private templateRegistry: ValidationTemplateRegistry,
    private productValidations: Map<number, Record<string, FieldValidationConfig>>
  ) {}

  /**
   * Validate a single cell value using its configured template
   * @param fieldName - Field name being validated
   * @param value - Field value to validate
   * @param config - Validation configuration for this field
   * @param context - Optional validation context with customer prefs and grid state
   * @returns Validation result
   */
  async validateCell(
    fieldName: string,
    value: string,
    config: FieldValidationConfig,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    try {
      // Get the validation template
      const template = this.templateRegistry.getTemplate(config.function);
      if (!template) {
        return {
          isValid: false,
          error: `Unknown validation function: ${config.function}`,
          expectedFormat: 'Valid validation function required'
        };
      }

      // Execute validation with template-specific parameters and context
      const result = await template.validate(value, config.params, context);

      // Override error message if custom message is provided
      if (!result.isValid && config.error_message) {
        result.error = config.error_message;
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error.message}`,
        expectedFormat: 'Valid input required'
      };
    }
  }

  /**
   * Validate multiple cells for a row (batch operation for efficiency)
   * @param rowId - Row identifier
   * @param productTypeId - Product type to get validation config
   * @param fieldData - Field name -> value mapping
   * @returns Map of field name -> validation result
   */
  async validateRowCells(
    rowId: string,
    productTypeId: number,
    fieldData: Record<string, string>
  ): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();

    // Get validation config for this product type
    const productValidation = this.productValidations.get(productTypeId);
    if (!productValidation) {
      return results; // No validation rules configured
    }

    // Validate each configured field
    const validationPromises: Promise<void>[] = [];

    for (const [fieldName, fieldConfig] of Object.entries(productValidation)) {
      const fieldValue = fieldData[fieldName] || '';

      validationPromises.push(
        this.validateCell(fieldName, fieldValue, fieldConfig)
          .then(result => {
            results.set(fieldName, result);
          })
      );
    }

    // Execute all validations in parallel
    await Promise.all(validationPromises);

    return results;
  }

  /**
   * Check if a field should be validated based on its config and value
   * @param fieldValue - Current field value
   * @param config - Field validation configuration
   * @returns True if field should be validated
   */
  shouldValidateField(fieldValue: string, config: FieldValidationConfig): boolean {
    // Always validate if it's an error-level rule (required fields)
    if (config.error_level === 'error') {
      return true;
    }

    // For warning-level rules, only validate if field has content
    return fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '';
  }

  /**
   * Get validation template info for a field (for UI help text)
   * @param functionName - Template function name
   * @returns Template information or null
   */
  getTemplateInfo(functionName: string): { description: string; parameters: Record<string, any> } | null {
    return this.templateRegistry.getTemplateInfo(functionName);
  }
}