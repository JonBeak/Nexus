/**
 * Folder Name Validation for Windows Compatibility (Frontend)
 *
 * Client-side validation for customer names, job names, and order names.
 * Mirrors backend validation logic for immediate user feedback.
 *
 * Key Difference:
 * - Customer names: Cannot end with periods or spaces (they're at the END of folder path)
 * - Job/Order names: CAN end with periods, but NOT spaces (they're in the MIDDLE of folder path)
 *
 * Folder format: "{order_name} ----- {customer_name}"
 *
 * @module utils/folderNameValidation
 * @created 2025-11-21
 * @see /home/jon/Nexus/JOB_ORDER_NAME_VALIDATION.md
 * @see /home/jon/Nexus/CUSTOMER_NAME_VALIDATION_RULES.md
 */

export interface FolderNameValidationResult {
  isValid: boolean;
  error: string | null;
  sanitized: string; // Auto-trimmed version
}

export interface FolderNameValidationOptions {
  allowTrailingPeriod: boolean;  // true for job/order names, false for customer names
  maxLength?: number;            // default 200
  fieldName?: string;            // for error messages, e.g., "Job name", "Order name", "Company name"
}

// Allowlist: Only allow safe characters for Windows folder names
// Includes: letters, numbers, Latin Extended-A (accents), space, and common business punctuation
const VALID_CHARS = /^[a-zA-Z0-9\u00C0-\u017F \-_.,&'()]+$/;

// Trailing spaces are ALWAYS problematic (Windows strips them)
const INVALID_TRAILING_SPACE = /\s+$/;

// Trailing periods are problematic ONLY for customer names (end of folder path)
const INVALID_TRAILING_PERIOD = /\.+$/;

// Leading period check (creates hidden folders on Unix)
const INVALID_LEADING_PERIOD = /^\./;

// Windows reserved names (case-insensitive)
const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

const DEFAULT_MAX_LENGTH = 200;

/**
 * Core validation function for folder names
 *
 * @param name - The name to validate
 * @param options - Validation options
 * @returns Validation result with isValid, error, and sanitized name
 */
export function validateFolderName(
  name: string | null | undefined,
  options: FolderNameValidationOptions
): FolderNameValidationResult {
  const {
    allowTrailingPeriod,
    maxLength = DEFAULT_MAX_LENGTH,
    fieldName = 'Name'
  } = options;

  // Handle null/undefined
  if (!name) {
    return {
      isValid: false,
      error: `${fieldName} is required`,
      sanitized: ''
    };
  }

  // Trim whitespace
  const sanitized = name.trim();

  // Check empty after trim
  if (!sanitized) {
    return {
      isValid: false,
      error: `${fieldName} cannot be empty or only whitespace`,
      sanitized: ''
    };
  }

  // Check length
  if (sanitized.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} must be ${maxLength} characters or less`,
      sanitized
    };
  }

  // Check allowed characters only (allowlist approach)
  if (!VALID_CHARS.test(sanitized)) {
    return {
      isValid: false,
      error: `${fieldName} contains invalid characters. Only letters, numbers, spaces, and these symbols are allowed: - _ . , & ' ( )`,
      sanitized
    };
  }

  // Check leading period
  if (INVALID_LEADING_PERIOD.test(sanitized)) {
    return {
      isValid: false,
      error: `${fieldName} cannot start with a period`,
      sanitized
    };
  }

  // Check trailing spaces (ALWAYS invalid)
  if (INVALID_TRAILING_SPACE.test(sanitized)) {
    return {
      isValid: false,
      error: `${fieldName} cannot end with a space`,
      sanitized
    };
  }

  // Check trailing periods (only for customer names)
  if (!allowTrailingPeriod && INVALID_TRAILING_PERIOD.test(sanitized)) {
    return {
      isValid: false,
      error: `${fieldName} cannot end with a period`,
      sanitized
    };
  }

  // Check reserved names
  const upperName = sanitized.toUpperCase();

  // Check exact match
  if (RESERVED_NAMES.includes(upperName)) {
    return {
      isValid: false,
      error: `${fieldName} cannot be a Windows reserved name (CON, PRN, AUX, NUL, COM1-9, LPT1-9)`,
      sanitized
    };
  }

  // Check reserved name with extension (e.g., "CON.txt")
  const baseName = upperName.split('.')[0];
  if (RESERVED_NAMES.includes(baseName)) {
    return {
      isValid: false,
      error: `${fieldName} cannot be a Windows reserved name (CON, PRN, AUX, NUL, COM1-9, LPT1-9)`,
      sanitized
    };
  }

  return {
    isValid: true,
    error: null,
    sanitized
  };
}

/**
 * Validate job or order name (allows trailing periods)
 *
 * Job and order names appear in the MIDDLE of the folder path:
 * "{order_name} ----- {customer_name}"
 *  ↑ Can end with period (safe position)
 *
 * @param name - Job or order name to validate
 * @returns Validation result
 */
export function validateJobOrOrderName(name: string | null | undefined): FolderNameValidationResult {
  return validateFolderName(name, {
    allowTrailingPeriod: true,
    fieldName: 'Job name'  // Generic, can be overridden by caller
  });
}

/**
 * Validate customer name (no trailing periods or spaces)
 *
 * Customer names appear at the END of the folder path:
 * "{order_name} ----- {customer_name}"
 *                      ↑ Cannot end with period (Windows strips it)
 *
 * @param name - Customer/company name to validate
 * @returns Validation result
 */
export function validateCustomerName(name: string | null | undefined): FolderNameValidationResult {
  return validateFolderName(name, {
    allowTrailingPeriod: false,
    fieldName: 'Company name'
  });
}
