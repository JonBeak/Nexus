/**
 * Hook containing all grid action handlers
 *
 * Manages all user interactions: field editing, product selection,
 * row operations (insert/delete/duplicate/clear), bulk operations,
 * drag-drop, and manual save.
 */

import { useCallback } from 'react';
import { GridEngine } from '../core/GridEngine';
import { GridRow } from '../core/types/LayerTypes';
import { ProductType } from './useProductTypes';
import { jobVersioningApi } from '../../../services/jobVersioningApi';

interface UseGridActionsParams {
  displayRows: GridRow[];
  gridEngine: GridEngine;
  productTypes: ProductType[];
  fieldPromptsMap: Record<number, Record<string, string | boolean>>;
  versioningMode: boolean;
  estimateId: number | undefined;
  estimatePreviewData?: { total: number } | null;

  // Modal state setters
  setShowClearConfirmation: (show: boolean) => void;
  setClearModalType: (type: 'reset' | 'clearAll' | 'clearEmpty' | null) => void;
  setShowRowConfirmation: (show: boolean) => void;
  setRowConfirmationType: (type: 'clear' | 'delete' | null) => void;
  setPendingRowIndex: (index: number | null) => void;
  pendingRowIndex: number | null;
}

interface GridActionsReturn {
  handleFieldCommit: (rowIndex: number, fieldName: string, value: string) => void;
  handleProductTypeSelect: (rowIndex: number, productTypeId: number) => Promise<void>;
  handleInsertRow: (afterIndex: number) => void;
  handleDeleteRow: (rowIndex: number) => void;
  executeDeleteRow: () => void;
  handleDuplicateRow: (rowIndex: number) => void;
  handleClearRow: (rowIndex: number) => void;
  executeClearRow: () => void;
  handleDragEnd: (event: any) => void;
  handleReset: () => Promise<void>;
  handleClearAll: () => Promise<void>;
  handleClearEmpty: () => Promise<void>;
  handleAddSection: () => Promise<void>;
  handleManualSave: () => Promise<void>;
}

/**
 * Provides all grid action handlers.
 * Each handler preserves exact behavior and dependencies from original implementation.
 *
 * @param params - Grid actions configuration
 * @returns Object containing all action handlers
 */
export const useGridActions = ({
  displayRows,
  gridEngine,
  productTypes,
  fieldPromptsMap,
  versioningMode,
  estimateId,
  estimatePreviewData,
  setShowClearConfirmation,
  setClearModalType,
  setShowRowConfirmation,
  setRowConfirmationType,
  setPendingRowIndex,
  pendingRowIndex
}: UseGridActionsParams): GridActionsReturn => {

  // Event handlers using GridEngine methods
  const handleFieldCommit = useCallback((
    rowIndex: number,
    fieldName: string,
    value: string
  ) => {

    const row = displayRows[rowIndex];
    if (!row) {
      return;
    }

    gridEngine.updateSingleRow(row.id, { [fieldName]: value });
  }, [displayRows, gridEngine]);

  const handleProductTypeSelect = useCallback(async (
    rowIndex: number,
    productTypeId: number
  ) => {
    const row = displayRows[rowIndex];
    if (!row) return;

    // Get product type name from loaded productTypes
    const productType = productTypes.find(pt => pt.id === productTypeId);
    const productTypeName = productType?.name || `Product Type ${productTypeId}`;

    // Note: Field prompts are cached at the parent component level via useTemplateCache
    // No need to fetch here - they're already available in fieldPromptsMap

    // Clear all field data when changing product type
    const clearedFieldData = {
      field1: '', field2: '', field3: '', field4: '', field5: '', field6: '',
      field7: '', field8: '', field9: '', field10: ''
    };

    gridEngine.updateSingleRow(row.id, clearedFieldData);
    gridEngine.updateRowProductType(row.id, productTypeId, productTypeName);
  }, [displayRows, gridEngine, productTypes, fieldPromptsMap]);

  const handleInsertRow = useCallback((afterIndex: number) => {
    gridEngine.insertRow(afterIndex, 'main');
  }, [gridEngine]);

  const handleDeleteRow = useCallback((rowIndex: number) => {
    // Show confirmation dialog before deleting
    setPendingRowIndex(rowIndex);
    setRowConfirmationType('delete');
    setShowRowConfirmation(true);
  }, [setPendingRowIndex, setRowConfirmationType, setShowRowConfirmation]);

  const executeDeleteRow = useCallback(() => {
    if (pendingRowIndex === null) return;

    const row = displayRows[pendingRowIndex];
    if (!row) return;

    gridEngine.deleteRow(row.id);

    // Close the modal
    setShowRowConfirmation(false);
    setRowConfirmationType(null);
    setPendingRowIndex(null);
  }, [pendingRowIndex, displayRows, gridEngine, setShowRowConfirmation, setRowConfirmationType, setPendingRowIndex]);

  const handleDuplicateRow = useCallback((rowIndex: number) => {
    const row = displayRows[rowIndex];
    if (!row) return;

    gridEngine.duplicateRow(row.id);
  }, [displayRows, gridEngine]);

  const handleClearRow = useCallback((rowIndex: number) => {
    const row = displayRows[rowIndex];
    if (!row) return;

    // Check if the row is already clear - if so, do nothing
    // Only check EDITABLE fields, not all grid fields
    // IGNORE: product type selection and metadata fields
    const editableSet = new Set(row.editableFields || []);
    const updates: Record<string, string> = {};

    // Check quantity if it's editable
    if (editableSet.has('quantity') || editableSet.size === 0) {
      const currentQty = row.data?.quantity ?? '';
      // Consider both '1' and '' as acceptable "clear" states
      if (currentQty !== '1' && currentQty !== '') {
        updates.quantity = '1';
      }
    }

    // Determine which fields to check - exclude product-related and metadata fields
    const metadataFields = new Set([
      'quantity',
      'productTypeId',
      'productTypeName',
      'product',
      'item',
      'itemName',
      'unitPrice',
      'extendedPrice',
      'customerDescription',
      'internalNotes'
    ]);

    const fieldsToCheck = editableSet.size === 0
      ? ['field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7', 'field8', 'field9', 'field10']
      : Array.from(editableSet).filter(f => !metadataFields.has(f));

    // Check only editable fields for non-empty values
    fieldsToCheck.forEach(fieldName => {
      const currentValue = row.data?.[fieldName] ?? '';
      if (currentValue !== '') {
        updates[fieldName] = '';
      }
    });

    // If no updates needed, row is already clear - do nothing
    if (Object.keys(updates).length === 0) {
      return;
    }

    // Show confirmation dialog before clearing
    setPendingRowIndex(rowIndex);
    setRowConfirmationType('clear');
    setShowRowConfirmation(true);
  }, [displayRows, setPendingRowIndex, setRowConfirmationType, setShowRowConfirmation]);

  const executeClearRow = useCallback(() => {
    if (pendingRowIndex === null) return;

    const row = displayRows[pendingRowIndex];
    if (!row) return;

    const editableSet = new Set(row.editableFields || []);
    const baseFields = ['quantity', 'field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7', 'field8', 'field9', 'field10'];
    const existingFields = Object.keys(row.data || {});
    const fieldsToProcess = new Set([...baseFields, ...existingFields, ...editableSet]);

    const updates: Record<string, string> = {};

    fieldsToProcess.forEach((fieldName: string) => {
      const normalized = fieldName.toLowerCase();
      const isEditable = editableSet.size === 0 || editableSet.has(fieldName) || normalized === 'quantity';
      const isGridField = normalized === 'quantity' || normalized.startsWith('field');

      if (!isEditable && !isGridField) {
        return;
      }

      const currentValue = row.data?.[fieldName] ?? '';

      if (normalized === 'quantity') {
        if (currentValue !== '1') {
          updates[fieldName] = '1';
        }
        return;
      }

      const nextValue = '';
      if ((isGridField || editableSet.has(fieldName)) && currentValue !== nextValue) {
        updates[fieldName] = nextValue;
      }
    });

    if (Object.keys(updates).length === 0) {
      setShowRowConfirmation(false);
      setRowConfirmationType(null);
      setPendingRowIndex(null);
      return;
    }

    gridEngine.updateSingleRow(row.id, updates);

    // Close the modal
    setShowRowConfirmation(false);
    setRowConfirmationType(null);
    setPendingRowIndex(null);
  }, [pendingRowIndex, displayRows, gridEngine, setShowRowConfirmation, setRowConfirmationType, setPendingRowIndex]);

  // Drag and drop handling
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceRow = displayRows.find(r => r.id === active.id);
    if (!sourceRow) return;

    // Detect drag direction by comparing row indices
    const sourceIndex = displayRows.findIndex(r => r.id === active.id);
    const targetIndex = displayRows.findIndex(r => r.id === over.id);

    // Apply directional logic:
    // Moving up (higher index to lower) → drop above target
    // Moving down (lower index to higher) → drop below target
    const dropPosition = sourceIndex > targetIndex ? 'above' : 'below';

    gridEngine.moveRows(sourceRow.draggedRowIds, over.id, dropPosition);
  }, [displayRows, gridEngine]);

  // Simple button action callbacks to replace gridActions
  const handleReset = useCallback(async () => {
    setShowClearConfirmation(false);
    setClearModalType(null);

    if (versioningMode && estimateId) {
      try {
        await jobVersioningApi.resetEstimateItems(estimateId);
        await gridEngine.reloadFromBackend(estimateId, jobVersioningApi);
      } catch (error) {
        console.error('Reset failed:', error);
      }
    }
  }, [versioningMode, estimateId, gridEngine, setShowClearConfirmation, setClearModalType]);

  const handleClearAll = useCallback(async () => {
    setShowClearConfirmation(false);
    setClearModalType(null);

    if (versioningMode && estimateId) {
      try {
        await jobVersioningApi.clearAllEstimateItems(estimateId);
        await gridEngine.reloadFromBackend(estimateId, jobVersioningApi);
      } catch (error) {
        console.error('Clear all failed:', error);
      }
    }
  }, [versioningMode, estimateId, gridEngine, setShowClearConfirmation, setClearModalType]);

  const handleClearEmpty = useCallback(async () => {
    setShowClearConfirmation(false);
    setClearModalType(null);

    if (versioningMode && estimateId) {
      try {
        await jobVersioningApi.clearEmptyItems(estimateId);
        await gridEngine.reloadFromBackend(estimateId, jobVersioningApi);
      } catch (error) {
        console.error('Clear empty failed:', error);
      }
    }
  }, [versioningMode, estimateId, gridEngine, setShowClearConfirmation, setClearModalType]);

  const handleAddSection = useCallback(async () => {
    if (versioningMode && estimateId) {
      try {
        await jobVersioningApi.addTemplateSection(estimateId);
        await gridEngine.reloadFromBackend(estimateId, jobVersioningApi);
      } catch (error) {
        console.error('Add section failed:', error);
      }
    }
  }, [versioningMode, estimateId, gridEngine]);

  // Manual save
  const handleManualSave = useCallback(async () => {
    if (!estimateId) return;

    const coreData = gridEngine.getCoreData();

    try {
      // Convert to simplified structure - no IDs needed, but keep row types
      const simplifiedRows = coreData.map(row => ({
        rowType: row.rowType || 'main',
        productTypeId: row.productTypeId || null,
        productTypeName: row.productTypeName || null,
        qty: row.data?.quantity || '',
        field1: row.data?.field1 || '',
        field2: row.data?.field2 || '',
        field3: row.data?.field3 || '',
        field4: row.data?.field4 || '',
        field5: row.data?.field5 || '',
        field6: row.data?.field6 || '',
        field7: row.data?.field7 || '',
        field8: row.data?.field8 || '',
        field9: row.data?.field9 || '',
        field10: row.data?.field10 || ''
      }));

      // Get total (use 0 if blocked/unavailable)
      const total = estimatePreviewData?.total || 0;

      // Save grid data with total
      await jobVersioningApi.saveGridData(estimateId, simplifiedRows, total);
      gridEngine.markAsSaved();
    } catch (error) {
      console.error('Save error:', error);
    }
  }, [estimateId, gridEngine, estimatePreviewData]);

  return {
    handleFieldCommit,
    handleProductTypeSelect,
    handleInsertRow,
    handleDeleteRow,
    executeDeleteRow,
    handleDuplicateRow,
    handleClearRow,
    executeClearRow,
    handleDragEnd,
    handleReset,
    handleClearAll,
    handleClearEmpty,
    handleAddSection,
    handleManualSave
  };
};
