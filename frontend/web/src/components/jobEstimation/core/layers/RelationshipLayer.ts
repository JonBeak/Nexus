// Layer 1: Parent/child relationships and hierarchy calculations

import { GridRowCore } from '../types/CoreTypes';
import { GridRowWithRelationships } from '../types/LayerTypes';

export interface RelationshipOperations {
  /**
   * Calculates parent-child relationships for all rows
   * @param coreRows - Input rows with core data
   * @returns Rows with relationship data added
   */
  calculateRelationships: (coreRows: GridRowCore[]) => GridRowWithRelationships[];

  /**
   * Determines parent row for a specific row based on position and rowType
   * @param targetRow - Row to find parent for
   * @param allRows - Complete row array
   * @param targetIndex - Index of target row in array
   * @returns Parent row ID or undefined
   */
  findParentRow: (
    targetRow: GridRowCore,
    allRows: GridRowCore[],
    targetIndex: number
  ) => string | undefined;

  /**
   * Finds all child rows for a given parent
   * @param parentId - Parent row ID
   * @param allRows - Complete row array
   * @returns Array of child row IDs
   */
  findChildRows: (parentId: string, allRows: GridRowCore[]) => string[];
}

// Implementation with pure functions
export const createRelationshipOperations = (): RelationshipOperations => {
  return {
    calculateRelationships: (coreRows) => {
      // Step 1: Initialize with basic relationship structure
      const withBasicStructure: GridRowWithRelationships[] = coreRows.map((row, index) => ({
        ...row,
        parentId: findParentRow(row, coreRows, index),
        childIds: [],
        logicalNumber: undefined,
        displayNumber: '',
        showRowNumber: row.rowType !== 'continuation',
        nestingLevel: row.rowType === 'main' ? 'main' : 'sub',
        hierarchyPath: []
      }));

      // Step 2: Calculate child relationships
      const withChildren = withBasicStructure.map(row => ({
        ...row,
        childIds: findChildRows(row.id, withBasicStructure)
      }));

      // Step 3: Calculate simple 2-level numbering
      return calculateSimpleNumbering(withChildren);
    },

    findParentRow: (targetRow, allRows, targetIndex) => {
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
    },

    findChildRows: (parentId, allRows) => {
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
    }
  };

  // Helper function implementations
  function findParentRow(targetRow: GridRowCore, allRows: GridRowCore[], targetIndex: number): string | undefined {
    if (targetRow.rowType === 'main') return undefined;

    for (let i = targetIndex - 1; i >= 0; i--) {
      const candidateRow = allRows[i];
      if (candidateRow.rowType === 'main') {
        return candidateRow.id;
      }
    }
    return undefined;
  }

  function findChildRows(parentId: string, allRows: GridRowWithRelationships[]): string[] {
    const parentIndex = allRows.findIndex(row => row.id === parentId);
    if (parentIndex === -1) return [];

    const parent = allRows[parentIndex];
    const children: string[] = [];

    if (parent.rowType !== 'main') return [];

    for (let i = parentIndex + 1; i < allRows.length; i++) {
      const candidateRow = allRows[i];

      if (candidateRow.rowType === 'main') break;

      if (candidateRow.rowType === 'subItem' || candidateRow.rowType === 'continuation') {
        children.push(candidateRow.id);
      }
    }

    return children;
  }

  function calculateSimpleNumbering(rows: GridRowWithRelationships[]): GridRowWithRelationships[] {
    let mainCounter = 0;
    const subCountersByParent = new Map<string, number>();

    // Two-pass algorithm:
    // Pass 1: Calculate all main row numbers first
    const withMainNumbers = rows.map(row => {
      if (row.rowType === 'main') {
        mainCounter++;
        return {
          ...row,
          logicalNumber: mainCounter,
          hierarchyPath: [mainCounter],
          displayNumber: mainCounter.toString()
        };
      }
      return row; // Keep other rows unchanged for now
    });

    // Pass 2: Calculate sub-item and continuation numbers using completed main numbers
    return withMainNumbers.map(row => {
      if (row.rowType === 'continuation') {
        // Continuation rows get no numbering
        return {
          ...row,
          logicalNumber: undefined,
          hierarchyPath: [],
          displayNumber: ''
        };
      }

      if (row.rowType === 'main') {
        // Main rows already processed in pass 1
        return row;
      }

      if (row.rowType === 'subItem' && row.parentId) {
        // Sub-items: 1.a, 1.b, 2.a, 2.b...
        // Now we can safely find the parent's logicalNumber from the completed main numbers
        const parentMainNumber = withMainNumbers.find(r => r.id === row.parentId)?.logicalNumber;
        if (!parentMainNumber) {
          // Fallback if parent not found
          return {
            ...row,
            logicalNumber: undefined,
            hierarchyPath: [],
            displayNumber: ''
          };
        }

        // Increment sub-item counter for this parent
        const currentSubCount = (subCountersByParent.get(row.parentId) || 0) + 1;
        subCountersByParent.set(row.parentId, currentSubCount);

        // Convert number to letter: 1=a, 2=b, 3=c...
        const subLetter = String.fromCharCode(96 + currentSubCount); // 97 is 'a'

        return {
          ...row,
          logicalNumber: currentSubCount,
          hierarchyPath: [parentMainNumber, currentSubCount],
          displayNumber: `${parentMainNumber}.${subLetter}`
        };
      }

      // Fallback for any other case
      return {
        ...row,
        logicalNumber: undefined,
        hierarchyPath: [],
        displayNumber: ''
      };
    });
  }
};