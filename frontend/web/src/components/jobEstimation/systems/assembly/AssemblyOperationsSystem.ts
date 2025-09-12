/**
 * Assembly Operations System
 * 
 * Core assembly operations: item management, row finding, and assembly operations.
 * Focused on assembly business logic and item assignments.
 */

import { EstimateRow } from '../../types';

export interface AssemblyItem {
  id: string;
  number: number;
  name: string;
}

export class AssemblyOperationsSystem {
  
  constructor(
    private rows: EstimateRow[],
    private onRowsChange: (rows: EstimateRow[]) => void,
    private onEstimateChange: () => void
  ) {}
  
  updateRows(rows: EstimateRow[]): void {
    this.rows = rows;
  }
  
  // ===== ROW OPERATIONS =====
  
  findRowByLogicalNumber(targetNumber: number): number {
    let currentNumber = 0;
    
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      
      // Simplified for uniform product system - only count main rows
      if (row.isMainRow && !row.parentProductId) {
        currentNumber++;
        
        if (currentNumber === targetNumber) {
          return i;
        }
      }
    }
    
    return -1;
  }
  
  getAssemblyIndex(rowIndex: number): number {
    // Assembly system simplified - return 0 for now
    // This will be handled by new modular assembly system
    return 0;
  }
  
  // ===== ASSEMBLY OPERATIONS =====
  
  handleAssemblyItemToggle(assemblyIndex: number, itemId: string, isSelected: boolean): void {
    const newRows = [...this.rows];
    const itemRow = newRows.find(r => r.id === itemId);
    
    if (itemRow) {
      if (isSelected) {
        itemRow.data.assemblyGroup = assemblyIndex;
      } else {
        delete itemRow.data.assemblyGroup;
      }
      this.onRowsChange(newRows);
      this.onEstimateChange();
    }
  }
  
  getAvailableItems(includeAssigned: boolean = false): AssemblyItem[] {
    const items: AssemblyItem[] = [];
    
    this.rows.forEach((row, index) => {
      // Simplified for uniform product system - only main rows with products
      if (row.isMainRow && row.productTypeId && !row.parentProductId) {
        if (!includeAssigned && row.data?.assemblyGroup !== undefined) return;
        
        let logicalNumber = 0;
        for (let i = 0; i <= index; i++) {
          const r = this.rows[i];
          if (r.isMainRow && !r.parentProductId) {
            logicalNumber++;
          }
        }
        
        items.push({
          id: row.id,
          number: logicalNumber,
          name: row.productTypeName || row.data.name || `Item ${logicalNumber}`
        });
      }
    });
    
    return items;
  }
  
  isItemInAssembly(itemId: string, assemblyIndex: number): boolean {
    const row = this.rows.find(r => r.id === itemId);
    return row?.data?.assemblyGroup === assemblyIndex;
  }
  
  getAssemblyDropdownOptions(): Array<{value: string, label: string, disabled?: boolean}> {
    const unassignedItems = this.getAvailableItems(false);
    return [
      { value: '', label: '── Deselect ──', disabled: false },
      ...unassignedItems.map(item => ({
        value: item.number.toString(),
        label: `${item.number} - ${item.name}`,
        disabled: false
      }))
    ];
  }
  
  // ===== REFERENCE CLEANUP =====
  
  recalculateAssemblyReferences(rows: EstimateRow[]): EstimateRow[] {
    // Assembly reference system simplified - return rows as-is
    // Will be handled by new modular assembly system
    return [...rows];
  }
}