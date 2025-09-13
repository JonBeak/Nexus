/**
 * Pure functions for row numbering and display formatting
 * Simple 2-layer system: Main (1, 2, 3) → Sub-items (1.a, 1.b, 2.a, 2.aa, 2.ab...)
 */

import { GridRowCore } from '../types/CoreTypes';
import { GridRowWithRelationships } from '../types/LayerTypes';

/**
 * Calculates display numbers for all rows (1, 1.a, 1.b, 2, 2.a, etc.)
 * @param rows - Rows with hierarchy paths calculated
 * @returns Array of display numbers
 */
export const calculateDisplayNumbers = (
  rows: GridRowWithRelationships[]
): string[] => {
  return rows.map(row => row.displayNumber);
};

/**
 * Generates logical numbering sequence for rows at the same level
 * @param rows - All rows in the grid
 * @param parentId - Parent ID to number children for (null for root level)
 * @returns Map of row ID to logical number
 */
export const calculateLogicalNumbersForLevel = (
  rows: GridRowCore[],
  parentId: string | null
): Map<string, number> => {
  const numbersMap = new Map<string, number>();
  let currentNumber = 1;

  for (const row of rows) {
    // Check if this row belongs to the specified parent level
    const rowParentId = getParentIdForRow(row, rows);

    if (rowParentId === parentId && row.rowType !== 'continuation') {
      numbersMap.set(row.id, currentNumber++);
    }
  }

  return numbersMap;
};

/**
 * Formats hierarchy path into display string with letter conversion
 * @param hierarchyPath - Numeric path array [1] or [1, 2]
 * @returns Formatted display string: "1" or "1.b"
 */
export const formatHierarchyPath = (
  hierarchyPath: number[]
): string => {
  if (hierarchyPath.length === 0) return '';
  
  if (hierarchyPath.length === 1) {
    // Main row: "1", "2", "3"
    return hierarchyPath[0].toString();
  }
  
  if (hierarchyPath.length === 2) {
    // Sub-item: "1.a", "1.b", "2.a", "2.aa", "2.ab"
    const mainNumber = hierarchyPath[0];
    const subNumber = hierarchyPath[1];
    const subLetter = numberToLetter(subNumber);
    return `${mainNumber}.${subLetter}`;
  }
  
  // Should never happen with 2-layer system
  return hierarchyPath.join('.');
};

/**
 * Converts sub-item number to letter using infinite base-26 system (like Excel columns)
 * 1→a, 2→b, ..., 26→z, 27→aa, 28→ab, 52→az, 53→ba, etc.
 * @param number - Number to convert (1-based)
 * @returns Letter string (a, b, z, aa, ab, etc.)
 */
export const numberToLetter = (number: number): string => {
  if (number < 1) return 'a'; // Fallback
  
  let result = '';
  let num = number;
  
  while (num > 0) {
    num--; // Convert to 0-based for modulo
    const remainder = num % 26;
    result = String.fromCharCode(97 + remainder) + result; // 97 = 'a'
    num = Math.floor(num / 26);
  }
  
  return result;
};

/**
 * Converts letter to sub-item number using infinite base-26 system
 * a→1, b→2, z→26, aa→27, ab→28, az→52, ba→53, etc.
 * @param letter - Letter string to convert
 * @returns Number (1-based)
 */
export const letterToNumber = (letter: string): number => {
  if (!letter || letter.length === 0) return 1; // Fallback
  
  let result = 0;
  const str = letter.toLowerCase();
  
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i) - 96; // 'a' = 97, so 'a' becomes 1
    result = result * 26 + charCode;
  }
  
  return result;
};

/**
 * Validates numbering consistency across all rows
 * @param rows - Rows with numbering calculated
 * @returns Array of validation errors
 */
export const validateNumberingConsistency = (
  rows: GridRowWithRelationships[]
): string[] => {
  const errors: string[] = [];
  const numbersAtLevel = new Map<string, Set<number>>();

  for (const row of rows) {
    // Skip continuation rows - they don't have numbers
    if (row.rowType === 'continuation') continue;

    const levelKey = row.parentId || 'root';

    if (!numbersAtLevel.has(levelKey)) {
      numbersAtLevel.set(levelKey, new Set());
    }

    const levelNumbers = numbersAtLevel.get(levelKey)!;

    // Check for duplicate numbers at same level
    if (row.logicalNumber && levelNumbers.has(row.logicalNumber)) {
      errors.push(`Duplicate logical number ${row.logicalNumber} at level ${levelKey}`);
    }

    if (row.logicalNumber) {
      levelNumbers.add(row.logicalNumber);
    }

    // Check hierarchy path consistency (only 1 or 2 levels)
    const expectedDepth = row.nestingLevel === 'main' ? 1 : 2;
    if (row.hierarchyPath.length !== expectedDepth) {
      errors.push(`Row ${row.id} has inconsistent hierarchy path length: expected ${expectedDepth}, got ${row.hierarchyPath.length}`);
    }
  }

  // Check for gaps in numbering
  for (const [levelKey, numbers] of numbersAtLevel) {
    const sortedNumbers = Array.from(numbers).sort((a, b) => a - b);

    for (let i = 0; i < sortedNumbers.length; i++) {
      if (sortedNumbers[i] !== i + 1) {
        errors.push(`Gap in numbering at level ${levelKey}: expected ${i + 1}, found ${sortedNumbers[i]}`);
        break;
      }
    }
  }

  return errors;
};

/**
 * Recalculates numbering after row insertion/deletion
 * @param rows - Current rows
 * @param changeType - Type of change that occurred
 * @param changeIndex - Index where change occurred
 * @returns Updated rows with corrected numbering
 */
export const recalculateNumberingAfterChange = (
  rows: GridRowWithRelationships[],
  changeType: 'insert' | 'delete' | 'move',
  changeIndex: number
): GridRowWithRelationships[] => {
  // For simplicity, recalculate all numbering
  // The relationship layer will handle this automatically
  return rows;
};

// Helper functions
const getParentIdForRow = (row: GridRowCore, allRows: GridRowCore[]): string | null => {
  const rowIndex = allRows.findIndex(r => r.id === row.id);
  if (rowIndex === -1) return null;

  // Look backwards for parent
  if (row.rowType === 'main') return null;

  for (let i = rowIndex - 1; i >= 0; i--) {
    const candidateRow = allRows[i];
    if (candidateRow.rowType === 'main') {
      return candidateRow.id;
    }
  }

  return null;
};