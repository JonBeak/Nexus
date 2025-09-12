/**
 * CellStylingEngine - Conditional cell styling based on values and business rules
 * 
 * Adds visual feedback to grid cells based on field values, assembly groups,
 * and business rules while maintaining styling priority hierarchy.
 * 
 * Refactoring Phase R3: Conditional cell coloring and styling based on values
 */

import { EstimateRow } from '../types';

export interface CellStylingRule {
  name: string;
  description: string;
  condition: (row: EstimateRow, field: any, value: any, fieldIndex: number) => boolean;
  backgroundClass: string;
  textClass?: string;
  borderClass?: string;
  priority: number; // 1 = highest priority, 10 = lowest priority
}

export interface CellStylingResult {
  backgroundClass: string;
  textClass: string;
  borderClass: string;
  appliedRules: string[];
}

export class CellStylingEngine {
  private static readonly CELL_STYLING_RULES: CellStylingRule[] = [
    // High Priority: Critical business indicators
    {
      name: 'high_cost_warning',
      description: 'Highlight costs over $1000 with gold background',
      condition: (row, field, value) => {
        if (!field?.name || !value) return false;
        const costFields = ['cost', 'assembly_cost', 'unit_price', 'total_cost'];
        const isMoneyField = costFields.some(costField => field.name.includes(costField));
        const numValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
        return isMoneyField && !isNaN(numValue) && numValue >= 1000;
      },
      backgroundClass: 'bg-yellow-100',
      textClass: 'text-yellow-900 font-bold',
      priority: 2
    },
    {
      name: 'medium_cost_indicator',
      description: 'Highlight costs $100-999 with light gold background',
      condition: (row, field, value) => {
        if (!field?.name || !value) return false;
        const costFields = ['cost', 'assembly_cost', 'unit_price', 'total_cost'];
        const isMoneyField = costFields.some(costField => field.name.includes(costField));
        const numValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
        return isMoneyField && !isNaN(numValue) && numValue >= 100 && numValue < 1000;
      },
      backgroundClass: 'bg-yellow-50',
      textClass: 'text-yellow-800',
      priority: 3
    },
    // Medium Priority: Required field indicators
    {
      name: 'required_field_empty',
      description: 'Warn when required fields are empty',
      condition: (row, field, value) => {
        return field?.required && (!value || String(value).trim() === '');
      },
      backgroundClass: 'bg-amber-50',
      borderClass: 'border-l-2 border-amber-300',
      textClass: 'text-amber-700',
      priority: 4
    },
    {
      name: 'quantity_indicator',
      description: 'Highlight quantity fields with blue accent',
      condition: (row, field, value) => {
        if (!field?.name || !value) return false;
        const quantityFields = ['quantity', 'count', 'led_count'];
        const isQuantityField = quantityFields.some(qty => field.name.includes(qty));
        const numValue = parseFloat(String(value));
        return isQuantityField && !isNaN(numValue) && numValue > 0;
      },
      backgroundClass: 'bg-blue-50',
      textClass: 'text-blue-800',
      priority: 5
    },
    // Lower Priority: Status and informational styling
    {
      name: 'assembly_item_accent',
      description: 'Subtle accent for assembly-related fields',
      condition: (row, field, value) => {
        if (!value || row.data?.assemblyGroup === undefined) return false;
        // Add subtle accent to fields in assembly groups
        // TODO: Re-implement assembly styling with unified product system
        return false; // Disable assembly styling temporarily
      },
      backgroundClass: 'bg-slate-50',
      textClass: 'text-slate-700',
      priority: 6
    },
    {
      name: 'override_field_indicator',
      description: 'Indicate override fields with purple accent',
      condition: (row, field, value) => {
        if (!field?.name || !value) return false;
        return field.name.includes('override') && String(value).trim() !== '';
      },
      backgroundClass: 'bg-purple-50',
      textClass: 'text-purple-800',
      priority: 7
    },
    {
      name: 'special_field_types',
      description: 'Highlight special field types with green accent',
      condition: (row, field, value) => {
        if (!field?.name || !value) return false;
        const specialFields = ['mounting', 'wiring', 'installation', 'special'];
        return specialFields.some(special => field.name.includes(special)) && String(value).trim() !== '';
      },
      backgroundClass: 'bg-green-50',
      textClass: 'text-green-800',
      priority: 8
    }
  ];

  /**
   * Evaluate all styling rules for a cell and return the highest priority result
   */
  static getCellStyling(
    row: EstimateRow,
    field: any,
    value: any,
    fieldIndex: number,
    hasValidationErrors: boolean = false
  ): CellStylingResult {
    // If cell has validation errors, don't apply any conditional styling
    // Validation styling always takes highest priority
    if (hasValidationErrors) {
      return {
        backgroundClass: '',
        textClass: '',
        borderClass: '',
        appliedRules: []
      };
    }

    // Evaluate all rules and find matches
    const matchingRules = this.CELL_STYLING_RULES
      .filter(rule => rule.condition(row, field, value, fieldIndex))
      .sort((a, b) => a.priority - b.priority); // Sort by priority (lower number = higher priority)

    // If no rules match, return empty styling
    if (matchingRules.length === 0) {
      return {
        backgroundClass: '',
        textClass: '',
        borderClass: '',
        appliedRules: []
      };
    }

    // Apply the highest priority rule
    const topRule = matchingRules[0];
    
    return {
      backgroundClass: topRule.backgroundClass || '',
      textClass: topRule.textClass || '',
      borderClass: topRule.borderClass || '',
      appliedRules: matchingRules.map(rule => rule.name)
    };
  }

  /**
   * Get cell styling classes as a combined string
   */
  static getCellClasses(
    row: EstimateRow,
    field: any,
    value: any,
    fieldIndex: number,
    hasValidationErrors: boolean = false,
    baseClasses: string = ''
  ): string {
    const styling = this.getCellStyling(row, field, value, fieldIndex, hasValidationErrors);
    
    const classes = [
      baseClasses,
      styling.backgroundClass,
      styling.textClass,
      styling.borderClass
    ].filter(cls => cls && cls.trim() !== '').join(' ');

    return classes;
  }

  /**
   * Check if a field should have special emphasis
   */
  static isHighPriorityField(field: any): boolean {
    if (!field?.name) return false;
    
    const highPriorityFields = [
      'quantity', 'cost', 'assembly_cost', 'unit_price',
      'channel_letter_style', 'vinyl_type', 'type'
    ];
    
    return highPriorityFields.some(priority => 
      field.name.includes(priority) || field.name === priority
    );
  }

  /**
   * Get assembly-aware styling that works with existing assembly colors
   */
  static getAssemblyAwareStyling(
    row: EstimateRow,
    field: any,
    value: any,
    fieldIndex: number,
    hasValidationErrors: boolean = false,
    assemblyColor: string = ''
  ): string {
    const cellStyling = this.getCellStyling(row, field, value, fieldIndex, hasValidationErrors);
    
    // If no conditional styling, return assembly color
    if (cellStyling.appliedRules.length === 0) {
      return assemblyColor;
    }
    
    // For high priority rules (cost warnings), override assembly colors
    if (cellStyling.appliedRules.some(rule => rule.includes('cost'))) {
      return `${cellStyling.backgroundClass} ${cellStyling.textClass} ${cellStyling.borderClass}`.trim();
    }
    
    // For lower priority rules, blend with assembly colors
    if (assemblyColor) {
      // Extract the background color from assembly color and blend with conditional styling
      const assemblyBg = assemblyColor.split(' ').find(cls => cls.startsWith('bg-'));
      const conditionalClasses = `${cellStyling.textClass} ${cellStyling.borderClass}`.trim();
      return `${assemblyBg} ${conditionalClasses}`.trim();
    }
    
    // No assembly color, use conditional styling
    return `${cellStyling.backgroundClass} ${cellStyling.textClass} ${cellStyling.borderClass}`.trim();
  }

  /**
   * Add a custom styling rule (for dynamic business requirements)
   */
  static addCustomRule(rule: CellStylingRule): void {
    // Insert rule in priority order
    const insertIndex = this.CELL_STYLING_RULES.findIndex(r => r.priority > rule.priority);
    if (insertIndex === -1) {
      this.CELL_STYLING_RULES.push(rule);
    } else {
      this.CELL_STYLING_RULES.splice(insertIndex, 0, rule);
    }
  }

  /**
   * Get all available styling rules (for debugging and documentation)
   */
  static getAllRules(): CellStylingRule[] {
    return [...this.CELL_STYLING_RULES];
  }
}