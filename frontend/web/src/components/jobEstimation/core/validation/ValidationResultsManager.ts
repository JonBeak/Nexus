// Manages validation results with efficient lookups
// No React state - just simple Maps for fast access

export interface CellValidationError {
  message: string;
  expectedFormat?: string;
  value: string;
}

export interface StructureValidationError {
  message: string;
  rule: string;
}

export interface RowMetadata {
  displayNumber: string;           // "1", "1.a", "2"
  rowType: 'main' | 'subItem' | 'continuation';
  productTypeId: number;
  productTypeName: string;
  parentId?: string;
  childIds: string[];
}

export class ValidationResultsManager {
  private cellErrors = new Map<string, CellValidationError>(); // rowId.fieldName -> error
  private structureErrors = new Map<string, StructureValidationError>(); // rowId -> structure error
  private hasBlockingErrorsFlag = false;
  private lastValidatedAt = new Date();

  // NEW: Store parsed values for pricing calculation layer
  private parsedValues = new Map<string, unknown>(); // rowId.fieldName -> parsed value

  // NEW: Store calculated values for pricing calculation layer
  private calculatedValues = new Map<string, Record<string, unknown>>(); // rowId -> calculated values

  // NEW: Store row metadata for pricing calculation layer
  private rowMetadata = new Map<string, RowMetadata>(); // rowId -> metadata

  /**
   * Set a cell validation error
   */
  setCellError(rowId: string, fieldName: string, error: CellValidationError): void {
    const key = `${rowId}.${fieldName}`;
    this.cellErrors.set(key, error);
  }

  /**
   * Set a structure validation error
   */
  setStructureError(rowId: string, error: StructureValidationError): void {
    this.structureErrors.set(rowId, error);
  }

  /**
   * Get cell validation error
   */
  getCellError(rowId: string, fieldName: string): CellValidationError | undefined {
    const key = `${rowId}.${fieldName}`;
    return this.cellErrors.get(key);
  }

  /**
   * Get structure validation error for a row
   */
  getStructureError(rowId: string): StructureValidationError | undefined {
    return this.structureErrors.get(rowId);
  }

  /**
   * Check if there are any blocking errors
   */
  hasBlockingErrors(): boolean {
    return this.hasBlockingErrorsFlag;
  }

  /**
   * Update blocking status based on current errors
   */
  updateBlockingStatus(): void {
    // Any cell error or structure error blocks calculations
    this.hasBlockingErrorsFlag = this.cellErrors.size > 0 || this.structureErrors.size > 0;

    // Validation errors are tracked internally - UI components can query for display
  }

  /**
   * Clear all validation results for a specific row
   */
  clearRowResults(rowId: string): void {
    // Clear cell errors for this row
    const keysToDelete: string[] = [];
    for (const key of this.cellErrors.keys()) {
      if (key.startsWith(`${rowId}.`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cellErrors.delete(key);
    }

    // Clear structure errors for this row
    this.structureErrors.delete(rowId);

    // Clear parsed values for this row
    this.clearRowParsedValues(rowId);

    // Clear row metadata
    this.rowMetadata.delete(rowId);
  }

  /**
   * Clear all validation results
   */
  clearAllResults(): void {
    this.cellErrors.clear();
    this.structureErrors.clear();
    this.parsedValues.clear();
    this.calculatedValues.clear();
    this.rowMetadata.clear();
    this.hasBlockingErrorsFlag = false;
  }

  /**
   * Get validation summary for debugging
   */
  getValidationSummary(): {
    cellErrorCount: number;
    structureErrorCount: number;
    hasBlockingErrors: boolean;
    lastValidatedAt: Date;
  } {
    return {
      cellErrorCount: this.cellErrors.size,
      structureErrorCount: this.structureErrors.size,
      hasBlockingErrors: this.hasBlockingErrorsFlag,
      lastValidatedAt: this.lastValidatedAt
    };
  }

  /**
   * Get all errors for a specific row (for UI display)
   */
  getRowErrors(rowId: string): {
    cellErrors: Map<string, CellValidationError>;
    structureError?: StructureValidationError;
  } {
    const cellErrors = new Map<string, CellValidationError>();

    // Collect cell errors for this row
    for (const [key, error] of this.cellErrors.entries()) {
      if (key.startsWith(`${rowId}.`)) {
        const fieldName = key.substring(rowId.length + 1);
        cellErrors.set(fieldName, error);
      }
    }

    return {
      cellErrors,
      structureError: this.structureErrors.get(rowId)
    };
  }

  /**
   * Check if a specific cell has any validation issues
   */
  hasCellIssues(rowId: string, fieldName: string): boolean {
    const key = `${rowId}.${fieldName}`;
    return this.cellErrors.has(key);
  }

  /**
   * Get cell validation state for UI styling
   */
  getCellValidationState(rowId: string, fieldName: string): 'error' | 'valid' {
    const key = `${rowId}.${fieldName}`;
    if (this.cellErrors.has(key)) return 'error';
    return 'valid';
  }

  /**
   * Update last validated timestamp
   */
  markValidated(): void {
    this.lastValidatedAt = new Date();
  }

  // NEW: Parsed value management methods

  /**
   * Set a parsed value from validation
   */
  setParsedValue(rowId: string, fieldName: string, value: unknown): void {
    const key = `${rowId}.${fieldName}`;
    this.parsedValues.set(key, value);
  }

  /**
   * Get a parsed value
   */
  getParsedValue(rowId: string, fieldName: string): unknown {
    const key = `${rowId}.${fieldName}`;
    return this.parsedValues.get(key);
  }

  /**
   * Get all parsed values for a row (for pricing calculation)
   */
  getAllParsedValues(rowId: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.parsedValues) {
      if (key.startsWith(`${rowId}.`)) {
        const fieldName = key.substring(rowId.length + 1);
        result[fieldName] = value;
      }
    }
    return result;
  }

  /**
   * Clear parsed values for a specific row
   */
  private clearRowParsedValues(rowId: string): void {
    // Clear parsed values for this row
    const parsedKeysToDelete: string[] = [];
    for (const key of this.parsedValues.keys()) {
      if (key.startsWith(`${rowId}.`)) {
        parsedKeysToDelete.push(key);
      }
    }
    for (const key of parsedKeysToDelete) {
      this.parsedValues.delete(key);
    }
  }

  /**
   * Set calculated values for a row (from validation layer)
   */
  setCalculatedValues(rowId: string, values: Record<string, unknown>): void {
    this.calculatedValues.set(rowId, values);
  }

  /**
   * Get calculated values for a row (for pricing calculation)
   */
  getCalculatedValues(rowId: string): Record<string, unknown> {
    return this.calculatedValues.get(rowId) || {};
  }

  /**
   * Get all validated row IDs (for pricing calculation)
   */
  getValidatedRowIds(): string[] {
    const rowIds = new Set<string>();

    // Extract row IDs from parsed values
    for (const key of this.parsedValues.keys()) {
      const rowId = key.split('.')[0];
      rowIds.add(rowId);
    }

    // Extract row IDs from calculated values
    for (const rowId of this.calculatedValues.keys()) {
      rowIds.add(rowId);
    }

    return Array.from(rowIds);
  }

  // NEW: Row metadata management methods

  /**
   * Set row metadata for pricing calculation layer
   */
  setRowMetadata(rowId: string, metadata: RowMetadata): void {
    this.rowMetadata.set(rowId, metadata);
  }

  /**
   * Get row metadata for a specific row
   */
  getRowMetadata(rowId: string): RowMetadata | undefined {
    return this.rowMetadata.get(rowId);
  }

  /**
   * Get all row metadata (for pricing calculation)
   */
  getAllRowMetadata(): Map<string, RowMetadata> {
    return new Map(this.rowMetadata);
  }
}