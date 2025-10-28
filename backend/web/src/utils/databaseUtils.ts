/**
 * Database Utility Functions
 *
 * Handles type conversions between MySQL and TypeScript
 *
 * MySQL Boolean Handling:
 * - MySQL uses TINYINT(1) for boolean fields (0 = false, 1 = true)
 * - Raw SELECT queries return 0 or 1 (numbers), not true/false
 * - This utility ensures consistent boolean types in TypeScript
 */

/**
 * Convert MySQL TINYINT(1) to TypeScript boolean
 * Handles: 0, 1, '0', '1', true, false, null, undefined
 */
export function toBoolean(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  // Already a boolean
  if (typeof value === 'boolean') {
    return value;
  }

  // Number (0 or 1)
  if (typeof value === 'number') {
    return value !== 0;
  }

  // String ('0' or '1')
  if (typeof value === 'string') {
    return value !== '0' && value !== '' && value !== 'false';
  }

  return Boolean(value);
}

/**
 * Convert TypeScript boolean to MySQL TINYINT(1)
 * For use in INSERT/UPDATE queries
 */
export function toMySQLBoolean(value: boolean | undefined | null): number {
  return value ? 1 : 0;
}

/**
 * Convert MySQL row object boolean fields
 * Accepts a row object and list of boolean field names
 * Returns new object with converted boolean fields
 */
export function convertBooleanFields<T extends Record<string, any>>(
  row: T,
  booleanFields: (keyof T)[]
): T {
  const converted = { ...row };

  for (const field of booleanFields) {
    if (field in converted) {
      converted[field] = toBoolean(converted[field]) as any;
    }
  }

  return converted;
}

/**
 * Convert array of MySQL rows with boolean fields
 */
export function convertBooleanFieldsArray<T extends Record<string, any>>(
  rows: T[],
  booleanFields: (keyof T)[]
): T[] {
  return rows.map(row => convertBooleanFields(row, booleanFields));
}

/**
 * Common boolean field names across the application
 * Update this as new boolean fields are discovered
 */
export const COMMON_BOOLEAN_FIELDS = {
  // Core system
  is_active: true,
  is_deleted: true,

  // Time tracking
  is_overtime: true,
  is_holiday: true,
  payroll_adjusted: true,

  // User/Account
  is_admin: true,
  is_manager: true,

  // Customer
  po_required: true,
  is_primary: true,

  // Inventory
  is_active_product: true,

  // Jobs
  is_archived: true,
  is_template: true,
} as const;
