/**
 * Unified Assembly System - Orchestrator
 * 
 * Orchestrates focused assembly modules to provide unified interface.
 * Delegates to specialized systems while maintaining API compatibility.
 * 
 * Under 200 lines - focused orchestration only.
 */

import { EstimateRow, AssemblyOperations } from '../types';
import { AssemblyColorSystem } from './assembly/AssemblyColorSystem';
import { AssemblyValidator } from './assembly/AssemblyValidator';
import { AssemblyPreviewSystem, AssemblyPreviewData } from './assembly/AssemblyPreviewSystem';
import { AssemblyOperationsSystem, AssemblyItem } from './assembly/AssemblyOperationsSystem';

export class UnifiedAssemblySystem implements AssemblyOperations {
  private colorSystem = AssemblyColorSystem;
  private validator: AssemblyValidator;
  private previewSystem = AssemblyPreviewSystem;
  private operations: AssemblyOperationsSystem;
  
  constructor(
    private rows: EstimateRow[],
    private onRowsChange: (rows: EstimateRow[]) => void,
    private onEstimateChange: () => void
  ) {
    this.validator = new AssemblyValidator(rows);
    this.operations = new AssemblyOperationsSystem(rows, onRowsChange, onEstimateChange);
  }
  
  // Update all subsystems when rows change
  private updateAllSystems(): void {
    this.validator.updateRows(this.rows);
    this.operations.updateRows(this.rows);
  }
  
  // ===== COLOR SYSTEM DELEGATION =====
  
  getAssemblyColor = (assemblyIndex: number): string => {
    return this.colorSystem.getAssemblyColor(assemblyIndex);
  };
  
  getAssemblyColorName = (assemblyIndex: number): string => {
    return this.colorSystem.getAssemblyColorName(assemblyIndex);
  };
  
  getAssemblyColorIndicator = (assemblyIndex: number): string => {
    return this.colorSystem.getAssemblyColorIndicator(assemblyIndex);
  };
  
  // ===== OPERATIONS SYSTEM DELEGATION =====
  
  findRowByLogicalNumber = (targetNumber: number): number => {
    return this.operations.findRowByLogicalNumber(targetNumber);
  };
  
  getAssemblyIndex = (rowIndex: number): number => {
    return this.operations.getAssemblyIndex(rowIndex);
  };
  
  handleAssemblyItemToggle = (assemblyIndex: number, itemId: string, isSelected: boolean): void => {
    this.operations.handleAssemblyItemToggle(assemblyIndex, itemId, isSelected);
    this.updateAllSystems();
  };
  
  getAvailableItems = (includeAssigned: boolean = false): AssemblyItem[] => {
    return this.operations.getAvailableItems(includeAssigned);
  };
  
  isItemInAssembly = (itemId: string, assemblyIndex: number): boolean => {
    return this.operations.isItemInAssembly(itemId, assemblyIndex);
  };
  
  getAssemblyDropdownOptions = (): Array<{value: string, label: string, disabled?: boolean}> => {
    return this.operations.getAssemblyDropdownOptions();
  };
  
  recalculateAssemblyReferences = (rows: EstimateRow[]): EstimateRow[] => {
    return this.operations.recalculateAssemblyReferences(rows);
  };
  
  // ===== VALIDATION SYSTEM DELEGATION =====
  
  buildUsageMap = (): void => {
    this.validator.buildUsageMap();
  };
  
  validateAssemblyField = (value: string, currentAssemblyId: string, currentFieldName: string): string[] => {
    return this.validator.validateAssemblyField(value, currentAssemblyId, currentFieldName);
  };
  
  validateAssemblyFieldValue = (value: string, currentAssemblyId: string, currentFieldName?: string): string[] => {
    return this.validator.validateAssemblyFieldValue(
      value, 
      currentAssemblyId, 
      currentFieldName, 
      (targetNumber) => this.operations.findRowByLogicalNumber(targetNumber)
    );
  };
  
  countAssemblyFieldUsage = (targetNumber: string, excludeAssemblyId?: string, excludeFieldName?: string): number => {
    return this.validator.countAssemblyFieldUsage(targetNumber, excludeAssemblyId, excludeFieldName);
  };
  
  // ===== PREVIEW SYSTEM DELEGATION =====
  
  transformToAssemblyPreview = (): AssemblyPreviewData => {
    return this.previewSystem.transformToAssemblyPreview(this.rows);
  };
}

// ===== STATIC UTILITIES FOR EXTERNAL USE =====

export const getAssemblyColorByIndex = (assemblyIndex: number): string => {
  return AssemblyColorSystem.getAssemblyColorName(assemblyIndex);
};

export const getAssemblyColorIndicator = (colorName: string): string => {
  return AssemblyColorSystem.getAssemblyColorByName(colorName);
};

export const recalculateAssemblyReferences = (rows: EstimateRow[]): EstimateRow[] => {
  const tempOps = new AssemblyOperationsSystem(rows, () => {}, () => {});
  return tempOps.recalculateAssemblyReferences(rows);
};

export const transformRowsToAssemblyPreview = (rows: EstimateRow[]): AssemblyPreviewData => {
  return AssemblyPreviewSystem.transformToAssemblyPreview(rows);
};

// ===== RE-EXPORTS FROM SUBSYSTEMS =====

export type { AssemblyPreviewData, AssemblyPreviewItem, AssemblyPreviewGroup } from './assembly/AssemblyPreviewSystem';
export type { AssemblyItem } from './assembly/AssemblyOperationsSystem';
export type { AssemblyColor } from './assembly/AssemblyColorSystem';