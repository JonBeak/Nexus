import { useCallback, useEffect, useMemo } from 'react';
import { EstimateRow } from '../types';
import { GridState } from './useSimpleGridState';
import { UnifiedAssemblySystem } from '../systems/UnifiedAssemblySystem';
import { useDragDropContext } from '../managers/DragDropManager';

export interface GridValidation {
  validateField: (field: any, value: any) => string[];
  validateRow: (row: EstimateRow) => Record<string, string[]>;
  validateAllRows: () => void;
  validateSingleFieldOnBlur: (rowIndex: number, fieldName: string, value: any) => void; // ✅ BLUR-ONLY
}

export const useGridValidation = (
  gridState: GridState,
  onValidationChange?: (hasErrors: boolean, errorCount: number) => void
): GridValidation => {
  const dragContext = useDragDropContext();
  
  // ✅ PHASE 2C: Create O(n) assembly validator instance
  const unifiedSystem = useMemo(() => new UnifiedAssemblySystem(gridState.rows, () => {}, () => {}), [gridState.rows]);

  const validateField = useCallback((field: any, value: any): string[] => {
    const errors: string[] = [];
    
    // Required field validation
    if (field.required && (!value || value === '')) {
      errors.push(`${field.label} is required`);
    }
    
    // Skip other validations if field is empty and not required
    if (!value || value === '') {
      return errors;
    }
    
    // Number validation - comprehensive validation for number fields
    if (field.type === 'number') {
      const stringValue = String(value).trim();
      
      // Reject e-notation (scientific notation)
      if (stringValue.toLowerCase().includes('e')) {
        errors.push(`${field.label} cannot use scientific notation (e.g., 1e5)`);
      } 
      // Check for any non-numeric characters (except decimal point and negative sign)
      else if (stringValue !== '' && !/^-?\d*\.?\d*$/.test(stringValue)) {
        errors.push(`${field.label} must contain only numbers`);
      } 
      // Standard number validation
      else {
        const num = parseFloat(stringValue);
        if (isNaN(num) && stringValue !== '') {
          errors.push(`${field.label} must be a valid number`);
        } else if (!isNaN(num)) {
          if (field.validation?.min !== undefined && num < field.validation.min) {
            errors.push(`${field.label} must be at least ${field.validation.min}`);
          }
          if (field.validation?.max !== undefined && num > field.validation.max) {
            errors.push(`${field.label} must be at most ${field.validation.max}`);
          }
          // Special validation for quantity field - must be positive integer
          if (field.name === 'quantity' && (num <= 0 || !Number.isInteger(num))) {
            errors.push(`${field.label} must be a positive whole number`);
          }
        }
      }
    }
    
    // Text length validation
    if (field.type === 'text' && field.validation?.maxLength) {
      if (String(value).length > field.validation.maxLength) {
        errors.push(`${field.label} must be at most ${field.validation.maxLength} characters`);
      }
    }
    
    // Select field validation - check if value exists in options
    if (field.type === 'select' && field.options) {
      const validValues = Array.isArray(field.options) 
        ? field.options.map(opt => typeof opt === 'string' ? opt : opt.value)
        : [];
      
      if (validValues.length > 0 && !validValues.includes(String(value))) {
        errors.push(`${field.label} contains an invalid selection`);
      }
    }
    
    return errors;
  }, []);

  const validateRow = useCallback((row: EstimateRow): Record<string, string[]> => {
    // Validation system will be added later
    return {};
  }, []);

  const validateAllRows = useCallback(() => {
    const newErrors: Record<string, Record<string, string[]>> = {};
    
    gridState.rows.forEach(row => {
      const rowErrors = validateRow(row);
      if (Object.keys(rowErrors).length > 0) {
        newErrors[row.id] = rowErrors;
      }
    });
    
    // Debug: Log validation results
    if (Object.keys(newErrors).length > 0) {
      // Validation found errors in ${Object.keys(newErrors).length} rows
    }
    
    gridState.setValidationErrors(newErrors);
    
    // Notify parent of validation state changes
    const errorCount = Object.values(newErrors).reduce((total, rowErrors) => 
      total + Object.values(rowErrors).reduce((rowTotal, fieldErrors) => rowTotal + fieldErrors.length, 0), 0);
    
    if (onValidationChange) {
      onValidationChange(Object.keys(newErrors).length > 0, errorCount);
    }
  }, [gridState.rows, validateRow, gridState.setValidationErrors, onValidationChange]);

  // ✅ BLUR-ONLY: Remove automatic validation on row changes
  // Validation now only occurs:
  // 1. On explicit field blur events (via field renderers)
  // 2. On data loading completion 
  // 3. On drag operations completion
  useEffect(() => {
    // Skip validation entirely during drag operations for better drag performance
    if (dragContext.isDragCalculating) {
      return;
    }
    
    // Only validate when data is first loaded, not on every row change
    if (gridState.rows.length > 0 && gridState.loadedEstimateId !== null) {
      // Only run validation once after initial data load
      const hasInitialData = gridState.rows.some(row => row.productTypeId);
      if (hasInitialData) {
        // Validate once after data load
        const timeoutId = setTimeout(() => {
          validateAllRows();
        }, 50);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [
    // Only depend on data loading completion, not content changes
    gridState.loadedEstimateId,
    gridState.rows.length, // Only length matters for initial load
    validateAllRows,
    dragContext.isDragCalculating
  ]);

  // ✅ BLUR-ONLY: Validate a single field when user blurs
  const validateSingleFieldOnBlur = useCallback((rowIndex: number, fieldName: string, value: any) => {
    const row = gridState.rows[rowIndex];
    if (!row) return;
    
    // For now, just validate the whole row since fields are interconnected
    // This could be optimized further to validate only the specific field
    const rowErrors = validateRow(row);
    
    // Update validation errors for this row
    const newErrors = { ...gridState.validationErrors };
    if (Object.keys(rowErrors).length > 0) {
      newErrors[row.id] = rowErrors;
    } else {
      delete newErrors[row.id];
    }
    
    gridState.setValidationErrors(newErrors);
    
    // Notify parent of validation state changes
    const errorCount = Object.values(newErrors).reduce((total, rowErrors) => 
      total + Object.values(rowErrors).reduce((rowTotal, fieldErrors) => rowTotal + fieldErrors.length, 0), 0);
    
    if (onValidationChange) {
      onValidationChange(Object.keys(newErrors).length > 0, errorCount);
    }
  }, [gridState.rows, validateRow, gridState.setValidationErrors, onValidationChange]);

  return {
    validateField,
    validateRow,
    validateAllRows,
    validateSingleFieldOnBlur
  };
};