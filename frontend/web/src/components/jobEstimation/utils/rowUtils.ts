import { EstimateRow } from '../types';

// Row creation utilities  
export const createEmptyProductRow = (indent: number = 0): EstimateRow => {
  // For new rows, use a temporary ID that will be replaced when saved
  // This ensures compatibility with the database loading system
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id: tempId,
    indent,
    productTypeId: 27, // "Empty Row" product type
    productTypeName: 'Empty Row',
    data: {},
    isMainRow: true
  };
};

// Field configuration utilities
export const getProductFieldConfig = (productTypeId: number, productTypes: any[]) => {
  const productType = productTypes.find(pt => pt.id === productTypeId);
  
  if (!productType?.input_template?.rows && !productType?.input_template?.fields) return [];
  
  // For other product types, use database template rows
  if (productType.input_template?.rows) {
    return productType.input_template.rows;
  }
  
  // Fallback for old format
  return [productType.input_template.fields];
};


// ✅ TEMPLATE-FIRST: Get field for specific column using product templates from database
export const getFieldForColumn = (row: EstimateRow, colIndex: number, productTypes: any[] = []): any => {
  // All products use database templates uniformly
  if (row.productTypeId && productTypes.length > 0) {
    const fieldConfig = getProductFieldConfig(row.productTypeId, productTypes);
    if (fieldConfig && fieldConfig.length > 0) {
      // Flatten all rows of field config to get all fields
      const allFields = fieldConfig.flat();
      return allFields[colIndex] || null;
    }
  }
  
  return null;
};

// ✅ UNIFIED FIELD SYSTEM: Get field config for any row type
export const getFieldConfig = (row: EstimateRow, productTypes: any[] = []): any[][] => {
  // All products use database-driven field configs uniformly
  if (row.productTypeId && productTypes.length > 0) {
    return getProductFieldConfig(row.productTypeId, productTypes);
  }
  
  return [];
};

// Row numbering utilities - simplified for uniform product system
export const getRowNumber = (rowIndex: number, rows: EstimateRow[]) => {
  const row = rows[rowIndex];
  
  // Handle sub-item numbering (1.a, 1.b, etc.) - show for sub-items with parent
  if (row.parentProductId) {
    // Find the parent row's logical number
    let parentLogicalNumber = 0;
    let subItemIndex = 1;
    
    // First, find which main row this sub-item belongs to
    let parentRowIndex = -1;
    for (let i = rowIndex - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.isMainRow && r.id === row.parentProductId) {
        parentRowIndex = i;
        break;
      }
    }
    
    if (parentRowIndex >= 0) {
      // Count logical numberable rows before and including parent (excluding sub-items)
      for (let i = 0; i <= parentRowIndex; i++) {
        const r = rows[i];
        if (r.isMainRow && !r.parentProductId) {
          parentLogicalNumber++;
        }
      }
      
      // Count how many sub-items with the same parent come before this one
      for (let i = parentRowIndex + 1; i < rowIndex; i++) {
        const r = rows[i];
        if (r.parentProductId === row.parentProductId) {
          subItemIndex++;
        }
      }
    } else {
      // Fallback: couldn't find parent, just use position-based logic
      parentLogicalNumber = 1;
      subItemIndex = 1;
    }
    
    // Convert subItemIndex to letter (1=a, 2=b, etc.)
    const letter = String.fromCharCode(96 + subItemIndex); // 97 is 'a'
    return `${parentLogicalNumber}.${letter}`;
  }
  
  // Only show row numbers for main rows
  if (!row.isMainRow) {
    return null; // No number for continuation rows
  }
  
  // Count logical numberable rows up to and including this point (excluding sub-items)
  let logicalRowCount = 0;
  for (let i = 0; i <= rowIndex; i++) {
    const r = rows[i];
    // Only count rows that get logical numbers (main rows but NOT sub-items)
    if (r.isMainRow && !r.parentProductId) {
      logicalRowCount++;
    }
  }
  return logicalRowCount;
};

// Field visibility utilities  
export const shouldShowField = (): boolean => {
  // In uniform product system, all fields are determined by database templates
  // Show all 12 fields to support full template configurations
  return true;
};

// Removed unused createDefaultTemplateRows function - template creation now handled by backend
