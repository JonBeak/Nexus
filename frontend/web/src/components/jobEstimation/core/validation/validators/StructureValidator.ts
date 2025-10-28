// Structure-level validation
// Validates business rules, sub-item placement, and row ordering

import { GridRowCore, ProductTypeConfig } from '../../types/CoreTypes';

export interface StructureValidationResult {
  rowId: string;
  error: string;
  rule: string;
  severity: 'error';
}

export class StructureValidator {
  private productTypes: ProductTypeConfig[] = [];

  /**
   * Validate structural business rules across the entire grid
   * @param coreData - Complete grid data for structural analysis
   * @param productTypes - Product type configurations for category checking
   * @returns Array of structure validation errors
   */
  async validateStructure(coreData: GridRowCore[], productTypes?: ProductTypeConfig[]): Promise<StructureValidationResult[]> {
    // Store productTypes for use in helper methods
    if (productTypes) {
      this.productTypes = productTypes;
    }
    const results: StructureValidationResult[] = [];

    // 1. Validate sub-item placement rules
    results.push(...this.validateSubItemPlacement(coreData));

    // 2. Validate continuation row rules
    results.push(...this.validateContinuationRows(coreData));

    // 3. Validate product type hierarchy rules
    results.push(...this.validateProductTypeHierarchy(coreData));

    return results;
  }

  /**
   * Validate sub-item placement business rules
   */
  private validateSubItemPlacement(coreData: GridRowCore[]): StructureValidationResult[] {
    const results: StructureValidationResult[] = [];

    for (let i = 0; i < coreData.length; i++) {
      const row = coreData[i];

      if (row.rowType === 'subItem') {
        // Rule 1: Sub-items cannot be the first row
        if (i === 0) {
          results.push({
            rowId: row.id,
            error: 'Sub-items cannot be the first row in the grid',
            rule: 'sub_item_first_row',
            severity: 'error'
          });
          continue;
        }

        // Rule 2: Sub-items must have a parent regular product
        const parentFound = this.findParentProduct(coreData, i);
        if (!parentFound) {
          results.push({
            rowId: row.id,
            error: 'Sub-items must be placed under a regular product',
            rule: 'sub_item_no_parent',
            severity: 'error'
          });
          continue;
        }

        // Sub-items are independent product types - no validation needed for product type inheritance
      }
    }

    return results;
  }

  /**
   * Validate continuation row rules
   */
  private validateContinuationRows(coreData: GridRowCore[]): StructureValidationResult[] {
    const results: StructureValidationResult[] = [];

    for (let i = 0; i < coreData.length; i++) {
      const row = coreData[i];

      if (row.rowType === 'continuation') {
        // Rule 1: Continuation rows cannot be orphaned (must have parent)
        const parentFound = this.findParentProduct(coreData, i);
        if (!parentFound) {
          results.push({
            rowId: row.id,
            error: 'Continuation rows cannot exist without a parent product',
            rule: 'continuation_orphaned',
            severity: 'error'
          });
        }

        // Rule 2: Continuation rows should be immediately after their parent or its sub-items
        if (parentFound && !this.isContinuationProperlyPlaced(coreData, i)) {
          results.push({
            rowId: row.id,
            error: 'Continuation rows must be placed immediately after their parent product',
            rule: 'continuation_misplaced',
            severity: 'error'
          });
        }
      }
    }

    return results;
  }

  /**
   * Validate product type hierarchy rules
   */
  private validateProductTypeHierarchy(coreData: GridRowCore[]): StructureValidationResult[] {
    const results: StructureValidationResult[] = [];

    for (let i = 0; i < coreData.length; i++) {
      const row = coreData[i];

      // Rule: Sub-items cannot be placed under special items
      if (row.rowType === 'subItem') {
        const parent = this.findParentProduct(coreData, i);
        if (parent && this.isSpecialItem(parent)) {
          results.push({
            rowId: row.id,
            error: 'Sub-items cannot be placed under special items',
            rule: 'sub_item_under_special',
            severity: 'error'
          });
        }
      }

      // Rule: Regular products should be able to have sub-items (no restrictions)
      // This is permissive - no validation needed for regular products having sub-items
    }

    return results;
  }

  // Helper methods

  /**
   * Find the parent product for a row at given index
   */
  private findParentProduct(coreData: GridRowCore[], rowIndex: number): GridRowCore | null {
    // Look backwards for the nearest main product
    for (let i = rowIndex - 1; i >= 0; i--) {
      const candidateRow = coreData[i];
      if (candidateRow.rowType === 'main') {
        return candidateRow;
      }
    }
    return null;
  }

  /**
   * Check if a continuation row is properly placed after its parent
   */
  private isContinuationProperlyPlaced(coreData: GridRowCore[], rowIndex: number): boolean {
    const parent = this.findParentProduct(coreData, rowIndex);
    if (!parent) return false;

    // Continuation should be after parent and any of its sub-items
    for (let i = rowIndex - 1; i >= 0; i--) {
      const prevRow = coreData[i];
      if (prevRow.id === parent.id) {
        // Found the parent - check if there are only sub-items between parent and continuation
        for (let j = i + 1; j < rowIndex; j++) {
          const betweenRow = coreData[j];
          if (betweenRow.rowType !== 'subItem') {
            return false; // Something other than sub-items between parent and continuation
          }
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a row is a special item (uses product type category)
   */
  private isSpecialItem(row: GridRowCore): boolean {
    if (!row.productTypeId) return false;

    // Check if product type category is 'special'
    const productType = this.productTypes.find(pt => pt.id === row.productTypeId);
    return productType?.category === 'special';
  }

  /**
   * Check if a row is a subtotal or divider row
   * Uses product type category instead of hardcoded names for consistency
   */
  private isSubtotalOrDividerRow(row: GridRowCore): boolean {
    if (!row.productTypeId) return false;

    // Check if product type category is 'special' (consistent with isSpecialItem)
    // Special items include: Subtotal, Divider, Text/Note, etc.
    const productType = this.productTypes.find(pt => pt.id === row.productTypeId);
    return productType?.category === 'special';
  }
}
