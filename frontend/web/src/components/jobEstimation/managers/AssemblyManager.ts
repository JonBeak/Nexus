import { EstimateRow, AssemblyOperations } from '../types';
import { UnifiedAssemblySystem } from '../systems/UnifiedAssemblySystem';

/**
 * Assembly Manager - Unified System Integration
 * 
 * Bridges the gap between existing AssemblyOperations interface and the new unified system.
 * All logic delegated to UnifiedAssemblySystem for consistency and maintainability.
 */
export class AssemblyManager implements AssemblyOperations {
  private unifiedSystem: UnifiedAssemblySystem;
  
  constructor(
    rows: EstimateRow[],
    onRowsChange: (rows: EstimateRow[]) => void,
    onEstimateChange: () => void
  ) {
    this.unifiedSystem = new UnifiedAssemblySystem(rows, onRowsChange, onEstimateChange);
  }

  handleAssemblyItemToggle = (assemblyIndex: number, itemId: string, isSelected: boolean): void => {
    this.unifiedSystem.handleAssemblyItemToggle(assemblyIndex, itemId, isSelected);
  };

  getAvailableItems = (includeAssigned: boolean = false): Array<{id: string, number: number, name: string}> => {
    return this.unifiedSystem.getAvailableItems(includeAssigned);
  };

  isItemInAssembly = (itemId: string, assemblyIndex: number): boolean => {
    return this.unifiedSystem.isItemInAssembly(itemId, assemblyIndex);
  };

  getAssemblyColor = (assemblyIndex: number): string => {
    return this.unifiedSystem.getAssemblyColor(assemblyIndex);
  };

  getAssemblyIndex = (rowIndex: number): number => {
    return this.unifiedSystem.getAssemblyIndex(rowIndex);
  };

  findRowByLogicalNumber = (targetNumber: number): number => {
    return this.unifiedSystem.findRowByLogicalNumber(targetNumber);
  };

  countAssemblyFieldUsage = (targetNumber: string, excludeAssemblyId?: string, excludeFieldName?: string): number => {
    return this.unifiedSystem.countAssemblyFieldUsage(targetNumber, excludeAssemblyId, excludeFieldName);
  };

  validateAssemblyFieldValue = (value: string, currentAssemblyId: string, currentFieldName?: string): string[] => {
    return this.unifiedSystem.validateAssemblyFieldValue(value, currentAssemblyId, currentFieldName);
  };

  getAssemblyDropdownOptions = (): Array<{value: string, label: string, disabled?: boolean}> => {
    return this.unifiedSystem.getAssemblyDropdownOptions();
  };
}

// Legacy compatibility - delegate to unified system
export { UnifiedAssemblySystem as OptimizedAssemblyValidator };