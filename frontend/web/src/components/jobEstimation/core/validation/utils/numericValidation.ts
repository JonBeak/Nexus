// Shared numeric validation utility - provides strict validation patterns
// Used across all validation templates to ensure consistent behavior

export interface NumericValidationOptions {
  allowNegative?: boolean;
  minValue?: number;
  maxValue?: number;
  decimalPlaces?: number;
  allowEmpty?: boolean;
}

export interface NumericValidationResult {
  isValid: boolean;
  value?: number;
  error?: string;
}

/**
 * Strictly validate and parse numeric input - rejects partial matches unlike parseFloat()
 *
 * @param input Raw input string
 * @param options Validation constraints
 * @returns Validation result with parsed value or error
 */
export function validateNumericInput(
  input: string | undefined | null,
  options: NumericValidationOptions = {}
): NumericValidationResult {
  const {
    allowNegative = true,
    minValue,
    maxValue,
    decimalPlaces,
    allowEmpty = true
  } = options;

  // Handle empty/null/undefined
  if (!input || (typeof input === 'string' && input.trim() === '')) {
    if (allowEmpty) {
      return { isValid: true };
    }
    return { isValid: false, error: 'Value is required' };
  }

  const cleanInput = input.trim();

  // Strict regex validation - matches entire string, no partial parsing
  const negativePattern = allowNegative ? '-?' : '';
  const decimalPattern = decimalPlaces === 0 ? '' : '(\\.\\d+)?';
  const strictNumericRegex = new RegExp(`^${negativePattern}\\d+${decimalPattern}$`);

  if (!strictNumericRegex.test(cleanInput)) {
    return {
      isValid: false,
      error: `Invalid number format. Expected: ${getExpectedFormat(options)}`
    };
  }

  // Parse the validated input
  const numericValue = parseFloat(cleanInput);

  // Additional validations
  if (!allowNegative && numericValue < 0) {
    return { isValid: false, error: 'Negative values are not allowed' };
  }

  if (minValue !== undefined && numericValue < minValue) {
    return { isValid: false, error: `Value must be at least ${minValue}` };
  }

  if (maxValue !== undefined && numericValue > maxValue) {
    return { isValid: false, error: `Value must not exceed ${maxValue}` };
  }

  if (decimalPlaces !== undefined) {
    const decimalStr = cleanInput.split('.')[1];
    if (decimalStr && decimalStr.length > decimalPlaces) {
      return {
        isValid: false,
        error: `Maximum ${decimalPlaces} decimal places allowed`
      };
    }
  }

  return { isValid: true, value: numericValue };
}

/**
 * Generate user-friendly format description
 */
function getExpectedFormat(options: NumericValidationOptions): string {
  const parts: string[] = [];

  if (options.allowNegative === false) {
    parts.push('positive');
  }

  if (options.decimalPlaces === 0) {
    parts.push('whole number');
  } else if (options.decimalPlaces !== undefined) {
    parts.push(`number with up to ${options.decimalPlaces} decimal places`);
  } else {
    parts.push('number');
  }

  if (options.minValue !== undefined || options.maxValue !== undefined) {
    if (options.minValue !== undefined && options.maxValue !== undefined) {
      parts.push(`between ${options.minValue} and ${options.maxValue}`);
    } else if (options.minValue !== undefined) {
      parts.push(`≥ ${options.minValue}`);
    } else if (options.maxValue !== undefined) {
      parts.push(`≤ ${options.maxValue}`);
    }
  }

  return parts.join(' ');
}

/**
 * Validate integer input (whole numbers only)
 */
export function validateIntegerInput(
  input: string | undefined | null,
  options: Omit<NumericValidationOptions, 'decimalPlaces'> = {}
): NumericValidationResult {
  return validateNumericInput(input, { ...options, decimalPlaces: 0 });
}

/**
 * Quick validation check - returns true if input is a valid number
 */
export function isValidNumeric(
  input: string | undefined | null,
  options: NumericValidationOptions = {}
): boolean {
  return validateNumericInput(input, options).isValid;
}