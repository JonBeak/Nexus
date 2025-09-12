/**
 * ValidationStyler - Centralized validation styling utility
 * 
 * Extracted from FieldRenderer to separate validation styling concerns
 * from field rendering logic. This utility provides consistent styling
 * for validation states across form components.
 * 
 * Refactoring Phase R1: Extract validation styling logic
 */

export interface ValidationStyleResult {
  fieldClasses: string;
  errorTitle?: string;
}

/**
 * Get CSS classes and error title for a field based on validation state
 * 
 * @param hasErrors - Whether the field has validation errors
 * @param hasValue - Whether the field has a non-empty value
 * @param validationErrors - Array of validation error messages (optional)
 * @returns Object with fieldClasses and errorTitle
 */
export const getValidationStyling = (
  hasErrors: boolean,
  hasValue: boolean,
  validationErrors?: string[]
): ValidationStyleResult => {
  // Get field CSS classes based on validation and value state
  const fieldClasses = getFieldClasses(hasErrors, hasValue);
  
  // Get error title for tooltip
  const errorTitle = getErrorTitle(hasErrors, validationErrors);
  
  return {
    fieldClasses,
    errorTitle
  };
};

/**
 * Get CSS classes for field styling based on validation and value state
 * 
 * Priority order:
 * 1. Error styling (red borders) - ALWAYS takes priority
 * 2. Value styling (black borders for filled fields)
 * 3. Default styling (transparent, no borders)
 * 
 * Extracted from FieldRenderer lines 103-114
 */
const getFieldClasses = (hasErrors: boolean, hasValue: boolean): string => {
  // Error styling ALWAYS takes priority over value styling
  if (hasErrors) {
    return hasValue 
      ? 'border-2 border-red-500 bg-red-50 font-bold text-black'
      : 'border-2 border-red-500 bg-red-50';
  }
  if (hasValue) {
    return 'border border-black font-bold bg-white';
  }
  return 'border-none bg-transparent';
};

/**
 * Get error message title for field tooltip
 * 
 * Extracted from FieldRenderer lines 117-120
 */
const getErrorTitle = (hasErrors: boolean, validationErrors?: string[]): string | undefined => {
  if (!hasErrors || !validationErrors) return undefined;
  return validationErrors.join('; ');
};

/**
 * Convenience function for common use case - just get CSS classes
 */
export const getValidationClasses = (
  hasErrors: boolean, 
  hasValue: boolean
): string => {
  return getFieldClasses(hasErrors, hasValue);
};

/**
 * Convenience function for getting error title only
 */
export const getValidationTitle = (
  hasErrors: boolean,
  validationErrors?: string[]
): string | undefined => {
  return getErrorTitle(hasErrors, validationErrors);
};