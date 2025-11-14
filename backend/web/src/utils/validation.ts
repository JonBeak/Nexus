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
 * Validate phone number format
 *
 * Accepts various phone number formats including:
 * - +1 234 567 8900
 * - (234) 567-8900
 * - 234.567.8900
 * - 2345678900
 *
 * Minimum 10 digits required.
 *
 * @param phone - Phone number to validate
 * @returns true if valid format, false otherwise
 *
 * @example
 * isValidPhone('+1 234 567 8900') // true
 * isValidPhone('123') // false (too short)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Basic phone number validation - allows various formats
  const phoneRegex = /^[\d\s\-\(\)\+\.]{10,}$/;
  return phoneRegex.test(phone.trim());
}
