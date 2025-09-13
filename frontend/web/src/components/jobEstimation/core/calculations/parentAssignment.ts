/**
 * Pure functions for parent-child relationship calculations
 * Simple 2-layer system: Main rows → Sub-items/Continuations
 */

import { GridRowCore } from '../types/CoreTypes';
import { GridRowWithRelationships } from '../types/LayerTypes';

/**
 * Calculates parent for a single row based on rowType and position
 * @param targetRow - Row to find parent for
 * @param allRows - Complete row array for context
 * @param targetIndex - Index of target row in array
 * @returns Parent row ID or undefined if no parent
 */
export const calculateParentForRow = (
  targetRow: GridRowCore,
  allRows: GridRowCore[],
  targetIndex: number
): string | undefined => {
  // Main rows have no parent
  if (targetRow.rowType === 'main') return undefined;

  // For sub-items and continuations, look backwards for nearest main product
  for (let i = targetIndex - 1; i >= 0; i--) {
    const candidateRow = allRows[i];
    if (candidateRow.rowType === 'main') {
      return candidateRow.id;
    }
  }

  return undefined;
};

/**
 * Calculates all child rows for a given parent
 * @param parentId - Parent row ID to find children for
 * @param allRows - Complete row array
 * @returns Array of child row IDs
 */
export const calculateChildrenForRow = (
  parentId: string,
  allRows: GridRowCore[]
): string[] => {
  const parentIndex = allRows.findIndex(row => row.id === parentId);
  if (parentIndex === -1) return [];

  const parent = allRows[parentIndex];
  const children: string[] = [];

  // Only main products can have children
  if (parent.rowType !== 'main') return [];

  // Look forward for sub-items and continuations that belong to this main product
  for (let i = parentIndex + 1; i < allRows.length; i++) {
    const candidateRow = allRows[i];

    // Stop if we encounter another main product
    if (candidateRow.rowType === 'main') break;

    // This sub-item or continuation belongs to our main product
    if (candidateRow.rowType === 'subItem' || candidateRow.rowType === 'continuation') {
      children.push(candidateRow.id);
    }
  }

  return children;
};

/**
 * Validates parent-child relationships for consistency
 * @param rows - Rows to validate
 * @returns Array of validation error messages
 */
export const validateParentChildRelationships = (
  rows: GridRowWithRelationships[]
): string[] => {
  const errors: string[] = [];
  const rowMap = new Map(rows.map(row => [row.id, row]));

  for (const row of rows) {
    // Check if parent exists
    if (row.parentId && !rowMap.has(row.parentId)) {
      errors.push(`Row ${row.id} references non-existent parent ${row.parentId}`);
    }

    // Check rowType consistency
    if (row.parentId) {
      const parent = rowMap.get(row.parentId);
      if (parent) {
        // Parent must be a main product
        if (parent.rowType !== 'main') {
          throw new Error(`CRITICAL: Row ${row.id} has parent ${row.parentId} that is not a main product.`);
        }
        // Child must be subItem or continuation
        if (row.rowType === 'main') {
          throw new Error(`CRITICAL: Main product ${row.id} cannot have a parent.`);
        }
      }
    }

    // Check child relationships are bidirectional
    for (const childId of row.childIds) {
      const child = rowMap.get(childId);
      if (!child) {
        errors.push(`Row ${row.id} references non-existent child ${childId}`);
      } else if (child.parentId !== row.id) {
        errors.push(`Row ${childId} is not properly linked to parent ${row.id}`);
      }
    }
  }

  return errors;
};

/**
 * Simple function to find rows that depend on a changed row
 * Only 2 layers: parent and direct children
 * @param changedRowId - ID of the row that changed
 * @param allRows - Complete row array
 * @returns Set of row IDs that need recalculation
 */
export const findDependentRows = (
  changedRowId: string,
  allRows: GridRowWithRelationships[]
): Set<string> => {
  const dependents = new Set<string>([changedRowId]);
  const rowMap = new Map(allRows.map(row => [row.id, row]));
  const changedRow = rowMap.get(changedRowId);

  if (!changedRow) return dependents;

  // Add all direct children
  for (const childId of changedRow.childIds) {
    dependents.add(childId);
  }

  // Add parent (if this is a child row)
  if (changedRow.parentId) {
    dependents.add(changedRow.parentId);
  }

  // Add siblings (logical numbers might shift)
  if (changedRow.parentId) {
    const parent = rowMap.get(changedRow.parentId);
    if (parent) {
      for (const siblingId of parent.childIds) {
        dependents.add(siblingId);
      }
    }
  } else {
    // Root level siblings (other main rows)
    for (const row of allRows) {
      if (!row.parentId && row.id !== changedRowId) {
        dependents.add(row.id);
      }
    }
  }

  return dependents;
};