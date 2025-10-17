// Structure-level validation
// Validates business rules, sub-item placement, assembly logic, and row ordering

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

    // 4. Validate assembly group rules
    results.push(...this.validateAssemblyGroups(coreData));

    // 5. Validate subtotal lines don't split assembly groups (checked after assembly validation)
    results.push(...this.validateSubtotalPlacement(coreData));

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

  /**
   * Validate assembly group rules
   * TODO: Future feature - assembly validation not yet implemented
   * Currently returns no errors because identifyAssemblyGroups() returns empty array
   */
  private validateAssemblyGroups(coreData: GridRowCore[]): StructureValidationResult[] {
    const results: StructureValidationResult[] = [];

    // Find all assembly groups in the grid
    const assemblyGroups = this.identifyAssemblyGroups();

    for (const group of assemblyGroups) {
      // Rule 1: Assembly members must be back-to-back
      if (!this.areAssemblyMembersContiguous(coreData, group.memberRowIds)) {
        for (const memberId of group.memberRowIds) {
          results.push({
            rowId: memberId,
            error: 'Assembly group members must be placed back-to-back',
            rule: 'assembly_not_contiguous',
            severity: 'error'
          });
        }
      }

      // Rule 2: Only parent items can be selected for assembly groups
      for (const memberId of group.memberRowIds) {
        const member = coreData.find(r => r.id === memberId);
        if (member && member.rowType !== 'main') {
          results.push({
            rowId: memberId,
            error: 'Only main products can be assembly group members',
            rule: 'assembly_non_main_member',
            severity: 'error'
          });
        }
      }

      // Rule 3: Assembly row must be at the bottom of the group
      if (group.assemblyRowId && !this.isAssemblyRowAtBottom(coreData, group)) {
        results.push({
          rowId: group.assemblyRowId,
          error: 'Assembly row must be placed at the bottom of the assembly group',
          rule: 'assembly_row_not_at_bottom',
          severity: 'error'
        });
      }

      // Rule 4: Maximum 9 assembly group members
      if (group.memberRowIds.length > 9) {
        for (const memberId of group.memberRowIds.slice(9)) {
          results.push({
            rowId: memberId,
            error: 'Assembly groups cannot have more than 9 members',
            rule: 'assembly_too_many_members',
            severity: 'error'
          });
        }
      }

      // Rule 5: Each assembly member can only belong to one assembly
      // This would be checked across all groups - implementation depends on how assembly membership is tracked
    }

    return results;
  }

  /**
   * Validate that subtotal lines don't split assembly groups
   * Checked after assembly validation
   * TODO: Future feature - assembly validation not yet implemented
   * Currently returns no errors because identifyAssemblyGroups() returns empty array
   */
  private validateSubtotalPlacement(coreData: GridRowCore[]): StructureValidationResult[] {
    const results: StructureValidationResult[] = [];

    // Find all assembly groups
    const assemblyGroups = this.identifyAssemblyGroups();

    for (const group of assemblyGroups) {
      if (group.memberRowIds.length < 2) continue; // Single-member groups can't be split

      // Get the range of indices for this assembly group
      const memberIndices = group.memberRowIds
        .map(id => coreData.findIndex(r => r.id === id))
        .filter(index => index !== -1)
        .sort((a, b) => a - b);

      if (memberIndices.length < 2) continue;

      const groupStartIndex = memberIndices[0];
      const groupEndIndex = memberIndices[memberIndices.length - 1];

      // Check for subtotal/divider rows within the assembly group range
      for (let i = groupStartIndex + 1; i < groupEndIndex; i++) {
        const row = coreData[i];

        // Skip if this row is part of the assembly group
        if (group.memberRowIds.includes(row.id)) continue;

        // Check if this is a subtotal or divider row
        if (this.isSubtotalOrDividerRow(row)) {
          results.push({
            rowId: row.id,
            error: 'Subtotal and divider lines cannot split assembly groups',
            rule: 'subtotal_splits_assembly',
            severity: 'error'
          });

          // Also flag the assembly group members for clarity
          for (const memberId of group.memberRowIds) {
            results.push({
              rowId: memberId,
              error: 'Assembly group is split by a subtotal or divider line',
              rule: 'assembly_split_by_subtotal',
              severity: 'error'
            });
          }
        }
      }
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

  /**
   * Identify assembly groups in the grid
   * TODO: Future feature - assembly validation not yet implemented
   * This is a placeholder - implementation depends on how assembly membership is tracked
   */
  private identifyAssemblyGroups(): AssemblyGroup[] {
    // Placeholder implementation - you'll need to implement based on how assemblies are tracked
    // This might involve checking row metadata, assembly IDs, or other markers

    const groups: AssemblyGroup[] = [];

    // Example: Look for rows with assembly markers or assembly-related data
    // Implementation depends on your assembly system design

    return groups;
  }

  /**
   * Check if assembly members are contiguous (back-to-back)
   * TODO: Future feature - used by assembly validation stubs
   */
  private areAssemblyMembersContiguous(coreData: GridRowCore[], memberRowIds: string[]): boolean {
    if (memberRowIds.length <= 1) return true;

    // Find indices of all member rows
    const memberIndices = memberRowIds
      .map(id => coreData.findIndex(r => r.id === id))
      .filter(index => index !== -1)
      .sort((a, b) => a - b);

    // Check if indices are consecutive
    for (let i = 1; i < memberIndices.length; i++) {
      if (memberIndices[i] !== memberIndices[i - 1] + 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if assembly row is at the bottom of its group
   * TODO: Future feature - used by assembly validation stubs
   */
  private isAssemblyRowAtBottom(coreData: GridRowCore[], group: AssemblyGroup): boolean {
    if (!group.assemblyRowId || group.memberRowIds.length === 0) return true;

    const assemblyRowIndex = coreData.findIndex(r => r.id === group.assemblyRowId);
    const maxMemberIndex = Math.max(
      ...group.memberRowIds.map(id => coreData.findIndex(r => r.id === id))
    );

    return assemblyRowIndex > maxMemberIndex;
  }
}

// Supporting interfaces

interface AssemblyGroup {
  memberRowIds: string[];
  assemblyRowId?: string;
  assemblyId?: string;
}
