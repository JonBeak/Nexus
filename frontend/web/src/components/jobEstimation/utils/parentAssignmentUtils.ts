import { EstimateRow } from '../types';

/**
 * Updates parent assignments based on position: sub-items check only the immediate row above them
 * 
 * Rules:
 * 1. Sub-items at position 0 get parentProductId = null (invalid)
 * 2. Sub-items check only the immediate row above them
 * 3. Valid parents: regular products, continuation rows, or other sub-items
 * 4. Invalid parents result in parentProductId = null for future validation layer
 */
export const updateParentAssignments = (rows: EstimateRow[]): EstimateRow[] => {
  return rows.map((row, index) => {
    // Only update sub-items (not main rows or continuation rows)
    if (row.isMainRow || row.parentProductId) {
      return row; // Keep main rows and continuation rows as-is
    }
    
    // For sub-items, check ONLY the immediate row above them
    if (index === 0) {
      // Sub-item at position 0 - set parentID to null
      return {
        ...row,
        parentProductId: null
      };
    }
    
    const immediateParent = rows[index - 1];
    
    // Valid parent types:
    // 1. Regular product (isMainRow = true)
    // 2. Continuation row of a regular product (isMainRow = false, has parentProductId)
    // 3. Another sub-item (isMainRow = false, no parentProductId)
    
    if (immediateParent.isMainRow) {
      // Case 1: Regular product above - use its ID
      return {
        ...row,
        parentProductId: immediateParent.id
      };
    } else if (immediateParent.parentProductId) {
      // Case 2: Continuation row above - inherit its parent
      return {
        ...row,
        parentProductId: immediateParent.parentProductId
      };
    } else if (!immediateParent.isMainRow && !immediateParent.parentProductId) {
      // Case 3: Another sub-item above - both should share the same parent
      // Look further up to find what the sub-item above should be attached to
      let sharedParent = null;
      for (let i = index - 2; i >= 0; i--) {
        const potentialParent = rows[i];
        if (potentialParent.isMainRow || potentialParent.parentProductId) {
          sharedParent = potentialParent.isMainRow ? potentialParent.id : potentialParent.parentProductId;
          break;
        }
      }
      
      return {
        ...row,
        parentProductId: sharedParent
      };
    } else {
      // Invalid case - set parentID to null
      return {
        ...row,
        parentProductId: null
      };
    }
  });
};