// Main validation engine - called after autosave debounce
// Handles incremental validation and result management

import { GridRowCore } from '../types/CoreTypes';
import { ValidationTemplateRegistry } from './templates/ValidationTemplateRegistry';
import { ValidationResultsManager } from './ValidationResultsManager';
import { StructureValidator } from './validators/StructureValidator';
import { CellValidator } from './validators/CellValidator';
import { RowValidator } from './validators/RowValidator';
import { AssemblyAssigner } from './AssemblyAssigner';
import { ValidationContext } from './templates/ValidationTemplate';

export interface ValidationEngineConfig {
  productValidations: Map<number, Record<string, FieldValidationConfig>>; // Cached product validation configs
  customerPreferences?: any; // Customer manufacturing preferences
}

export interface FieldValidationConfig {
  function: string; // Template name (e.g., 'textsplit')
  params: Record<string, any>; // Template-specific parameters
  error_level: 'error' | 'warning' | 'mixed';
  error_message?: string;
  field_category?: 'complete_set' | 'sufficient' | 'supplementary' | 'context_dependent';
  depends_on?: string[]; // Field dependencies
  depends_on_calculated?: string[]; // Dependencies on calculated values
  products_affected?: string[]; // Products this field affects
}

export class ValidationEngine {
  private templateRegistry: ValidationTemplateRegistry;
  private resultsManager: ValidationResultsManager;
  private structureValidator: StructureValidator;
  private cellValidator: CellValidator;
  private rowValidator: RowValidator;
  private assemblyAssigner: AssemblyAssigner;
  private config: ValidationEngineConfig;

  constructor(config: ValidationEngineConfig) {
    this.config = config;
    this.templateRegistry = new ValidationTemplateRegistry();
    this.resultsManager = new ValidationResultsManager();
    this.structureValidator = new StructureValidator();
    this.cellValidator = new CellValidator(this.templateRegistry, config.productValidations);
    this.rowValidator = new RowValidator(config.productValidations);
    this.assemblyAssigner = new AssemblyAssigner();
  }

  /**
   * Main validation entry point - called after autosave completes
   * @param coreData - Current grid data
   * @param changedRowIds - Optional: only validate changed rows + dependencies
   * @param customerPreferences - Customer manufacturing preferences
   */
  async validateGrid(
    coreData: GridRowCore[],
    changedRowIds?: Set<string>,
    customerPreferences?: any
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // FULL REVALIDATION: Always validate all rows for simplicity and accuracy
      const rowsToValidate = coreData;

      console.log(`Validating ${rowsToValidate.length} rows`);

      // Clear ALL validation results before re-validating
      this.resultsManager.clearAllResults();

      // TWO-PHASE VALIDATION:

      // PHASE 1: Calculate derived values from basic fields
      const calculatedValues = await this.calculateDerivedValues(rowsToValidate, customerPreferences);

      // PHASE 2: Context-aware validation with calculated values
      const validationContext = this.buildValidationContext(coreData, customerPreferences, calculatedValues);

      // 1. Cell-level validation (field format, business rules) with context
      await this.validateCells(rowsToValidate, validationContext);

      // 2. Row-level validation (completeness, mandatory fields) with context
      await this.validateRows(rowsToValidate, validationContext);

      // 3. Structure validation (business rules, assembly logic) - always validate full grid
      await this.validateStructure(coreData, validationContext);

      // 4. Assembly assignment (after validation completes)
      await this.assignAssemblyGroups(coreData);

      // 5. Update global blocking status
      this.resultsManager.updateBlockingStatus();

      console.log(`Validation completed in ${performance.now() - startTime}ms`);
    } catch (error) {
      console.error('Validation engine error:', error);
      throw error;
    }
  }

  /**
   * Get validation results manager for UI lookups
   */
  getResultsManager(): ValidationResultsManager {
    return this.resultsManager;
  }

  /**
   * Check if there are blocking errors that prevent estimate calculation
   */
  hasBlockingErrors(): boolean {
    return this.resultsManager.hasBlockingErrors();
  }

  // Private methods

  /**
   * Efficiently determine which rows need validation based on changes
   */
  private getRowsNeedingValidation(coreData: GridRowCore[], changedRowIds: Set<string>): GridRowCore[] {
    const toValidate = new Set<string>(changedRowIds);

    // Add structural dependencies (parent-child relationships)
    for (const rowId of changedRowIds) {
      const row = coreData.find(r => r.id === rowId);
      if (row?.rowType === 'main') {
        // If main row changed, validate its children too
        coreData.filter(r => r.parentProductId === rowId)
               .forEach(child => toValidate.add(child.id));
      }
    }

    return coreData.filter(row => toValidate.has(row.id));
  }

  /**
   * Clear validation results for specific rows
   */
  private clearValidationResults(rowIds: string[]): void {
    for (const rowId of rowIds) {
      this.resultsManager.clearRowResults(rowId);
    }
  }



  /**
   * Assign assembly groups to sub-items based on their parents
   */
  private async assignAssemblyGroups(coreData: GridRowCore[]): Promise<void> {
    try {
      // Get assembly assignments for all rows
      const assignments = this.assemblyAssigner.assignAssemblyGroups(coreData);

      // Validate assignment consistency
      const assignmentErrors = this.assemblyAssigner.validateAssignments(assignments);

      // Store assignment errors as errors (no warnings allowed)
      for (const error of assignmentErrors) {
        this.resultsManager.setCellError(error.rowId, 'assembly', {
          message: error.message,
          expectedFormat: 'Assembly group assignment',
          value: error.errorType
        });
      }

      // Log assembly group summary for debugging
      const groupSummary = this.assemblyAssigner.getAssemblyGroupSummary(assignments);
      if (groupSummary.length > 0) {
        console.log('Assembly groups assigned:', groupSummary);
      }

    } catch (error) {
      console.error('Assembly assignment error:', error);
      // Don't fail validation if assembly assignment fails
    }
  }

  /**
   * Get assembly assignments for UI integration
   */
  getAssemblyAssignments(coreData: GridRowCore[]) {
    return this.assemblyAssigner.assignAssemblyGroups(coreData);
  }

  /**
   * PHASE 1: Calculate derived values from basic fields
   */
  private async calculateDerivedValues(
    rows: GridRowCore[],
    customerPreferences?: any
  ): Promise<Map<string, any>> {
    const calculatedValues = new Map<string, any>();

    for (const row of rows) {
      const rowCalculations: any = {};

      // Calculate LED count for Channel Letters
      if (row.productTypeId === 1) { // Channel Letters
        rowCalculations.ledCount = this.calculateLedCount(row, customerPreferences);
        rowCalculations.totalInches = this.calculateTotalInches(row);
        rowCalculations.totalWattage = this.calculateTotalWattage(rowCalculations.ledCount);
        rowCalculations.psCount = this.calculatePsCount(rowCalculations.ledCount, rowCalculations.totalWattage);
      }

      calculatedValues.set(row.id, rowCalculations);
    }

    return calculatedValues;
  }

  /**
   * Build validation context for a row
   */
  private buildValidationContext(
    allRows: GridRowCore[],
    customerPreferences?: any,
    calculatedValues?: Map<string, any>
  ): Map<string, ValidationContext> {
    const contexts = new Map<string, ValidationContext>();

    // Build grid-wide context
    const gridContext = {
      hasAnyUL: this.hasAnyUL(allRows),
      totalWattage: this.getTotalWattage(allRows, calculatedValues),
      rowCount: allRows.length
    };

    for (const row of allRows) {
      const rowCalculations = calculatedValues?.get(row.id) || {};

      const context: ValidationContext = {
        rowData: row.data,
        customerPreferences: customerPreferences || {
          use_leds: false,
          default_led_type: 'Standard LED',
          requires_transformers: false,
          default_transformer: 'DC-60W',
          default_ul_requirement: false
        },
        gridContext,
        calculatedValues: rowCalculations
      };

      contexts.set(row.id, context);
    }

    return contexts;
  }

  /**
   * Calculate LED count for a row
   */
  private calculateLedCount(row: GridRowCore, customerPreferences?: any): number {
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
  private parseLedsFromChannelData(data: string): number {
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
  private calculateTotalInches(row: GridRowCore): number {
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
  private calculateTotalWattage(ledCount: number): number {
    return ledCount * 1.2; // Assume 1.2W per LED
  }

  /**
   * Calculate power supply count from LED wattage
   */
  private calculatePsCount(ledCount: number, totalWattage: number): number {
    if (ledCount === 0) return 0;
    return Math.ceil(totalWattage / 60); // Assume 60W per PS
  }

  /**
   * Check if any row has UL requirement
   */
  private hasAnyUL(rows: GridRowCore[]): boolean {
    return rows.some(row => {
      const ulField = row.data.field4?.trim()?.toLowerCase();
      return ulField === 'yes' || (ulField && ulField !== 'no');
    });
  }

  /**
   * Get total wattage across all rows
   */
  private getTotalWattage(rows: GridRowCore[], calculatedValues?: Map<string, any>): number {
    let total = 0;
    for (const row of rows) {
      const calculations = calculatedValues?.get(row.id);
      if (calculations?.totalWattage) {
        total += calculations.totalWattage;
      }
    }
    return total;
  }

  /**
   * Update validation methods to accept context
   */
  private async validateCells(rows: GridRowCore[], contexts?: Map<string, ValidationContext>): Promise<void> {
    const validationPromises: Promise<void>[] = [];

    for (const row of rows) {
      const context = contexts?.get(row.id);
      const productValidation = this.config.productValidations.get(row.productTypeId || 0);

      if (productValidation && Object.keys(productValidation).length > 0) {
        // DEBUG: Log that we found validation rules for this product
        console.log(`Validating product ${row.productTypeId} with ${Object.keys(productValidation).length} rules:`, Object.keys(productValidation));

        for (const [fieldName, validationConfig] of Object.entries(productValidation)) {
          const fieldValue = row.data[fieldName];

          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
            validationPromises.push(
              this.cellValidator.validateCell(fieldName, fieldValue, validationConfig, context)
                .then(result => {
                  if (!result.isValid) {
                    this.resultsManager.setCellError(row.id, fieldName, {
                      message: result.error || 'Validation failed',
                      expectedFormat: result.expectedFormat || '',
                      value: fieldValue
                    });
                  } else if (result.warnings && result.warnings.length > 0) {
                    // Convert all warnings to errors - no warnings allowed
                    this.resultsManager.setCellError(row.id, fieldName, {
                      message: result.warnings[0],
                      expectedFormat: result.expectedFormat || '',
                      value: fieldValue
                    });
                  }
                })
            );
          }
        }
      } else {
        // DEBUG: Log that we didn't find validation rules
        console.log(`No validation rules found for product ${row.productTypeId}`);
        console.log('Available product validations:', Array.from(this.config.productValidations.keys()));
        // Check for missing product selection (structural validation)
        if (!row.productTypeId || row.productTypeId === 0) {
          this.resultsManager.setStructureError(row.id, {
            message: 'Product type must be selected',
            rule: 'product_selection'
          });
        }

        // VALIDATION WALL: All products except Channel Letters (ID 1) are blocked from field1-10 input
        // Channel Letters is the only product currently implemented
        for (const [fieldName, fieldValue] of Object.entries(row.data)) {
          if (fieldValue && fieldValue !== '') {
            // Strict validation for quantity field - only accept integers (positive, negative, or zero)
            if (fieldName === 'quantity') {
              // Regex: optional minus, then digits (0 or positive integer)
              const isValidInteger = /^-?\d+$/.test(fieldValue);
              if (!isValidInteger) {
                this.resultsManager.setCellError(row.id, fieldName, {
                  message: 'Quantity must be a whole number',
                  expectedFormat: 'Enter a whole number (e.g., 5, -2, 0)',
                  value: fieldValue
                });
              }
              // Valid quantity - no error
            } else if (/^field([1-9]|10)$/.test(fieldName)) {
              // VALIDATION WALL: Block all field1-10 input for non-Channel Letters products
              this.resultsManager.setCellError(row.id, fieldName, {
                message: 'This product type is not yet implemented',
                expectedFormat: 'Only Channel Letters are currently supported',
                value: fieldValue
              });
            }
            // Skip system fields: itemName, unitPrice, extendedPrice, customerDescription, internalNotes
          }
        }
      }
    }

    await Promise.all(validationPromises);
  }

  /**
   * Update row validation to accept context
   */
  private async validateRows(rows: GridRowCore[], contexts?: Map<string, ValidationContext>): Promise<void> {
    for (const row of rows) {
      const context = contexts?.get(row.id);
      const rowResult = await this.rowValidator.validateRow(row, context);

      if (!rowResult.isValid) {
        for (const fieldName of rowResult.incompleteFields || []) {
          this.resultsManager.setCellError(row.id, fieldName, {
            message: 'Required field missing',
            expectedFormat: 'This field is required for complete pricing',
            value: row.data[fieldName] || ''
          });
        }
      }
    }
  }

  /**
   * Update structure validation to accept context
   */
  private async validateStructure(coreData: GridRowCore[], contexts?: Map<string, ValidationContext>): Promise<void> {
    try {
      await this.structureValidator.validateStructure(coreData, contexts);
    } catch (error) {
      console.error('Structure validation error:', error);
    }
  }
}