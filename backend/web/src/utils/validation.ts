// File Clean up Finished: 2025-11-15
// - Removed dead code: isValidPhone() (unused)
// - Extracted isValidUrl() from supplierService.ts
//
// File Clean up Finished: 2025-11-21
// - Added getTrimmedStringOrEmpty() helper

/**
 * Validation Utilities
 *
 * Reusable validation functions for common data types.
 * Centralizes validation logic to maintain consistency across the application.
 *
 * @module utils/validation
 * @created 2025-11-14
 */

/**
 * Validate email address format
 *
 * Uses standard email regex pattern to validate format.
 * Does not check if email actually exists or is deliverable.
 *
 * @param email - Email address to validate
 * @returns true if valid format, false otherwise
 *
 * @example
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid.email') // false
 * isValidEmail('user@') // false
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate URL format
 *
 * Validates URL format using JavaScript's URL constructor.
 * Automatically prepends 'https://' if no protocol is provided.
 *
 * @param url - URL string to validate
 * @returns true if valid URL format, false otherwise
 *
 * @example
 * isValidUrl('https://example.com') // true
 * isValidUrl('example.com') // true (auto-prepends https://)
 * isValidUrl('not a url') // false
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    new URL(url.startsWith('http') ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize and trim string value
 *
 * Converts unknown input to a trimmed string or undefined.
 * Returns undefined for non-string inputs or empty strings after trimming.
 *
 * @param value - Value to sanitize
 * @returns Trimmed string or undefined
 *
 * @example
 * getTrimmedString('  hello  ') // 'hello'
 * getTrimmedString('') // undefined
 * getTrimmedString(null) // undefined
 * getTrimmedString(123) // undefined
 */
export function getTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Sanitize and trim string value, returning empty string as fallback
 *
 * Like getTrimmedString but returns '' instead of undefined for empty/invalid inputs.
 * Useful when empty string is a valid default value.
 *
 * @param value - Value to sanitize
 * @returns Trimmed string or empty string
 *
 * @example
 * getTrimmedStringOrEmpty('  hello  ') // 'hello'
 * getTrimmedStringOrEmpty('') // ''
 * getTrimmedStringOrEmpty(null) // ''
 * getTrimmedStringOrEmpty(123) // ''
 */
export function getTrimmedStringOrEmpty(value: unknown): string {
  return getTrimmedString(value) ?? '';
}

/**
 * Convert value to number or undefined
 *
 * Safely converts unknown input to a number or undefined.
 * Returns undefined for null, undefined, or invalid numeric values.
 *
 * @param value - Value to convert
 * @returns Valid number or undefined
 *
 * @example
 * toNumberOrUndefined(42) // 42
 * toNumberOrUndefined('42') // 42
 * toNumberOrUndefined('') // undefined
 * toNumberOrUndefined(null) // undefined
 * toNumberOrUndefined('abc') // undefined
 */
export function toNumberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
