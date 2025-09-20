// Drag and drop operations with family relationship validation
// Extracted from GridEngine.ts for better maintainability

import { GridRowCore } from '../types/CoreTypes';

export class DragOperations {
  /**
   * Moves rows (drag and drop)
   * @param draggedRowIds - IDs of rows being moved
   * @param targetRowId - ID of target row
   * @param position - Where to drop relative to target
   * @param coreData - Current core data array
   * @returns Updated core data
   */
  moveRows(
    draggedRowIds: string[],
    targetRowId: string,
    position: 'above' | 'below',
    coreData: GridRowCore[]
  ): GridRowCore[] {
    // Extract dragged rows
    const draggedRows: GridRowCore[] = [];
    const remainingRows: GridRowCore[] = [];

    for (const row of coreData) {
      if (draggedRowIds.includes(row.id)) {
        draggedRows.push(row);
      } else {
        remainingRows.push(row);
      }
    }

    // Find target position
    const targetIndex = remainingRows.findIndex(row => row.id === targetRowId);
    if (targetIndex === -1) return coreData; // Target not found

    // Calculate intended insertion point
    let insertIndex = position === 'above' ? targetIndex : targetIndex + 1;

    // Auto-correct invalid drop positions to nearest valid location
    insertIndex = this.findValidDropPosition(insertIndex, remainingRows);

    // Insert dragged rows at corrected position
    const newCoreData = [...remainingRows];
    newCoreData.splice(insertIndex, 0, ...draggedRows);

    return newCoreData;
  }

  /**
   * Finds the nearest valid drop position that won't break family relationships
   * @param intendedIndex - The originally intended insertion point
   * @param targetRows - The rows without the dragged items
   * @returns Corrected insertion index that respects family boundaries
   */
  private findValidDropPosition(intendedIndex: number, targetRows: GridRowCore[]): number {
    // If intended position is at start or end, it's always valid
    if (intendedIndex <= 0 || intendedIndex >= targetRows.length) {
      return intendedIndex;
    }

    const beforeRow = targetRows[intendedIndex - 1];
    const afterRow = targetRows[intendedIndex];

    // Check if we're trying to drop between a main row and its continuation rows
    if (this.wouldBreakFamily(beforeRow, afterRow, targetRows)) {
      // Auto-correct: Find the end of the family and insert there
      return this.findFamilyEnd(beforeRow, targetRows) + 1;
    }

    return intendedIndex; // Position is valid as-is
  }

  /**
   * Checks if inserting between two rows would break a main-continuation family
   * @param beforeRow - Row before the insertion point
   * @param afterRow - Row after the insertion point
   * @param allRows - Complete row array for context
   * @returns true if this would break a family, false if it's safe
   */
  private wouldBreakFamily(beforeRow: GridRowCore, afterRow: GridRowCore, allRows: GridRowCore[]): boolean {
    // Case 1: Main row followed by its continuation row
    if (beforeRow.rowType === 'main' && afterRow.rowType === 'continuation') {
      // Check if the continuation row belongs to the main row
      const afterParent = this.findParentMainRowByPosition(afterRow, allRows);
      if (afterParent && afterParent.id === beforeRow.id) {
        return true; // Would split main from its continuation
      }
    }

    // Case 2: Continuation row followed by another continuation of the same family
    if (beforeRow.rowType === 'continuation' && afterRow.rowType === 'continuation') {
      const beforeParent = this.findParentMainRowByPosition(beforeRow, allRows);
      const afterParent = this.findParentMainRowByPosition(afterRow, allRows);
      if (beforeParent && afterParent && beforeParent.id === afterParent.id) {
        return true; // Would split continuation rows of same family
      }
    }

    return false; // Safe to insert here
  }

  /**
   * Finds the end index of a family (main row + all its continuation rows)
   * @param mainRow - The main row to find the family end for
   * @param rows - Array of rows to search in
   * @returns Index of the last row in the family
   */
  private findFamilyEnd(mainRow: GridRowCore, rows: GridRowCore[]): number {
    const mainIndex = rows.indexOf(mainRow);
    if (mainIndex === -1) return -1;

    // Look forward to find the last continuation row of this family
    let lastFamilyIndex = mainIndex;
    for (let i = mainIndex + 1; i < rows.length; i++) {
      const currentRow = rows[i];

      // Stop if we hit another main row
      if (currentRow.rowType === 'main') break;

      // If it's a continuation, check if it belongs to our main row
      if (currentRow.rowType === 'continuation') {
        const parent = this.findParentMainRowByPosition(currentRow, rows);
        if (parent && parent.id === mainRow.id) {
          lastFamilyIndex = i; // This continuation belongs to our main row
        } else {
          break; // This continuation belongs to a different main row
        }
      } else {
        // Sub-items don't block family boundaries, continue searching
        // but don't update lastFamilyIndex unless it's a continuation
      }
    }

    return lastFamilyIndex;
  }

  /**
   * Helper method to find the parent main row for a child row using position-based logic
   * @param childRow - Child row to find parent for
   * @param allRows - Complete row array
   * @returns Parent main row or undefined
   */
  private findParentMainRowByPosition(childRow: GridRowCore, allRows: GridRowCore[]): GridRowCore | undefined {
    const childIndex = allRows.indexOf(childRow);
    if (childIndex === -1) return undefined;

    // Look backwards to find the main row
    for (let i = childIndex - 1; i >= 0; i--) {
      if (allRows[i].rowType === 'main') {
        return allRows[i];
      }
    }
    return undefined;
  }
}