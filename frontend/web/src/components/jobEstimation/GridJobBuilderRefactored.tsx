/**
 * GridJobBuilder implementation using Base Layer architecture
 * Clean, performant, and maintainable grid system
 *
 * REFACTORED: Logic extracted into focused hooks and components for maintainability
 */

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { GridJobBuilderProps } from './types/index';

// Base Layer architecture
import { GridEngine, GridEngineConfig } from './core/GridEngine';
import { GridRow } from './core/types/LayerTypes';

// UI components
import { DragDropGridRenderer } from './components/DragDropGridRenderer';
import { GridHeader } from './components/GridHeader';
import { GridConfirmationModals } from './components/GridConfirmationModals';
import { CopyRowsModal } from './components/CopyRowsModal';
import { GridRowCore } from './core/types/CoreTypes';

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

// Theme constants
import { PAGE_STYLES } from '../../constants/moduleColors';


const GridJobBuilderRefactored: React.FC<GridJobBuilderProps> = ({
  user,
  estimate,
  isCreatingNew,
  customerId,
  customerName,
  cashCustomer,
  taxRate,
  versioningMode = false,
  estimateId,
  isReadOnly = false,
  onValidationChange,
  onRequestNavigation,
  onPreferencesLoaded,
  onGridDataChange,
  onGridEngineReady,
  hoveredRowId = null,
  onRowHover = () => {},
  estimatePreviewData
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

  // Pass preferences up to parent - GridJobBuilder is single source of truth
  useEffect(() => {
    if (onPreferencesLoaded) {
      onPreferencesLoaded(customerPreferences);
    }
  }, [customerPreferences, onPreferencesLoaded]);

  // === MODAL STATE ===
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [clearModalType, setClearModalType] = useState<'reset' | 'clearAll' | 'clearEmpty' | null>(null);
  const [showRowConfirmation, setShowRowConfirmation] = useState(false);
  const [rowConfirmationType, setRowConfirmationType] = useState<'clear' | 'delete' | null>(null);
  const [pendingRowIndex, setPendingRowIndex] = useState<number | null>(null);
  const [validationVersion, setValidationVersion] = useState(0);
  const [showCopyRowsModal, setShowCopyRowsModal] = useState(false);
  const [rowsVersion, setRowsVersion] = useState(0);

  // === GRID DATA CHANGE CALLBACK ===
  // Notify Dashboard when grid data changes (for auto-save orchestration)
  const handleGridDataChange = useCallback((version: number) => {
    // Dashboard will handle auto-save after calculation completes
    // This eliminates race condition between auto-save and calculation
    onGridDataChange?.(version);
  }, [onGridDataChange]);

  // === GRID ENGINE ===
  const gridEngine = useMemo(() => {
    const config: GridEngineConfig = {
      productTypes: [], // Will be populated when useProductTypes loads
      staticDataCache: {
        // Reserved for dynamic dropdown options loaded from API
        // Product-specific options are defined in database input_template field
      },
      // Auto-save removed from GridEngine - now handled by Dashboard after calculation completes
      // This eliminates race condition between auto-save and calculation
      validation: {
        enabled: true // Always enable validation for pricing calculations (even in read-only mode)
      },
      callbacks: {
        onRowsChange: () => {
          // Trigger re-render when rows change
          setRowsVersion(prev => prev + 1);
        },
        onStateChange: () => {
          // GridEngine state changes
        },
        onValidationChange: (hasErrors, errorCount, resultsManager) => {
          setValidationVersion(prev => prev + 1);
          // Validation results from ValidationEngine
          onValidationChange?.(hasErrors, errorCount, resultsManager);
        },
        onGridDataChange: handleGridDataChange // NEW: Notify Dashboard when grid data changes
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
  }, [isReadOnly, versioningMode, user?.role, estimateId, effectiveCustomerId, customerName, cashCustomer, taxRate]);

  // === COPY ROWS HANDLER ===
  // Handler for copying rows from another estimate (backend-first pattern)
  const handleCopyRows = useCallback(async (selectedRows: GridRowCore[], sourceEstimateId: number) => {
    if (selectedRows.length === 0 || !estimateId) return;

    try {
      // Extract database IDs from selected rows
      const rowIds = selectedRows
        .map(row => row.dbId)
        .filter((id): id is number => typeof id === 'number');

      if (rowIds.length === 0) {
        console.error('No valid database IDs found in selected rows');
        return;
      }

      // Save to backend first (follows handleAddSection pattern)
      await jobVersioningApi.copyRowsToEstimate(estimateId, sourceEstimateId, rowIds);

      // Reload from backend to get fresh data and trigger proper React re-render
      await gridEngine.reloadFromBackend(estimateId, jobVersioningApi);

      console.log(`Copied ${rowIds.length} rows from estimate ${sourceEstimateId} to ${estimateId}`);
    } catch (error) {
      console.error('Failed to copy rows:', error);
    }
  }, [gridEngine, estimateId]);

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

  // Pass GridEngine instance to parent for auto-save orchestration
  useEffect(() => {
    onGridEngineReady?.(gridEngine);

    return () => {
      onGridEngineReady?.(null);
    };
  }, [gridEngine, onGridEngineReady]);

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
    // Customer preferences loaded
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
  const { templatesLoaded, fieldPromptsMap, staticOptionsMap } = useTemplateCache();

  useGridDataLoader({
    templatesLoaded,
    estimateId,
    gridEngine,
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
    estimatePreviewData,
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
      <div className={`${PAGE_STYLES.composites.panelContainer} p-6 text-center`}>
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className={`mt-2 ${PAGE_STYLES.panel.textMuted}`}>Loading product types...</p>
      </div>
    );
  }

  if (productTypesError) {
    return (
      <div className={`${PAGE_STYLES.composites.panelContainer} p-6 text-center`}>
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
      <div className={`${PAGE_STYLES.composites.panelContainer} p-6 text-center`}>
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className={`mt-2 ${PAGE_STYLES.panel.textMuted}`}>Loading grid...</p>
      </div>
    );
  }

  // === MAIN RENDER ===
  return (
    <div className={`${PAGE_STYLES.composites.panelContainer} w-full`} data-testid="grid-job-builder">
      {/* Edit Lock Indicator */}
      {versioningMode && estimateId && !isReadOnly && editLock.lockStatus && (
        <div className={`p-4 border-b ${PAGE_STYLES.border}`}>
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
        onCopyRows={() => setShowCopyRowsModal(true)}
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
      <div className={`p-4 border-t ${PAGE_STYLES.border} ${PAGE_STYLES.header.background}`}>
        <div className={`flex justify-between items-center text-sm ${PAGE_STYLES.header.text}`}>
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

      {/* Copy Rows Modal */}
      <CopyRowsModal
        isOpen={showCopyRowsModal}
        onClose={() => setShowCopyRowsModal(false)}
        onCopyRows={handleCopyRows}
        currentEstimateId={estimateId}
      />
    </div>
  );
};

export default React.memo(GridJobBuilderRefactored);
