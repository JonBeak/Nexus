// Base abstract class for all validation templates
// Provides common functionality to eliminate code duplication across templates

import { ValidationTemplate, ValidationResult, ValidationContext } from './ValidationTemplate';

/**
 * Abstract base class for validation templates
 *
 * Provides:
 * - Standard empty value handling
 * - Consistent error formatting
 * - Consistent success result creation
 * - Common validation utilities
 *
 * Subclasses must implement:
 * - validate() - Core validation logic
 * - generateExpectedFormat() - Format description for users
 * - getDescription() - Template description
 * - getParameterSchema() - Parameter schema definition
 */
export abstract class BaseValidationTemplate implements ValidationTemplate {
  /**
   * Handle empty/null values with standard response
   *
   * Default behavior: returns valid result with null parsedValue and default calculatedValue
   *
   * Subclasses can override if custom empty value handling is needed
   * (e.g., FloatTemplate treats empty as error for required fields)
   *
   * @param defaultValue - The default value to use when input is empty
   * @param params - Template parameters for generateExpectedFormat
   * @returns ValidationResult indicating success with null parsed value
   */
  protected handleEmptyValue(defaultValue: unknown, params: Record<string, unknown>): ValidationResult {
    return {
      isValid: true,
      parsedValue: null,
      calculatedValue: defaultValue,
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Create a validation error result with consistent formatting
   *
   * @param message - Human-readable error message
   * @param params - Template parameters for generateExpectedFormat
   * @param parsedValue - Optional parsed value (defaults to null)
   * @returns ValidationResult indicating validation failure
   */
  protected createError(
    message: string,
    params: Record<string, unknown>,
    parsedValue?: unknown
  ): ValidationResult {
    return {
      isValid: false,
      error: message,
      parsedValue: parsedValue ?? null,
      calculatedValue: null,
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Create a validation success result with consistent formatting
   *
   * @param parsedValue - The successfully parsed value
   * @param calculatedValue - The calculated value (may be same as parsedValue)
   * @param params - Template parameters for generateExpectedFormat
   * @returns ValidationResult indicating validation success
   */
  protected createSuccess(
    parsedValue: unknown,
    calculatedValue: unknown,
    params: Record<string, unknown>
  ): ValidationResult {
    return {
      isValid: true,
      parsedValue,
      calculatedValue,
      expectedFormat: this.generateExpectedFormat(params)
    };
  }

  /**
   * Wrap validation logic with standard error handling
   *
   * Use this in subclass validate() methods to ensure consistent error formatting:
   *
   * async validate(value: string, params: MyParams, context?: ValidationContext) {
   *   return this.wrapValidation(params, async () => {
   *     // Your validation logic here
   *   });
   * }
   *
   * @param params - Template parameters for error formatting
   * @param validationFn - Async function containing validation logic
   * @returns ValidationResult from validationFn or formatted error
   */
  protected async wrapValidation(
    params: Record<string, unknown>,
    validationFn: () => Promise<ValidationResult>
  ): Promise<ValidationResult> {
    try {
      return await validationFn();
    } catch (error) {
      return this.createError(
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        params
      );
    }
  }

  // Abstract methods that subclasses MUST implement

  /**
   * Validates a field value using template-specific logic
   *
   * @param value - The field value to validate
   * @param params - Template-specific parameters
   * @param context - Optional validation context with customer prefs and grid state
   * @returns Validation result with success/error information
   */
  abstract validate(
    value: string,
    params: Record<string, unknown>,
    context?: ValidationContext
  ): Promise<ValidationResult>;

  /**
   * Generate expected format description for users
   *
   * This should return a human-readable string describing what format is expected
   * Examples: "numbers (decimals allowed)", "WxH in inches", "yes/no/number"
   *
   * @param params - Template parameters that affect format description
   * @returns Human-readable format description
   */
  protected abstract generateExpectedFormat(params: Record<string, unknown>): string;

  /**
   * Returns a human-readable description of what this template validates
   *
   * @returns Description string
   */
  abstract getDescription(): string;

  /**
   * Returns the expected parameter schema for this template
   *
   * @returns Parameter schema definition
   */
  abstract getParameterSchema(): Record<string, unknown>;
}
