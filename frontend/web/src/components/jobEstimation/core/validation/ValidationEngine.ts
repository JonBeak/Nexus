// Main validation engine - called after autosave debounce
// Handles incremental validation and result management

import { GridRowCore } from '../types/CoreTypes';
import { GridRow } from '../types/LayerTypes';
import { ValidationTemplateRegistry } from './templates/ValidationTemplateRegistry';
import { ValidationResultsManager } from './ValidationResultsManager';
import { StructureValidator } from './validators/StructureValidator';
import { CellValidator } from './validators/CellValidator';
import { RowValidator } from './validators/RowValidator';
import { AssemblyAssigner } from './AssemblyAssigner';
import { ValidationContext } from './templates/ValidationTemplate';
import { CustomerManufacturingPreferences } from './context/useCustomerPreferences';
import { ValidationContextBuilder } from './context/ValidationContextBuilder';

export interface ValidationEngineConfig {
  productValidations: Map<number, Record<string, FieldValidationConfig>>; // Cached product validation configs
  customerPreferences?: CustomerManufacturingPreferences; // Customer manufacturing preferences
}

export interface FieldValidationConfig {
  function: string; // Template name (e.g., 'textsplit')
  params: Record<string, unknown>; // Template-specific parameters
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
   * @param displayRows - Optional: display rows with metadata for pricing calculation
   */
  async validateGrid(
    coreData: GridRowCore[],
    changedRowIds?: Set<string>,
    customerPreferences?: CustomerManufacturingPreferences,
    displayRows?: GridRow[]
  ): Promise<void> {
    const effectiveCustomerPreferences = customerPreferences ?? this.config.customerPreferences;
    const startTime = performance.now();

    try {
      // FULL REVALIDATION: Always validate all rows for simplicity and accuracy
      const rowsToValidate = coreData;

      console.log(`Validating ${rowsToValidate.length} rows`);

      // Clear ALL validation results before re-validating
      this.resultsManager.clearAllResults();

      // Store row metadata for pricing calculation layer (if display rows provided)
      if (displayRows) {
        for (const row of displayRows) {
          this.resultsManager.setRowMetadata(row.id, {
            displayNumber: row.displayNumber,
            rowType: row.rowType,
            productTypeId: row.productTypeId,
            productTypeName: row.productTypeName,
            parentId: row.parentId,
            childIds: row.childIds
          });
        }
      }

      // TWO-PHASE VALIDATION:

      // PHASE 1: Calculate derived values from basic fields
      const calculatedValues = ValidationContextBuilder.calculateDerivedValues(
        rowsToValidate,
        effectiveCustomerPreferences
      );

      // Store calculated values in ValidationResultsManager
      for (const [rowId, values] of calculatedValues.entries()) {
        this.resultsManager.setCalculatedValues(rowId, values);
      }

      // PHASE 2: Context-aware validation with calculated values
      const validationContext = ValidationContextBuilder.buildContextsMap(
        coreData,
        effectiveCustomerPreferences,
        calculatedValues
      );

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

  setCustomerPreferences(preferences?: CustomerManufacturingPreferences): void {
    this.config.customerPreferences = preferences;
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
   * Update validation methods to accept context
   */
  private async validateCells(rows: GridRowCore[], contexts?: Map<string, ValidationContext>): Promise<void> {
    const validationPromises: Promise<void>[] = [];

    for (const row of rows) {
      const context = contexts?.get(row.id);
      const productValidation = this.config.productValidations.get(row.productTypeId || 0);

      if (productValidation && Object.keys(productValidation).length > 0) {
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
                  } else {
                    // Validation passed - store parsed value for pricing calculation layer
                    if (result.parsedValue !== undefined) {
                      this.resultsManager.setParsedValue(row.id, fieldName, result.parsedValue);
                    }
                  }
                })
            );
          }
        }
      } else {
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
