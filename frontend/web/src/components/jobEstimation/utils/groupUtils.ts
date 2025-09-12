import { EstimateRow } from '../types';

// Product group navigation utilities
export const findProductGroupStart = (index: number, rows: EstimateRow[]): number => {
  const currentRow = rows[index];
  
  // If it's a main row, it's the start
  if (currentRow.isMainRow) {
    return index;
  }
  
  // If it's a continuation row or sub-item, find its parent
  if (currentRow.parentProductId) {
    for (let i = index - 1; i >= 0; i--) {
      if (rows[i].id === currentRow.parentProductId) {
        return i;
      }
    }
  }
  
  // Fallback to old logic if parentProductId lookup fails
  for (let i = index - 1; i >= 0; i--) {
    const row = rows[i];
    // The parent is the closest main row before this sub-item
    if (row.isMainRow) {
      return i;
    }
  }
  
  return index;
};

export const findProductGroupEnd = (startIndex: number, rows: EstimateRow[]): number => {
  const currentRow = rows[startIndex];
  
  // First, find the group start to ensure we have the complete group
  const groupStart = findProductGroupStart(startIndex, rows);
  
  // Start from the group beginning and find all related rows
  let endIndex = groupStart;
  const startRow = rows[groupStart];
  
  // If it's a main row, find all its children
  if (startRow.isMainRow) {
    const parentProductId = startRow.id;
    
    // Find all continuation rows and sub-items
    for (let i = groupStart + 1; i < rows.length; i++) {
      const row = rows[i];
      
      // If it's a continuation row or sub-item of the same product, include it
      if (row.parentProductId === parentProductId) {
        endIndex = i;
      } else if (row.isMainRow) {
        // Stop when we hit another main row
        break;
      }
    }
  }
  
  return endIndex;
};

// PHASE 2 OPTIMIZATION: O(n) parent-child relationship calculator
interface FamilyGroup {
  parentId: string;
  parentIndex: number;
  children: Array<{ row: EstimateRow; index: number; }>;
}

const buildFamilyMap = (rows: EstimateRow[]): Map<string, FamilyGroup> => {
  const familyMap = new Map<string, FamilyGroup>();
  let currentFamily: FamilyGroup | null = null;
  
  // Single O(n) pass through all rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // If this is a parent (main row), start a new family
    if (row.isMainRow) {
      currentFamily = {
        parentId: row.id,
        parentIndex: i,
        children: []
      };
      familyMap.set(row.id, currentFamily);
    } 
    // If this is a child and we have a current family
    else if (currentFamily && (row.parentProductId === currentFamily.parentId || 
                               (!row.isMainRow && !row.parentProductId))) {
      currentFamily.children.push({ row, index: i });
    }
    // If this is a child with explicit parentProductId, find its family
    else if (row.parentProductId && familyMap.has(row.parentProductId)) {
      const family = familyMap.get(row.parentProductId)!;
      family.children.push({ row, index: i });
    }
  }
  
  return familyMap;
};

// Dragged rows utilities - OPTIMIZED O(n) version
export const getDraggedRows = (rowId: string, rows: EstimateRow[]): EstimateRow[] => {
  const rowIndex = rows.findIndex(row => row.id === rowId);
  if (rowIndex === -1) return [];
  
  const draggedRow = rows[rowIndex];
  let targetParentId = rowId;
  
  // If dragging a child, find its parent
  if (draggedRow.parentProductId) {
    targetParentId = draggedRow.parentProductId;
  } else if (!draggedRow.isMainRow) {
    // For sub-items without parentProductId, find the closest parent manually
    for (let i = rowIndex - 1; i >= 0; i--) {
      const row = rows[i];
      if (row.isMainRow) {
        targetParentId = row.id;
        break;
      }
    }
  }
  
  // Build family map once
  const familyMap = buildFamilyMap(rows);
  const family = familyMap.get(targetParentId);
  
  if (!family) {
    // No family found, return just the dragged row
    return [draggedRow];
  }
  
  // Return parent + all children in their original order
  const result: EstimateRow[] = [rows[family.parentIndex]];
  
  // Sort children by their original index to maintain order
  const sortedChildren = family.children.sort((a, b) => a.index - b.index);
  result.push(...sortedChildren.map(child => child.row));
  
  return result;
};