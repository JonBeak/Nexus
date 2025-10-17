// Assembly Group Assignment - Frontend Logic
// Assigns assembly groups to sub-items based on their parent's assembly membership
// Called after validation layer completes

import { GridRowCore } from '../types/CoreTypes';

export interface AssemblyAssignment {
  rowId: string;
  assemblyId?: string;
  assemblyGroupId?: string;
  inheritedFromParent?: string; // ID of parent row this was inherited from
}

export class AssemblyAssigner {
  /**
   * Assign assembly groups to all rows based on business rules
   * Sub-items inherit their parent's assembly group membership
   * @param coreData - Complete grid data for assembly assignment
   * @returns Array of assembly assignments for each row
   */
  assignAssemblyGroups(coreData: GridRowCore[]): AssemblyAssignment[] {
    const assignments: AssemblyAssignment[] = [];

    // First pass: Process main products and their explicit assembly assignments
    const mainProductAssemblies = this.processMainProductAssemblies(coreData);

    // Second pass: Assign sub-items to their parent's assembly groups
    for (let i = 0; i < coreData.length; i++) {
      const row = coreData[i];

      if (row.rowType === 'main') {
        // Main products: Use their explicit assembly assignment (if any)
        const assemblyInfo = mainProductAssemblies.get(row.id);
        assignments.push({
          rowId: row.id,
          assemblyId: assemblyInfo?.assemblyId,
          assemblyGroupId: assemblyInfo?.assemblyGroupId
        });

      } else if (row.rowType === 'subItem') {
        // Sub-items: Inherit from parent
        const parentAssignment = this.findParentAssemblyAssignment(row, coreData, mainProductAssemblies);
        assignments.push({
          rowId: row.id,
          assemblyId: parentAssignment?.assemblyId,
          assemblyGroupId: parentAssignment?.assemblyGroupId,
          inheritedFromParent: parentAssignment?.parentId
        });

      } else if (row.rowType === 'continuation') {
        // Continuation rows: Inherit from parent (same as sub-items)
        const parentAssignment = this.findParentAssemblyAssignment(row, coreData, mainProductAssemblies);
        assignments.push({
          rowId: row.id,
          assemblyId: parentAssignment?.assemblyId,
          assemblyGroupId: parentAssignment?.assemblyGroupId,
          inheritedFromParent: parentAssignment?.parentId
        });
      }
    }

    return assignments;
  }

  /**
   * Process main products and extract their assembly assignments
   * This would integrate with the assembly UI/selection system
   */
  private processMainProductAssemblies(coreData: GridRowCore[]): Map<string, MainProductAssemblyInfo> {
    const assignments = new Map<string, MainProductAssemblyInfo>();

    for (const row of coreData) {
      if (row.rowType !== 'main') continue;

      // Extract assembly information from row data or metadata
      // This depends on how assembly selection is implemented in the UI
      const assemblyInfo = this.extractAssemblyInfoFromRow(row);

      if (assemblyInfo.assemblyId || assemblyInfo.assemblyGroupId) {
        assignments.set(row.id, assemblyInfo);
      }
    }

    return assignments;
  }

  /**
   * Extract assembly information from a main product row
   * This is a placeholder - implementation depends on how assembly selection works
   */
  private extractAssemblyInfoFromRow(row: GridRowCore): MainProductAssemblyInfo {
    // Placeholder implementation - you'll need to implement based on your assembly UI design
    // This might check row.data for assembly fields, or row metadata, or other markers

    // Look for assembly-related data fields
    const assemblyId = row.data.assembly_id || undefined;
    const assemblyGroupId = row.data.assembly_group_id || undefined;

    return {
      assemblyId,
      assemblyGroupId
    };
  }

  /**
   * Find parent assembly assignment for sub-items and continuation rows
   */
  private findParentAssemblyAssignment(
    row: GridRowCore,
    coreData: GridRowCore[],
    mainProductAssemblies: Map<string, MainProductAssemblyInfo>
  ): ParentAssemblyInfo | null {
    // Find the parent main product
    const rowIndex = coreData.findIndex(r => r.id === row.id);
    if (rowIndex === -1) return null;

    // Look backwards for the nearest main product
    for (let i = rowIndex - 1; i >= 0; i--) {
      const candidateRow = coreData[i];
      if (candidateRow.rowType === 'main') {
        // Found the parent main product
        const parentAssembly = mainProductAssemblies.get(candidateRow.id);
        return {
          parentId: candidateRow.id,
          assemblyId: parentAssembly?.assemblyId,
          assemblyGroupId: parentAssembly?.assemblyGroupId
        };
      }
    }

    return null;
  }

  /**
   * Apply assembly assignments to grid rows (updates the core data)
   * This modifies the rows with assembly information for UI display
   */
  applyAssignmentsToRows(
    coreData: GridRowCore[],
    assignments: AssemblyAssignment[]
  ): GridRowCore[] {
    const assignmentMap = new Map(assignments.map(a => [a.rowId, a]));

    return coreData.map(row => {
      const assignment = assignmentMap.get(row.id);
      if (!assignment) return row;

      // Apply assembly assignment to row data or metadata
      // This depends on how you want to store assembly info in the row

      return {
        ...row,
        // Option 1: Store in data fields
        data: {
          ...row.data,
          assembly_id: assignment.assemblyId || '',
          assembly_group_id: assignment.assemblyGroupId || ''
        }
        // Option 2: Store in metadata (if you add assembly fields to metadata)
        // metadata: {
        //   ...row.metadata,
        //   assemblyId: assignment.assemblyId,
        //   assemblyGroupId: assignment.assemblyGroupId,
        //   inheritedFromParent: assignment.inheritedFromParent
        // }
      };
    });
  }

  /**
   * Get assembly group summary for UI display
   * Shows which rows belong to which assembly groups
   */
  getAssemblyGroupSummary(assignments: AssemblyAssignment[]): AssemblyGroupSummary[] {
    const groups = new Map<string, AssemblyGroupSummary>();

    for (const assignment of assignments) {
      if (!assignment.assemblyGroupId) continue;

      const groupId = assignment.assemblyGroupId;
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          assemblyGroupId: groupId,
          assemblyId: assignment.assemblyId,
          memberRowIds: [],
          mainProductIds: [],
          subItemIds: []
        });
      }

      const group = groups.get(groupId)!;
      group.memberRowIds.push(assignment.rowId);

      if (assignment.inheritedFromParent) {
        group.subItemIds.push(assignment.rowId);
      } else {
        group.mainProductIds.push(assignment.rowId);
      }
    }

    return Array.from(groups.values());
  }

  /**
   * Validate assembly assignments for consistency
   * Returns any assignment errors that need UI attention
   */
  validateAssignments(assignments: AssemblyAssignment[]): AssignmentValidationError[] {
    const errors: AssignmentValidationError[] = [];

    // Create assignment lookup for validation
    const assignmentMap = new Map(assignments.map(a => [a.rowId, a]));

    // Check for assembly inheritance consistency: children must match parent's assembly
    for (const assignment of assignments) {
      if (assignment.inheritedFromParent) {
        // Find the parent assignment
        const parentAssignment = assignmentMap.get(assignment.inheritedFromParent);

        if (parentAssignment) {
          // Validate that child's assembly matches parent's assembly (including null/undefined)
          if (assignment.assemblyGroupId !== parentAssignment.assemblyGroupId) {
            errors.push({
              rowId: assignment.rowId,
              errorType: 'assembly_inheritance_mismatch',
              message: `Sub-item assembly group doesn't match parent (parent: ${parentAssignment.assemblyGroupId || 'none'}, child: ${assignment.assemblyGroupId || 'none'})`
            });
          }
        }
      }
    }

    // Check for assembly group consistency (only when groups actually exist)
    const groupSummary = this.getAssemblyGroupSummary(assignments);
    for (const group of groupSummary) {
      if (group.mainProductIds.length === 0) {
        errors.push({
          rowId: group.subItemIds[0], // Flag one of the sub-items
          errorType: 'assembly_no_main_products',
          message: `Assembly group ${group.assemblyGroupId} has sub-items but no main products`
        });
      }
    }

    return errors;
  }
}

// Supporting interfaces

interface MainProductAssemblyInfo {
  assemblyId?: string;
  assemblyGroupId?: string;
}

interface ParentAssemblyInfo {
  parentId: string;
  assemblyId?: string;
  assemblyGroupId?: string;
}

export interface AssemblyGroupSummary {
  assemblyGroupId: string;
  assemblyId?: string;
  memberRowIds: string[];
  mainProductIds: string[];
  subItemIds: string[];
}

export interface AssignmentValidationError {
  rowId: string;
  errorType: 'assembly_inheritance_mismatch' | 'assembly_no_main_products' | 'circular_reference';
  message: string;
}