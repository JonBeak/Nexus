// Manages validation results with efficient lookups
// No React state - just simple Maps for fast access

export interface CellValidationError {
  message: string;
  expectedFormat?: string;
  value: string;
}

export interface CellValidationWarning {
  message: string;
  expectedFormat?: string;
  value: string;
}

export interface StructureValidationError {
  message: string;
  rule: string;
}

export class ValidationResultsManager {
  private cellErrors = new Map<string, CellValidationError>(); // rowId.fieldName -> error
  private cellWarnings = new Map<string, CellValidationWarning>(); // rowId.fieldName -> warning
  private structureErrors = new Map<string, StructureValidationError>(); // rowId -> structure error
  private hasBlockingErrorsFlag = false;
  private lastValidatedAt = new Date();

  /**
   * Set a cell validation error
   */
  setCellError(rowId: string, fieldName: string, error: CellValidationError): void {
    const key = `${rowId}.${fieldName}`;
    this.cellErrors.set(key, error);
  }

  /**
   * Set a cell validation warning
   */
  setCellWarning(rowId: string, fieldName: string, warning: CellValidationWarning): void {
    const key = `${rowId}.${fieldName}`;
    this.cellWarnings.set(key, warning);
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
   * Get cell validation warning
   */
  getCellWarning(rowId: string, fieldName: string): CellValidationWarning | undefined {
    const key = `${rowId}.${fieldName}`;
    return this.cellWarnings.get(key);
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
  }

  /**
   * Clear all validation results for a specific row
   */
  clearRowResults(rowId: string): void {
    // Clear cell errors and warnings for this row
    const keysToDelete: string[] = [];
    for (const key of this.cellErrors.keys()) {
      if (key.startsWith(`${rowId}.`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cellErrors.delete(key);
    }

    // Clear cell warnings for this row
    const warningKeysToDelete: string[] = [];
    for (const key of this.cellWarnings.keys()) {
      if (key.startsWith(`${rowId}.`)) {
        warningKeysToDelete.push(key);
      }
    }
    for (const key of warningKeysToDelete) {
      this.cellWarnings.delete(key);
    }

    // Clear structure errors for this row
    this.structureErrors.delete(rowId);
  }

  /**
   * Clear all validation results
   */
  clearAllResults(): void {
    this.cellErrors.clear();
    this.cellWarnings.clear();
    this.structureErrors.clear();
    this.hasBlockingErrorsFlag = false;
  }

  /**
   * Get validation summary for debugging
   */
  getValidationSummary(): {
    cellErrorCount: number;
    cellWarningCount: number;
    structureErrorCount: number;
    hasBlockingErrors: boolean;
    lastValidatedAt: Date;
  } {
    return {
      cellErrorCount: this.cellErrors.size,
      cellWarningCount: this.cellWarnings.size,
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
   * Get all warnings for a specific row (for UI display)
   */
  getRowWarnings(rowId: string): Map<string, CellValidationWarning> {
    const warnings = new Map<string, CellValidationWarning>();

    // Collect cell warnings for this row
    for (const [key, warning] of this.cellWarnings.entries()) {
      if (key.startsWith(`${rowId}.`)) {
        const fieldName = key.substring(rowId.length + 1);
        warnings.set(fieldName, warning);
      }
    }

    return warnings;
  }

  /**
   * Check if a specific cell has any validation issues
   */
  hasCellIssues(rowId: string, fieldName: string): boolean {
    const key = `${rowId}.${fieldName}`;
    return this.cellErrors.has(key) || this.cellWarnings.has(key);
  }

  /**
   * Get cell validation state for UI styling
   */
  getCellValidationState(rowId: string, fieldName: string): 'error' | 'warning' | 'valid' {
    const key = `${rowId}.${fieldName}`;
    if (this.cellErrors.has(key)) return 'error';
    if (this.cellWarnings.has(key)) return 'warning';
    return 'valid';
  }

  /**
   * Update last validated timestamp
   */
  markValidated(): void {
    this.lastValidatedAt = new Date();
  }
}