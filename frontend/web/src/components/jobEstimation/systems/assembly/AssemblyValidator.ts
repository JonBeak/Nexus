/**
 * Assembly Validator System
 * 
 * O(n) optimized validation system for assembly field references.
 * High performance validation with Map-based lookups.
 */

import { EstimateRow } from '../../types';

export interface ValidationContext {
  currentAssemblyId: string;
  currentFieldName: string;
  excludeAssemblyId?: string;
  excludeFieldName?: string;
}

export class AssemblyValidator {
  private usageMap: Map<string, Array<{assemblyId: string, fieldName: string}>> = new Map();
  private rows: EstimateRow[] = [];
  
  constructor(rows: EstimateRow[]) {
    this.rows = rows;
  }
  
  updateRows(rows: EstimateRow[]): void {
    this.rows = rows;
    this.usageMap.clear(); // Clear cache when rows change
  }
  
  buildUsageMap(): void {
    this.usageMap.clear();
    
    this.rows.forEach(row => {
      // Assembly validation temporarily disabled
      if (false && row.productTypeId === 14) {
        for (let fieldNum = 1; fieldNum <= 11; fieldNum++) {
          const fieldName = `item_${fieldNum}`;
          const value = row.data[fieldName];
          
          if (value && value.trim() !== '') {
            if (!this.usageMap.has(value)) {
              this.usageMap.set(value, []);
            }
            this.usageMap.get(value)!.push({
              assemblyId: row.id,
              fieldName: fieldName
            });
          }
        }
      }
    });
  }
  
  /**
   * O(1) - Validate single field instantly using map lookup
   */
  validateAssemblyField(value: string, currentAssemblyId: string, currentFieldName: string): string[] {
    const errors: string[] = [];
    
    if (!value || value.trim() === '') {
      return errors;
    }
    
    const targetNumber = parseInt(value);
    if (isNaN(targetNumber)) {
      errors.push('Must be a number');
      return errors;
    }
    
    // O(1) lookup for duplicate usage
    const usages = this.usageMap.get(value);
    if (usages && usages.length > 0) {
      const otherUsages = usages.filter(usage => 
        usage.assemblyId !== currentAssemblyId || usage.fieldName !== currentFieldName
      );
      
      if (otherUsages.length > 0) {
        errors.push('Already used in another assembly');
      }
    }
    
    return errors;
  }
  
  /**
   * Comprehensive validation with row existence and type checks
   */
  validateAssemblyFieldValue(
    value: string, 
    currentAssemblyId: string, 
    currentFieldName?: string,
    findRowByLogicalNumber?: (targetNumber: number) => number
  ): string[] {
    const errors: string[] = [];
    
    if (!value || value === '') {
      return errors;
    }
    
    const targetNumber = parseInt(value);
    if (isNaN(targetNumber)) {
      errors.push('Must be a number');
      return errors;
    }
    
    // Check row existence if finder function provided
    if (findRowByLogicalNumber) {
      const targetRowIndex = findRowByLogicalNumber(targetNumber);
      if (targetRowIndex === -1) {
        errors.push('Row does not exist');
      } else {
        const targetRow = this.rows[targetRowIndex];
        // TODO: Re-implement assembly validation with unified product system
        // if (targetRow.type === 'assembly') {
        //   errors.push('Cannot reference assembly rows');
        // }
        // if (targetRow.type === 'sub_item') {
        //   errors.push('Cannot reference sub-items');
        // }
      }
    }
    
    // Check for duplicate usage
    const usageCount = this.countFieldUsage(value, currentAssemblyId, currentFieldName);
    if (usageCount > 0) {
      errors.push('Already used in another assembly');
    }
    
    return errors;
  }
  
  /**
   * O(1) - Count field usage instantly
   */
  countFieldUsage(targetNumber: string, excludeAssemblyId?: string, excludeFieldName?: string): number {
    const usages = this.usageMap.get(targetNumber);
    if (!usages) return 0;
    
    return usages.filter(usage => {
      if (excludeAssemblyId && usage.assemblyId === excludeAssemblyId) {
        return excludeFieldName ? usage.fieldName !== excludeFieldName : false;
      }
      return true;
    }).length;
  }
  
  /**
   * O(n) - Count usage the traditional way for backward compatibility
   */
  countAssemblyFieldUsage(targetNumber: string, excludeAssemblyId?: string, excludeFieldName?: string): number {
    let count = 0;
    
    this.rows.forEach(row => {
      // Assembly validation temporarily disabled
      if (false && row.productTypeId === 14) {
        if (excludeAssemblyId && row.id === excludeAssemblyId) {
          for (let fieldNum = 1; fieldNum <= 11; fieldNum++) {
            const fieldName = `item_${fieldNum}`;
            const fieldValue = row.data[fieldName];
            
            if (excludeFieldName && fieldName === excludeFieldName) {
              continue;
            }
            
            if (fieldValue === targetNumber) {
              count++;
            }
          }
        } else {
          for (let fieldNum = 1; fieldNum <= 11; fieldNum++) {
            const fieldName = `item_${fieldNum}`;
            const fieldValue = row.data[fieldName];
            if (fieldValue === targetNumber) {
              count++;
            }
          }
        }
      }
    });
    
    return count;
  }
  
  /**
   * O(n) - Validate all assemblies at once
   */
  validateAllAssemblies(): Record<string, Record<string, string[]>> {
    this.buildUsageMap();
    const errors: Record<string, Record<string, string[]>> = {};
    
    this.usageMap.forEach((usages, value) => {
      if (usages.length > 1) {
        usages.slice(1).forEach(usage => {
          if (!errors[usage.assemblyId]) {
            errors[usage.assemblyId] = {};
          }
          errors[usage.assemblyId][usage.fieldName] = ['Already used in another assembly'];
        });
      }
    });
    
    return errors;
  }
}