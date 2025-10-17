/**
 * GridJobBuilder implementation using Base Layer architecture
 * Clean, performant, and maintainable grid system
 *
 * REFACTORED: Logic extracted into focused hooks and components for maintainability
 */

import React, { useEffect, useMemo, useState } from 'react';
import { GridJobBuilderProps } from './types/index';

// Base Layer architecture
import { GridEngine, GridEngineConfig } from './core/GridEngine';
import { GridRow } from './core/types/LayerTypes';

// UI components
import { DragDropGridRenderer } from './components/DragDropGridRenderer';
import { GridHeader } from './components/GridHeader';
import { GridConfirmationModals } from './components/GridConfirmationModals';

// Hooks
import { useEditLock } from '../../hooks/useEditLock';
import { useProductTypes } from './hooks/useProductTypes';
import { useTemplateCache } from './hooks/useTemplateCache';
import { useGridDataLoader } from './hooks/useGridDataLoader';
import { useGridActions } from './hooks/useGridActions';
import { useAutoSave } from './hooks/useAutoSave';
import { useNavigationGuard } from './hooks/useNavigationGuard';
import { useKeyboardConfirmations } from './hooks/useKeyboardConfirmations';
import { EditLockIndicator } from '../common/EditLockIndicator';
import { useCustomerPreferencesWithCache } from './core/validation/context/useCustomerPreferences';

// Utils
import { convertProductTypeToConfig } from './utils/productTypeHelpers';

// Import the save API
import { jobVersioningApi } from '../../services/jobVersioningApi';


const GridJobBuilderRefactored: React.FC<GridJobBuilderProps> = ({
  user,
  estimate,
  isCreatingNew,
  showNotification,
  customerId,
  customerName,
  cashCustomer,
  taxRate,
  versioningMode = false,
  estimateId,
  isReadOnly = false,
  onValidationChange,
  onRequestNavigation,
  hoveredRowId = null,
  onRowHover = () => {}
}) => {
  // === CORE HOOKS ===
  const { productTypes, loading: productTypesLoading, error: productTypesError } = useProductTypes();

  const effectiveCustomerId = useMemo(() => {
    const estimateCustomerId = estimate?.customer_id ?? (estimate as any)?.customerId ?? null;
    return customerId ?? estimateCustomerId ?? null;
  }, [customerId, estimate]);

  const { preferences: customerPreferences } = useCustomerPreferencesWithCache(
    effectiveCustomerId === null ? undefined : effectiveCustomerId
  );

  // === MODAL STATE ===
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [clearModalType, setClearModalType] = useState<'reset' | 'clearAll' | 'clearEmpty' | null>(null);
  const [showRowConfirmation, setShowRowConfirmation] = useState(false);
  const [rowConfirmationType, setRowConfirmationType] = useState<'clear' | 'delete' | null>(null);
  const [pendingRowIndex, setPendingRowIndex] = useState<number | null>(null);
  const [validationVersion, setValidationVersion] = useState(0);

  // === GRID ENGINE ===
  const gridEngine = useMemo(() => {
    const config: GridEngineConfig = {
      productTypes: [], // Will be populated when useProductTypes loads
      staticDataCache: {
        // Basic static data for Base Layer testing
        // Future: Load from API via dynamic template service
        materials: ['ACM', 'Aluminum', 'PVC', 'Vinyl'],
        colors: ['White', 'Black', 'Red', 'Blue', 'Green'],
        finishes: ['Matte', 'Gloss', 'Satin', 'Textured'],
        sizes: ['Small', 'Medium', 'Large', 'Custom']
      }, // TODO: Load from API
      autoSave: {
        enabled: !isReadOnly && versioningMode,
        debounceMs: 125,
        onSave: async (coreRows) => {
          if (!estimateId) return;

          try {

            // Convert to simplified structure - no IDs needed, but keep row types
            const simplifiedRows = coreRows.map((row) => {
              return {
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
              };
            });


            // Save directly as JSON array
            await jobVersioningApi.saveGridData(estimateId, simplifiedRows);
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }
      },
      validation: {
        enabled: !isReadOnly // Enable validation only when editing
      },
      callbacks: {
        onRowsChange: (gridRows) => {
          // Pass GridRowWithCalculations directly - no conversion needed
          // Filter out empty rows for parent callback
          gridRows.filter(row =>
            row.productTypeId ||
            Object.values(row.data || {}).some(value => value && String(value).trim() !== '')
          );

        },
        onStateChange: () => {
          // GridEngine state changes
        },
        onValidationChange: (hasErrors, errorCount, resultsManager) => {
          setValidationVersion(prev => prev + 1);
          // Validation results from ValidationEngine
          onValidationChange?.(hasErrors, errorCount, resultsManager);
        }
      },
      permissions: {
        canEdit: !isReadOnly,
        canDelete: !isReadOnly,
        userRole: user?.role || 'viewer'
      },
      customerPreferences: customerPreferences || undefined,

      // NEW: Customer context for pricing calculations
      customerId: effectiveCustomerId || undefined,
      customerName: customerName || undefined,
      cashCustomer: cashCustomer || false,
      taxRate: taxRate || 2.0,
      estimateId: estimateId || undefined
    };

    return new GridEngine(config);
  }, [isReadOnly, versioningMode, user?.role, estimateId]);

  // Customer prefs effect
  useEffect(() => {
    if (customerPreferences) {
      gridEngine.updateConfig({ customerPreferences });
    }
  }, [customerPreferences, gridEngine]);

  // Product types effect
  useEffect(() => {
    if (productTypes.length > 0) {
      const convertedProductTypes = productTypes.map(convertProductTypeToConfig);
      gridEngine.updateConfig({ productTypes: convertedProductTypes });
    }
  }, [productTypes, gridEngine]);

  // Dev exposure effect
  useEffect(() => {
    if (import.meta.env.DEV && gridEngine) {
      (window as any).gridEngineTestAccess = gridEngine;
    }

    return () => {
      if (import.meta.env.DEV) {
        delete (window as any).gridEngineTestAccess;
      }
    };
  }, [gridEngine]);

  // Customer ID warning effect
  useEffect(() => {
    if (estimate && effectiveCustomerId === null) {
      console.warn('Customer preferences: no customer id resolved for estimate', {
        explicitlySelectedCustomerId: customerId,
        estimate
      });
    }
  }, [estimate, effectiveCustomerId, customerId]);

  // Customer prefs logging
  useEffect(() => {
    if (customerPreferences) {
      console.log('Loaded customer manufacturing preferences:', customerPreferences);
    }
  }, [customerPreferences]);

  // === EDIT LOCK ===
  const editLock = useEditLock({
    resourceType: 'estimate',
    resourceId: estimateId?.toString() || '',
    userId: user?.user_id || 0,
    username: user?.username || '',
    userRole: user?.role || '',
    autoAcquire: Boolean(versioningMode && estimateId && !isReadOnly),
    onLockLost: () => {
      gridEngine.setEditMode('readonly');
    },
    onLockAcquired: () => {
      if (versioningMode && estimateId && !isReadOnly) {
        gridEngine.setEditMode('normal');
      }
    }
  });

  // Edit mode sync
  useEffect(() => {
    if (versioningMode && estimateId) {
      const shouldBeReadOnly = isReadOnly || !editLock.hasLock;
      gridEngine.setEditMode(shouldBeReadOnly ? 'readonly' : 'normal');
    }
  }, [editLock.hasLock, isReadOnly, versioningMode, estimateId, gridEngine]);

  // === EXTRACTED HOOKS ===
  const { templatesLoaded, fieldPromptsMap, staticOptionsMap } = useTemplateCache(showNotification);

  useGridDataLoader({
    templatesLoaded,
    estimateId,
    gridEngine,
    showNotification
  });

  const gridState = gridEngine.getState();
  const displayRows = gridEngine.getRows() as GridRow[];

  const actions = useGridActions({
    displayRows,
    gridEngine,
    productTypes,
    fieldPromptsMap,
    versioningMode,
    estimateId,
    showNotification,
    setShowClearConfirmation,
    setClearModalType,
    setShowRowConfirmation,
    setRowConfirmationType,
    setPendingRowIndex,
    pendingRowIndex
  });

  useAutoSave({
    hasUnsavedChanges: gridState.hasUnsavedChanges,
    versioningMode,
    estimateId,
    isReadOnly,
    gridEngine,
    showNotification
  });

  useNavigationGuard({
    onRequestNavigation,
    hasUnsavedChanges: gridState.hasUnsavedChanges,
    isReadOnly
  });

  useKeyboardConfirmations({
    showClearConfirmation,
    clearModalType,
    showRowConfirmation,
    rowConfirmationType,
    handlers: {
      handleReset: actions.handleReset,
      handleClearAll: actions.handleClearAll,
      handleClearEmpty: actions.handleClearEmpty,
      executeClearRow: actions.executeClearRow,
      executeDeleteRow: actions.executeDeleteRow,
      setShowClearConfirmation,
      setClearModalType,
      setShowRowConfirmation,
      setRowConfirmationType,
      setPendingRowIndex
    }
  });

  // Grid-level keyboard handler for dropdown cells (when closed)
  useEffect(() => {
    if (isReadOnly) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if focused element is a select within our grid
      const activeElement = document.activeElement;
      if (!activeElement || activeElement.tagName !== 'SELECT') return;

      // Verify it's part of our grid (not some other select on the page)
      const gridContainer = document.querySelector('[data-testid="grid-job-builder"]');
      if (!gridContainer?.contains(activeElement)) return;

      // Handle Delete/Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();

        const selectElement = activeElement as HTMLSelectElement;

        // Trigger a change event with empty value to clear through React's onChange handler
        selectElement.value = '';
        const changeEvent = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(changeEvent);

        // Close dropdown and refocus
        selectElement.blur();
        setTimeout(() => selectElement.focus(), 0);
      }
    };

    // Use capture phase to intercept before modals or other handlers
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isReadOnly]);

  // === LOADING STATES ===
  // Check loading conditions directly
  if (productTypesLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-gray-600">Loading product types...</p>
      </div>
    );
  }

  if (productTypesError) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-red-500 mb-4">
          <p className="font-semibold">Error loading product types</p>
          <p className="text-sm">{productTypesError}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!displayRows.length) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-gray-600">Loading grid...</p>
      </div>
    );
  }

  // === MAIN RENDER ===
  return (
    <div className="bg-white rounded-lg shadow w-full" data-testid="grid-job-builder">
      {/* Edit Lock Indicator */}
      {versioningMode && estimateId && !isReadOnly && editLock.lockStatus && (
        <div className="p-4 border-b border-gray-200">
          <EditLockIndicator
            lockStatus={editLock.lockStatus}
            hasLock={editLock.hasLock}
            isLoading={editLock.isLoading}
            canOverride={editLock.canOverride}
            onOverride={editLock.overrideLock}
            onViewReadOnly={() => gridEngine.setEditMode('readonly')}
          />
        </div>
      )}

      {/* Header Section - GridHeader with action buttons */}
      <GridHeader
        gridEngine={gridEngine}
        estimate={estimate}
        versioningMode={versioningMode}
        isCreatingNew={isCreatingNew}
        onReset={() => { setClearModalType('reset'); setShowClearConfirmation(true); }}
        onClearAll={() => { setClearModalType('clearAll'); setShowClearConfirmation(true); }}
        onClearEmpty={() => { setClearModalType('clearEmpty'); setShowClearConfirmation(true); }}
        onAddSection={actions.handleAddSection}
        onManualSave={actions.handleManualSave}
      />

      {/* Main Grid Body - New Drag-Drop Renderer */}
      <DragDropGridRenderer
        rows={displayRows}
        productTypes={gridEngine.getConfig().productTypes || []}
        staticDataCache={gridEngine.getConfig().staticDataCache}
        onFieldCommit={actions.handleFieldCommit}
        onProductTypeSelect={actions.handleProductTypeSelect}
        onInsertRow={actions.handleInsertRow}
        onDeleteRow={actions.handleDeleteRow}
        onDuplicateRow={actions.handleDuplicateRow}
        onClearRow={actions.handleClearRow}
        onDragEnd={actions.handleDragEnd}
        isReadOnly={gridState.editMode === 'readonly'}
        fieldPromptsMap={fieldPromptsMap as Record<number, Record<string, string>>}
        staticOptionsMap={staticOptionsMap}
        validationEngine={typeof gridEngine.getValidationResults === 'function' ? gridEngine : undefined}
        validationVersion={validationVersion}
        hoveredRowId={hoveredRowId}
        onRowHover={onRowHover}
      />

      {/* Footer Section - Simple for now */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>Total rows: {displayRows.length}</span>
          {gridState.lastSaved && (
            <span>Last saved: {gridState.lastSaved.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Confirmation Modals */}
      <GridConfirmationModals
        showClearConfirmation={showClearConfirmation}
        clearModalType={clearModalType}
        onClearCancel={() => { setShowClearConfirmation(false); setClearModalType(null); }}
        onReset={actions.handleReset}
        onClearAll={actions.handleClearAll}
        onClearEmpty={actions.handleClearEmpty}
        showRowConfirmation={showRowConfirmation}
        rowConfirmationType={rowConfirmationType}
        pendingRowIndex={pendingRowIndex}
        onRowCancel={() => {
          setShowRowConfirmation(false);
          setRowConfirmationType(null);
          setPendingRowIndex(null);
        }}
        onClearRow={actions.executeClearRow}
        onDeleteRow={actions.executeDeleteRow}
      />
    </div>
  );
};

export default React.memo(GridJobBuilderRefactored);
