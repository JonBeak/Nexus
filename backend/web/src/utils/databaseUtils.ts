// File Clean up Finished: 2025-11-15
// Changes:
// - Removed toMySQLBoolean() - unnecessary abstraction over inline ternary (value ? 1 : 0)
// - Removed COMMON_BOOLEAN_FIELDS constant - dead code, never used
// - Added comprehensive usage documentation with recommended patterns
// - Kept toBoolean() and convertBooleanFields*() - valuable for reading MySQL inconsistent types
// - Updated payrollRepository.ts to use inline ternary instead of toMySQLBoolean()
// - Reduced from 106 → 93 lines (12% reduction)
// - Pragmatic approach: Keep useful utilities, remove unnecessary abstraction

/**
 * Database Utility Functions
 *
 * Handles type conversions between MySQL and TypeScript
 *
 * MySQL Boolean Handling:
 * - MySQL uses TINYINT(1) for boolean fields (0 = false, 1 = true)
 * - Raw SELECT queries return 0 or 1 (numbers), not true/false
 * - This utility ensures consistent boolean types in TypeScript
 *
 * RECOMMENDED USAGE PATTERN:
 * -------------------------
 * For READS (Repository → Service):
 *   Use convertBooleanFields() or convertBooleanFieldsArray() to convert MySQL TINYINT to boolean
 *   Example:
 *     const rows = await query('SELECT * FROM table') as RowDataPacket[];
 *     return convertBooleanFieldsArray(rows, ['is_active', 'is_deleted']);
 *
 * For WRITES (Service → Repository → Database):
 *   Use inline ternary for clarity and performance: value ? 1 : 0
 *   Example:
 *     await query('UPDATE table SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
 *
 * RATIONALE:
 * - Reading: MySQL returns inconsistent types (0, 1, '0', '1'), toBoolean() handles all cases
 * - Writing: You already know it's a boolean, inline ternary is clearer and faster
 */

/**
 * Convert MySQL TINYINT(1) to TypeScript boolean
 * Handles: 0, 1, '0', '1', true, false, null, undefined
 *
 * Use this when reading from database to normalize MySQL's inconsistent boolean representation
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
 * Convert MySQL row object boolean fields
 * Accepts a row object and list of boolean field names
 * Returns new object with converted boolean fields
 *
 * Recommended for repository layer when returning single row results
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
 *
 * Recommended for repository layer when returning multiple row results
 */
export function convertBooleanFieldsArray<T extends Record<string, any>>(
  rows: T[],
  booleanFields: (keyof T)[]
): T[] {
  return rows.map(row => convertBooleanFields(row, booleanFields));
}
