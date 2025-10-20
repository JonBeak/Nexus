// Main validation engine - called after autosave debounce
// Handles incremental validation and result management

import { GridRowCore, ProductTypeConfig } from '../types/CoreTypes';
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
import { channelLettersValidation, vinylValidation, substrateCutValidation, backerValidation, pushThruValidation, bladeSignValidation, ledNeonValidation, paintingValidation, customValidation, wiringValidation, materialCutValidation, ulValidation, shippingValidation, ledValidation, emptyRowValidation, dividerValidation, subtotalValidation, multiplierValidation, discountFeeValidation } from './productValidationConfigs';

export interface ValidationEngineConfig {
  customerPreferences?: CustomerManufacturingPreferences; // Customer manufacturing preferences
  productTypes?: ProductTypeConfig[]; // Product type configurations for structure validation
}

export interface FieldValidationConfig {
  function: string; // Template name (e.g., 'textsplit')
  params: Record<string, unknown>; // Template-specific parameters
  error_level: 'error';
  error_message?: string;
  depends_on?: string[]; // Field dependencies
  depends_on_calculated?: string[]; // Dependencies on calculated values
  products_affected?: string[]; // Products this field affects
  complimentary_fields?: number[]; // If any of these fields (1-10) are filled, this field is required
  supplementary_to?: number[]; // This field requires all of these fields (1-10) to be filled
}

export class ValidationEngine {
  private templateRegistry: ValidationTemplateRegistry;
  private resultsManager: ValidationResultsManager;
  private structureValidator: StructureValidator;
  private cellValidator: CellValidator;
  private rowValidator: RowValidator;
  private assemblyAssigner: AssemblyAssigner;
  private config: ValidationEngineConfig;
  private productValidations: Map<number, Record<string, FieldValidationConfig>>;

  constructor(config: ValidationEngineConfig) {
    this.config = config;
    this.templateRegistry = new ValidationTemplateRegistry();
    this.resultsManager = new ValidationResultsManager();
    this.structureValidator = new StructureValidator();

    // Initialize product validation rules
    this.productValidations = this.getProductValidations();

    this.cellValidator = new CellValidator(this.templateRegistry, this.productValidations);
    this.rowValidator = new RowValidator(this.productValidations);
    this.assemblyAssigner = new AssemblyAssigner();
  }

  /**
   * Get validation configurations for all product types
   */
  private getProductValidations(): Map<number, Record<string, FieldValidationConfig>> {
    const validations = new Map<number, Record<string, FieldValidationConfig>>();

    // Add validation rules for each product type
    // Use switch for clarity and easy expansion
    const productTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28]; // Add more product type IDs as needed

    for (const productType of productTypes) {
      switch (productType) {
        case 1: // Channel Letters
          validations.set(1, channelLettersValidation);
          break;
        case 2: // Vinyl
          validations.set(2, vinylValidation);
          break;
        case 3: // Substrate Cut
          validations.set(3, substrateCutValidation);
          break;
        case 4: // Backer
          validations.set(4, backerValidation);
          break;
        case 5: // Push Thru
          validations.set(5, pushThruValidation);
          break;
        case 6: // Blade Sign
          validations.set(6, bladeSignValidation);
          break;
        case 7: // LED Neon
          validations.set(7, ledNeonValidation);
          break;
        case 8: // Painting
          validations.set(8, paintingValidation);
          break;
        case 9: // Custom
          validations.set(9, customValidation);
          break;
        case 10: // Wiring
          validations.set(10, wiringValidation);
          break;
        case 11: // Material Cut
          validations.set(11, materialCutValidation);
          break;
        case 12: // UL
          validations.set(12, ulValidation);
          break;
        case 13: // Shipping
          validations.set(13, shippingValidation);
          break;
        case 16: // ↳ Vinyl (sub-item) - uses same validation as main Vinyl
          validations.set(16, vinylValidation);
          break;
        case 17: // ↳ Painting (sub-item) - uses same validation as main Painting
          validations.set(17, paintingValidation);
          break;
        case 18: // ↳ LED (sub-item) - uses same validation as main LED
          validations.set(18, ledValidation);
          break;
        case 19: // ↳ Wiring (sub-item) - uses same validation as main Wiring
          validations.set(19, wiringValidation);
          break;
        case 20: // ↳ Material Cut (sub-item) - uses same validation as main Material Cut
          validations.set(20, materialCutValidation);
          break;
        case 26: // LED
          validations.set(26, ledValidation);
          break;
        case 28: // ↳ Substrate Cut (sub-item) - uses same validation as main Substrate Cut
          validations.set(28, substrateCutValidation);
          break;

        // Special Items
        case 21: // Subtotal
          validations.set(21, subtotalValidation);
          break;
        case 22: // Discount/Fee
          validations.set(22, discountFeeValidation);
          break;
        case 23: // Multiplier
          validations.set(23, multiplierValidation);
          break;
        case 25: // Divider
          validations.set(25, dividerValidation);
          break;
        case 27: // Empty Row
          validations.set(27, emptyRowValidation);
          break;

        default:
          // No validation rules for this product type
          break;
      }
    }

    return validations;
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

      // Validating rows for business rules and field validation

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

      // 2. Structure validation (business rules, assembly logic) - always validate full grid
      await this.validateStructure(coreData, validationContext);

      // 3. Assembly assignment (after validation completes)
      await this.assignAssemblyGroups(coreData);

      // 4. Update global blocking status
      this.resultsManager.updateBlockingStatus();

      // Validation completed
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

      // Assembly groups assigned successfully

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
      const productValidation = this.productValidations.get(row.productTypeId || 0);

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

        // Check dependency requirements for all fields (including empty ones)
        for (const [fieldName, validationConfig] of Object.entries(productValidation)) {
          const fieldValue = row.data[fieldName] || '';
          const isFieldFilled = fieldValue.trim() !== '';

          // Check complimentary_fields: If any complimentary field is filled, this field is required
          if (validationConfig.complimentary_fields && validationConfig.complimentary_fields.length > 0) {
            const filledComplimentaryFields = validationConfig.complimentary_fields.filter(fieldNum =>
              row.data[`field${fieldNum}`]?.trim() !== ''
            );

            if (filledComplimentaryFields.length > 0 && !isFieldFilled) {
              const fieldLabels = filledComplimentaryFields.map(num => `field${num}`).join(', ');
              this.resultsManager.setCellError(row.id, fieldName, {
                message: `Required when ${fieldLabels} filled`,
                expectedFormat: 'This field must be filled',
                value: fieldValue
              });
            }
          }

          // Check supplementary_to: If this field is filled, all supplementary_to fields must be filled
          if (validationConfig.supplementary_to && validationConfig.supplementary_to.length > 0 && isFieldFilled) {
            const emptyRequiredFields = validationConfig.supplementary_to.filter(fieldNum =>
              !row.data[`field${fieldNum}`] || row.data[`field${fieldNum}`].trim() === ''
            );

            if (emptyRequiredFields.length > 0) {
              const fieldLabels = emptyRequiredFields.map(num => `field${num}`).join(', ');
              this.resultsManager.setCellError(row.id, fieldName, {
                message: `Requires ${fieldLabels} to be filled`,
                expectedFormat: 'Fill required fields first',
                value: fieldValue
              });
            }
          }
        }

        // Check for missing product selection (structural validation)
        // Allow productTypeId: 0 ("Select Type") - it's a placeholder that doesn't affect calculations
        if (!row.productTypeId && row.productTypeId !== 0) {
          this.resultsManager.setStructureError(row.id, {
            message: 'Product type must be selected',
            rule: 'product_selection'
          });
        }

      }

      // VALIDATION WALL: Block products without validation implementations
      // Allow productTypeId: 0 ("Select Type") to pass through - it won't be calculated anyway
      // Currently implemented: Channel Letters (ID 1), Vinyl (ID 2), Substrate Cut (ID 3), Backer (ID 4), Push Thru (ID 5), Blade Sign (ID 6), LED Neon (ID 7), Painting (ID 8), Custom (ID 9), Wiring (ID 10), Material Cut (ID 11), UL (ID 12), Shipping (ID 13), ↳ Vinyl (ID 16), ↳ Painting (ID 17), ↳ LED (ID 18), ↳ Wiring (ID 19), ↳ Material Cut (ID 20), Subtotal (ID 21), Discount/Fee (ID 22), Multiplier (ID 23), Divider (ID 25), LED (ID 26), Empty Row (ID 27), ↳ Substrate Cut (ID 28)
      // This applies to both main products and sub-items
      const implementedProducts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28]; // Select Type, Channel Letters, Vinyl, Substrate Cut, Backer, Push Thru, Blade Sign, LED Neon, Painting, Custom, Wiring, Material Cut, UL, Shipping, ↳ Vinyl, ↳ Painting, ↳ LED, ↳ Wiring, ↳ Material Cut, Subtotal, Discount/Fee, Multiplier, Divider, LED, Empty Row, ↳ Substrate Cut
      if (!implementedProducts.includes(row.productTypeId)) {
        for (const [fieldName, fieldValue] of Object.entries(row.data)) {
          if (fieldValue && fieldValue !== '') {
            if (/^field([1-9]|10)$/.test(fieldName)) {
              // VALIDATION WALL: Block all field1-10 input for non-implemented products
              this.resultsManager.setCellError(row.id, fieldName, {
                message: 'This product type is not yet implemented',
                expectedFormat: 'Currently supported: Channel Letters, Vinyl, Substrate Cut, Backer, Push Thru, Blade Sign, LED Neon, Painting, Custom, Wiring, Shipping',
                value: fieldValue
              });
            }
            // Skip system fields: itemName, unitPrice, extendedPrice, customerDescription, internalNotes
          }
        }
      }

      // QUANTITY VALIDATION: Run for ALL products except special items that don't need quantity
      const specialItemsWithoutQuantity = [0, 21, 22, 23, 25, 27]; // Select Type, Subtotal, Discount/Fee, Multiplier, Divider, Empty Row
      const needsQuantity = !specialItemsWithoutQuantity.includes(row.productTypeId);

      if (needsQuantity) {
        const quantityValue = row.data.quantity;
        if (!quantityValue || quantityValue.trim() === '') {
          // Empty quantity is invalid - every row needs a quantity
          this.resultsManager.setCellError(row.id, 'quantity', {
            message: 'Quantity is required',
            expectedFormat: 'Enter a number (e.g., 1, 2.5, 0)',
            value: quantityValue || ''
          });
        } else {
          // Strict validation for quantity field - accept floats but no scientific notation
          const cleanQuantity = quantityValue.trim();
          const isValidNumber = /^-?\d+(\.\d+)?$/.test(cleanQuantity);
          if (!isValidNumber) {
            this.resultsManager.setCellError(row.id, 'quantity', {
              message: 'Quantity must be a valid number',
              expectedFormat: 'Enter a number (e.g., 1, 2.5, -1, 0)',
              value: quantityValue
            });
          } else {
            // Set the parsed quantity value if validation passes
            this.resultsManager.setParsedValue(row.id, 'quantity', cleanQuantity);
          }
        }
      }
    }

    await Promise.all(validationPromises);
  }

  /**
   * Update structure validation to accept context
   */
  private async validateStructure(coreData: GridRowCore[], contexts?: Map<string, ValidationContext>): Promise<void> {
    try {
      const structureResults = await this.structureValidator.validateStructure(
        coreData,
        this.config.productTypes
      );

      // Store structure validation results in ValidationResultsManager
      for (const result of structureResults) {
        this.resultsManager.setStructureError(result.rowId, {
          message: result.error,
          rule: result.rule
        });
      }
    } catch (error) {
      console.error('Structure validation error:', error);
    }
  }
}
