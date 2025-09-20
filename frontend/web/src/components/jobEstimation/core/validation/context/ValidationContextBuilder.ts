// Validation Context Builder - Constructs complete validation context
// Combines customer preferences, grid state, and calculated values

import { GridRowCore } from '../../types/CoreTypes';
import { ValidationContext } from '../templates/ValidationTemplate';
import { CustomerManufacturingPreferences } from './useCustomerPreferences';

export class ValidationContextBuilder {
  /**
   * Build validation context for a specific row
   * @param row - Row to build context for
   * @param allRows - All rows in the grid (for grid-wide context)
   * @param customerPreferences - Customer manufacturing preferences
   * @param calculatedValues - Pre-calculated values from Phase 1
   * @returns Complete validation context
   */
  static buildContext(
    row: GridRowCore,
    allRows: GridRowCore[],
    customerPreferences?: CustomerManufacturingPreferences,
    calculatedValues?: any
  ): ValidationContext {
    // Build grid-wide context
    const gridContext = {
      hasAnyUL: this.hasAnyUL(allRows),
      totalWattage: this.getTotalWattage(allRows, calculatedValues),
      rowCount: allRows.length
    };

    // Use defaults if preferences not provided
    const prefs = customerPreferences || this.getDefaultPreferences();

    return {
      rowData: row.data,
      customerPreferences: prefs,
      gridContext,
      calculatedValues: calculatedValues || {}
    };
  }

  /**
   * Build contexts for multiple rows
   * @param rows - Rows to build contexts for
   * @param allRows - All rows in the grid
   * @param customerPreferences - Customer manufacturing preferences
   * @param calculatedValuesMap - Map of row ID to calculated values
   * @returns Map of row ID to validation context
   */
  static buildContextsMap(
    rows: GridRowCore[],
    allRows: GridRowCore[],
    customerPreferences?: CustomerManufacturingPreferences,
    calculatedValuesMap?: Map<string, any>
  ): Map<string, ValidationContext> {
    const contexts = new Map<string, ValidationContext>();

    for (const row of rows) {
      const calculatedValues = calculatedValuesMap?.get(row.id);
      const context = this.buildContext(row, allRows, customerPreferences, calculatedValues);
      contexts.set(row.id, context);
    }

    return contexts;
  }

  /**
   * Calculate derived values for all rows (Phase 1 of validation)
   * @param rows - Rows to calculate values for
   * @param customerPreferences - Customer preferences for calculations
   * @returns Map of row ID to calculated values
   */
  static calculateDerivedValues(
    rows: GridRowCore[],
    customerPreferences?: CustomerManufacturingPreferences
  ): Map<string, any> {
    const calculatedValues = new Map<string, any>();

    for (const row of rows) {
      const calculations: any = {};

      // Calculate values based on product type
      if (row.productTypeId === 1) { // Channel Letters
        calculations.ledCount = this.calculateLedCount(row, customerPreferences);
        calculations.totalInches = this.calculateTotalInches(row);
        calculations.totalWattage = this.calculateTotalWattage(calculations.ledCount);
        calculations.psCount = this.calculatePsCount(calculations.ledCount, calculations.totalWattage);
      }

      // Add other product type calculations here as needed

      calculatedValues.set(row.id, calculations);
    }

    return calculatedValues;
  }

  /**
   * Calculate LED count for Channel Letters
   */
  private static calculateLedCount(row: GridRowCore, customerPreferences?: CustomerManufacturingPreferences): number {
    const field1 = row.data.field1?.trim();
    const field2 = row.data.field2?.trim();
    const field3 = row.data.field3?.trim()?.toLowerCase();

    // No channel letters data
    if (!field1 || !field2) {
      return typeof field3 === 'string' && !isNaN(parseFloat(field3)) ? parseFloat(field3) : 0;
    }

    // Handle field3 overrides
    if (field3 === 'no') return 0;
    if (field3 === 'yes' || !field3) {
      // Calculate from field2 if customer uses LEDs or field3 is "yes"
      if (customerPreferences?.use_leds || field3 === 'yes') {
        return this.parseLedsFromChannelData(field2);
      }
      return 0;
    }

    // Numeric override
    if (!isNaN(parseFloat(field3))) {
      return parseFloat(field3);
    }

    return 0;
  }

  /**
   * Parse LED count from channel letters data
   */
  private static parseLedsFromChannelData(data: string): number {
    try {
      const segments = data.split(',').map(s => s.trim());
      let totalLeds = 0;

      for (const segment of segments) {
        const dimensions = segment.split('x').map(d => parseFloat(d.trim()));
        if (dimensions.length >= 2 && !isNaN(dimensions[0]) && !isNaN(dimensions[1])) {
          const perimeter = 2 * (dimensions[0] + dimensions[1]);
          totalLeds += Math.ceil(perimeter / 3); // 1 LED per 3 inches
        }
      }

      return Math.max(totalLeds, 4); // Minimum 4 LEDs
    } catch (error) {
      return 4; // Fallback
    }
  }

  /**
   * Calculate total inches from channel letters data
   */
  private static calculateTotalInches(row: GridRowCore): number {
    const field2 = row.data.field2?.trim();
    if (!field2) return 0;

    try {
      const segments = field2.split(',').map(s => s.trim());
      let totalInches = 0;

      for (const segment of segments) {
        const dimensions = segment.split('x').map(d => parseFloat(d.trim()));
        if (dimensions.length >= 1 && !isNaN(dimensions[0])) {
          totalInches += dimensions[0]; // First dimension is typically height/width
        }
      }

      return totalInches;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate total wattage from LED count
   */
  private static calculateTotalWattage(ledCount: number): number {
    return ledCount * 1.2; // Assume 1.2W per LED
  }

  /**
   * Calculate power supply count from LED wattage
   */
  private static calculatePsCount(ledCount: number, totalWattage: number): number {
    if (ledCount === 0) return 0;
    return Math.ceil(totalWattage / 60); // Assume 60W per PS
  }

  /**
   * Check if any row has UL requirement
   */
  private static hasAnyUL(rows: GridRowCore[]): boolean {
    return rows.some(row => {
      const ulField = row.data.field4?.trim()?.toLowerCase();
      return ulField === 'yes' || (ulField && ulField !== 'no');
    });
  }

  /**
   * Get total wattage across all rows
   */
  private static getTotalWattage(rows: GridRowCore[], calculatedValuesMap?: Map<string, any>): number {
    let total = 0;

    if (calculatedValuesMap) {
      for (const row of rows) {
        const calculations = calculatedValuesMap.get(row.id);
        if (calculations?.totalWattage) {
          total += calculations.totalWattage;
        }
      }
    }

    return total;
  }

  /**
   * Get default customer preferences
   */
  private static getDefaultPreferences(): CustomerManufacturingPreferences {
    return {
      customer_id: 0,
      use_leds: false,
      default_led_type: 'Standard LED',
      requires_transformers: false,
      default_transformer: 'DC-60W',
      default_ul_requirement: false
    };
  }

  /**
   * Validate grid structure and dependencies
   * @param rows - All rows in the grid
   * @param contexts - Validation contexts for all rows
   * @returns Array of structural validation issues
   */
  static validateStructure(
    rows: GridRowCore[],
    contexts: Map<string, ValidationContext>
  ): string[] {
    const issues: string[] = [];

    // Check for dependency violations
    for (const row of rows) {
      const context = contexts.get(row.id);
      if (!context) continue;

      // Add structure validation logic here
      // For example:
      // - Check for orphaned sub-items
      // - Validate assembly group consistency
      // - Check for incomplete product combinations
    }

    return issues;
  }

  /**
   * Get dependency information for a field
   * @param fieldName - Field to check dependencies for
   * @param validationConfig - Validation configuration
   * @param context - Current validation context
   * @returns Dependency check result
   */
  static checkFieldDependencies(
    fieldName: string,
    validationConfig: any,
    context: ValidationContext
  ): { satisfied: boolean; missingDependencies: string[] } {
    const config = validationConfig[fieldName];
    if (!config) {
      return { satisfied: true, missingDependencies: [] };
    }

    const missingDependencies: string[] = [];

    // Check regular field dependencies
    if (config.depends_on) {
      for (const depField of config.depends_on) {
        const depValue = context.rowData[depField];
        if (!depValue || (typeof depValue === 'string' && depValue.trim() === '')) {
          missingDependencies.push(depField);
        }
      }
    }

    // Check calculated value dependencies
    if (config.depends_on_calculated) {
      for (const depField of config.depends_on_calculated) {
        const depValue = context.calculatedValues[depField];
        if (depValue === undefined || depValue === null || depValue <= 0) {
          missingDependencies.push(depField);
        }
      }
    }

    return {
      satisfied: missingDependencies.length === 0,
      missingDependencies
    };
  }
}