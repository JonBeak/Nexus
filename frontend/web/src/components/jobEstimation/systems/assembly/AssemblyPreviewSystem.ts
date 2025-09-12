/**
 * Assembly Preview System
 * 
 * Transforms GridJobBuilder rows into EstimateTable-compatible structure.
 * Handles assembly groupings, continuation rows, and pricing calculations.
 */

import { EstimateRow } from '../../types';
import { AssemblyColorSystem } from './AssemblyColorSystem';

export interface AssemblyPreviewItem {
  id: string;
  item_name: string;
  customer_description: string;
  internal_notes: string;
  unit_price: number;
  base_quantity: number;
  extended_price: number;
  product_type: string;
  continuation_rows?: AssemblyPreviewItem[];
  parent_item_id?: string;
}

export interface AssemblyPreviewGroup {
  id: string;
  group_name: string;
  assembly_color: string;
  assembly_cost: number;
  assembly_description: string;
  items: AssemblyPreviewItem[];
  item_count: number;
  group_subtotal: number;
}

export interface AssemblyPreviewData {
  assemblyItems: AssemblyPreviewGroup[];
  ungroupedItems: AssemblyPreviewItem[];
  hasAssemblyGroups: boolean;
  totalAssemblyCount: number;
  totalItemCount: number;
  hasMultiRowItems: boolean;
}

export class AssemblyPreviewSystem {
  
  static transformToAssemblyPreview(rows: EstimateRow[]): AssemblyPreviewData {
    const assemblyGroups: Map<number, AssemblyPreviewGroup> = new Map();
    const ungroupedItems: AssemblyPreviewItem[] = [];
    let hasMultiRowItems = false;
    
    // Assembly system simplified - no special assembly groups for now
    rows.forEach((row, index) => {
      if (false) { // Remove assembly logic
        const assemblyIndex = this.getAssemblyIndex(row, index, rows);
        if (assemblyIndex !== null && !assemblyGroups.has(assemblyIndex)) {
          assemblyGroups.set(assemblyIndex, {
            id: row.id,
            group_name: row.data.description || `Assembly ${assemblyIndex + 1}`,
            assembly_color: AssemblyColorSystem.getAssemblyColorName(assemblyIndex),
            assembly_cost: parseFloat(row.data.cost?.toString() || '0'),
            assembly_description: row.data.description || `Assembly ${assemblyIndex + 1}`,
            items: [],
            item_count: 0,
            group_subtotal: 0
          });
        }
      }
    });
    
    // Process product rows
    const processedParentIds = new Set<string>();
    
    rows.forEach((row, index) => {
      if (row.productTypeId && row.isMainRow) {
        if (processedParentIds.has(row.id)) return;
        
        const continuationRows = this.findContinuationRows(row.id, rows);
        if (continuationRows.length > 0) {
          hasMultiRowItems = true;
        }
        
        const item = this.createPreviewItem(row, continuationRows, rows);
        
        const assemblyIndex = row.data?.assemblyGroup;
        if (typeof assemblyIndex === 'number' && assemblyGroups.has(assemblyIndex)) {
          const group = assemblyGroups.get(assemblyIndex)!;
          group.items.push(item);
          group.item_count++;
          group.group_subtotal += item.extended_price;
        } else {
          ungroupedItems.push(item);
        }
        
        processedParentIds.add(row.id);
        continuationRows.forEach(contRow => processedParentIds.add(contRow.id));
      }
    });
    
    const assemblyGroupsArray = Array.from(assemblyGroups.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, group]) => {
        group.group_subtotal += group.assembly_cost;
        return group;
      });
    
    return {
      assemblyItems: assemblyGroupsArray,
      ungroupedItems,
      hasAssemblyGroups: assemblyGroupsArray.length > 0,
      totalAssemblyCount: assemblyGroupsArray.length,
      totalItemCount: assemblyGroupsArray.reduce((sum, group) => sum + group.item_count, 0) + ungroupedItems.length,
      hasMultiRowItems
    };
  }
  
  private static findContinuationRows(parentId: string, rows: EstimateRow[]): EstimateRow[] {
    return rows.filter(row => 
      row.parentProductId === parentId && 
      row.productTypeId && 
      !row.isMainRow
    );
  }
  
  private static createPreviewItem(
    mainRow: EstimateRow,
    continuationRows: EstimateRow[],
    allRows: EstimateRow[]
  ): AssemblyPreviewItem {
    const allFieldData = this.combineRowFieldData(mainRow, continuationRows);
    
    const quantity = parseInt(allFieldData.quantity?.toString() || '1');
    const unitPrice = parseFloat(allFieldData.unit_price?.toString() || '45.00');
    const extendedPrice = quantity * unitPrice;
    
    const item: AssemblyPreviewItem = {
      id: mainRow.id,
      item_name: mainRow.productTypeName || 'Product',
      customer_description: this.generateCustomerDescription(allFieldData, mainRow.productTypeName),
      internal_notes: this.generateInternalNotes(allFieldData, quantity, unitPrice),
      unit_price: unitPrice,
      base_quantity: quantity,
      extended_price: extendedPrice,
      product_type: mainRow.productTypeName || 'Product'
    };
    
    if (continuationRows.length > 0) {
      item.continuation_rows = continuationRows.map(contRow => ({
        id: contRow.id,
        item_name: `${mainRow.productTypeName} (continued)`,
        customer_description: this.generateContinuationDescription(contRow.data),
        internal_notes: 'Continuation row - no separate cost',
        unit_price: 0,
        base_quantity: 0,
        extended_price: 0,
        product_type: mainRow.productTypeName || 'Product',
        parent_item_id: mainRow.id
      }));
    }
    
    return item;
  }
  
  private static combineRowFieldData(mainRow: EstimateRow, continuationRows: EstimateRow[]): Record<string, any> {
    let combinedData = { ...mainRow.data };
    continuationRows.forEach(row => {
      Object.assign(combinedData, row.data);
    });
    return combinedData;
  }
  
  private static generateCustomerDescription(fieldData: Record<string, any>, productType?: string): string {
    if (productType === 'Channel Letters') {
      const style = fieldData.style || 'Standard';
      const inches = fieldData.inches_data || '12"';
      const ledType = fieldData.led_type || 'Standard LED';
      return `${inches} ${style} Letters with ${ledType}`;
    }
    
    const mainFields = Object.entries(fieldData)
      .filter(([key, value]) => 
        value && 
        !key.startsWith('_') && 
        !['assemblyGroup', 'cost', 'description'].includes(key)
      )
      .slice(0, 3)
      .map(([key, value]) => `${value}`)
      .join(', ');
      
    return mainFields || `${productType || 'Product'} Configuration`;
  }
  
  private static generateInternalNotes(fieldData: Record<string, any>, quantity: number, unitPrice: number): string {
    const calculation = `${quantity} × $${unitPrice.toFixed(2)}/unit`;
    
    if (fieldData.internal_notes) {
      return `${fieldData.internal_notes} (${calculation})`;
    }
    
    return calculation;
  }
  
  private static generateContinuationDescription(fieldData: Record<string, any>): string {
    const fields = Object.entries(fieldData)
      .filter(([key, value]) => value && !key.startsWith('_'))
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
      
    return fields || 'Additional configuration';
  }
  
  private static getAssemblyIndex(row: EstimateRow, index: number, rows: EstimateRow[]): number | null {
    // Assembly system simplified - return null for now
    if (false) { // Remove assembly logic
      if (typeof row.data?.assemblyGroup === 'number') {
        return row.data.assemblyGroup;
      }
      
      // Assembly counting removed
      return 0;
    }
    
    return null;
  }
  
  /**
   * Legacy compatibility - transforms to old groups format
   */
  static transformToLegacyGroups(assemblyData: AssemblyPreviewData): any {
    const legacyGroups = assemblyData.assemblyItems.map((group, index) => ({
      id: group.id,
      group_name: group.group_name,
      assembly_cost: group.assembly_cost,
      assembly_description: group.assembly_description,
      items: group.items.map(item => ({
        id: item.id,
        item_name: item.item_name,
        customer_description: item.customer_description,
        internal_notes: item.internal_notes,
        unit_price: item.unit_price,
        base_quantity: item.base_quantity,
        extended_price: item.extended_price
      }))
    }));
    
    if (assemblyData.ungroupedItems.length > 0) {
      legacyGroups.push({
        id: 'ungrouped',
        group_name: 'Items',
        assembly_cost: 0,
        assembly_description: '',
        items: assemblyData.ungroupedItems.map(item => ({
          id: item.id,
          item_name: item.item_name,
          customer_description: item.customer_description,
          internal_notes: item.internal_notes,
          unit_price: item.unit_price,
          base_quantity: item.base_quantity,
          extended_price: item.extended_price
        }))
      });
    }
    
    return legacyGroups;
  }
}