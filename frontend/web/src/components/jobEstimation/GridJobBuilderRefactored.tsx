import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { GridJobBuilderProps } from './types';
import { createEmptyProductRow } from './utils/rowUtils';
import { useEditLock } from '../../hooks/useEditLock';
import { EditLockIndicator } from '../common/EditLockIndicator';

// Factored utilities and state
import { useSimpleGridState } from './hooks/useSimpleGridState';
import { useGridValidation } from './hooks/useGridValidation';
import { createGridActions } from './utils/gridActions';
import { createAutoSaveUtils } from './utils/autoSave';
import { useBatchStateManager } from './utils/batchStateManager';

// UI components
import { GridHeader } from './components/GridHeader';
import { GridBody } from './components/GridBody';
import { GridFooter } from './components/GridFooter';

export const GridJobBuilderRefactored: React.FC<GridJobBuilderProps> = ({
  user,
  estimate,
  isCreatingNew,
  onEstimateChange,
  onBackToEstimates,
  showNotification,
  versioningMode = false,
  estimateId,
  isReadOnly = false,
  onNavigateToEstimate,
  onValidationChange,
  onGridRowsChange,
  onRequestNavigation
}) => {
  // Simple state management - no complex logic here
  const gridState = useSimpleGridState(
    estimate, 
    isReadOnly, 
    versioningMode, 
    estimateId
  );

  // ✅ NEW: Modular edit lock system
  const editLock = useEditLock({
    resourceType: 'estimate',
    resourceId: estimateId?.toString() || '',
    userId: user?.user_id || 0,
    username: user?.username || '',
    userRole: user?.role || '',
    autoAcquire: versioningMode && estimateId && !isReadOnly,
    onLockLost: () => {
      gridState.setEffectiveReadOnly(true);
    }
  });

  // Update effective read-only state based on lock status
  useEffect(() => {
    if (versioningMode && estimateId) {
      const shouldBeReadOnly = isReadOnly || !editLock.hasLock;
      gridState.setEffectiveReadOnly(shouldBeReadOnly);
    }
  }, [editLock.hasLock, isReadOnly, versioningMode, estimateId]);

  // ✅ VALIDATION INTEGRATION: Add validation hook to enable field validation
  const gridValidation = useGridValidation(gridState, onValidationChange);

  // ✅ STABILITY FIX: Memoize callback functions using useCallback
  const stableOnEstimateChange = useCallback((estimate: any) => {
    if (onEstimateChange) {
      onEstimateChange(estimate);
    }
  }, [onEstimateChange]);
  
  const stableOnBackToEstimates = useCallback(() => {
    if (onBackToEstimates) {
      onBackToEstimates();
    }
  }, [onBackToEstimates]);
  
  const stableShowNotification = useCallback((message: string, type?: string) => {
    if (showNotification) {
      showNotification(message, type);
    }
  }, [showNotification]);

  // PHASE 2B: Create auto-save utils first (needed for batch manager)
  const isDragCalculatingRef = useRef(false);
  
  const autoSaveConfig = useMemo(() => ({
    debounceMs: 500,
    showNotification,
    isDragCalculatingRef
  }), [showNotification]);

  const autoSave = useMemo(() => {
    return createAutoSaveUtils(gridState, autoSaveConfig);
  }, [
    gridState.rows.length,
    gridState.hasUnsavedChanges,
    gridState.currentEstimate?.id,
    autoSaveConfig
  ]);

  // ✅ PHASE 2C: Optimized async validation with targeted field validation
  const runValidation = useCallback(async (rowId?: string, fieldName?: string): Promise<Record<string, Record<string, string[]>>> => {
    if (!rowId) return {};
    
    const rowIndex = gridState.rows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return {};
    
    const row = gridState.rows[rowIndex];
    
    // Validation system will be added later
    return {};
  }, [gridState.rows, gridValidation.validateRow]);

  // ✅ PHASE 2B: Batch state manager for optimized updates  
  const batchStateManager = useBatchStateManager({
    // State setters
    setRows: gridState.setRows,
    setValidationErrors: gridState.setValidationErrors,
    setHasUnsavedChanges: gridState.setHasUnsavedChanges,
    setFieldBlurStates: gridState.setFieldBlurStates,
    setLastSaved: gridState.setLastSaved,
    
    // Side effect handlers
    onValidationChange,
    onEstimateChange: stableOnEstimateChange,
    showNotification: stableShowNotification,
    debouncedAutoSave: autoSave.debouncedAutoSave,
    
    // ✅ PHASE 2C: Fixed validation function - now returns Promise!
    runValidation: runValidation
  });

  const gridActionsConfig = useMemo(() => ({
    user,
    estimate,
    isCreatingNew,
    versioningMode,
    estimateId,
    onEstimateChange: stableOnEstimateChange,
    onBackToEstimates: stableOnBackToEstimates,
    showNotification: stableShowNotification
  }), [
    user?.id, // Only user ID matters for actions
    estimate?.id, // Only estimate ID matters for actions  
    isCreatingNew,
    versioningMode,
    estimateId,
    stableOnEstimateChange,
    stableOnBackToEstimates,
    stableShowNotification
  ]);

  // ✅ PHASE 2B: Simplified stable dependencies for memoization
  const gridActionsKey = useMemo(() => {
    return `${gridState.rows.length}-${gridState.productTypes.length}-${gridState.currentEstimate?.id}-${gridState.currentEstimate?.version_number}`;
  }, [
    gridState.rows.length,
    gridState.productTypes.length,
    gridState.currentEstimate?.id,
    gridState.currentEstimate?.version_number
  ]);
  
  const baseGridActions = useMemo(() => {
    return createGridActions(gridState, gridActionsConfig);
  }, [
    gridActionsKey, // Single stable dependency
    gridActionsConfig
  ]);


  // ✅ STABILITY FIX: Memoize final gridActions object
  const gridActions = useMemo(() => {
    return {
      ...baseGridActions,
      performAutoSave: autoSave.performAutoSave,
      performManualSave: () => autoSave.performManualSave(estimateId),
      debouncedAutoSave: autoSave.debouncedAutoSave,
      markEstimateChanged: () => autoSave.markEstimateChanged(onEstimateChange)
    };
  }, [
    baseGridActions,
    autoSave,
    estimateId,
    onEstimateChange
  ]);

  // NOTE: Template creation is handled by database-first approach via backend
  // Frontend does not need to create templates in versioning mode

  // Ensure there's always an empty product row at the bottom
  useEffect(() => {
    // If no rows exist, add the first empty row
    if (gridState.rows.length === 0) {
      gridState.setRows([createEmptyProductRow(0, gridState.rows)]);
    } else {
      // If rows exist, ensure the last row is empty for new input
      const lastRow = gridState.rows[gridState.rows.length - 1];
      const needsEmptyRow = lastRow && lastRow.productTypeId && lastRow.productTypeId !== 27; // 27 = Empty Row
      
      if (needsEmptyRow) {
        gridState.setRows([...gridState.rows, createEmptyProductRow(0, gridState.rows)]);
      }
    }
  }, [
    // ✅ CRITICAL FIX: Only depend on non-temporary row structure, not temp IDs
    gridState.rows.filter(row => !row.id.toString().includes('temp-')).length,
    gridState.rows[gridState.rows.length - 1]?.productTypeId
  ]);

  // ✅ PHASE 2 FIX: Memoize activeRows to prevent constant new array creation
  const activeRows = useMemo(() => {
    if (!gridState.rows.length) return [];
    
    return gridState.rows.filter(row => 
      row.productTypeId || 
      Object.values(row.data || {}).some(value => value && String(value).trim() !== '')
    );
  }, [
    // Create stable dependency signature instead of full row objects
    gridState.rows.map(row => 
      `${row.id}-${row.productTypeId || 'empty'}-${Object.keys(row.data || {}).length}`
    ).join('|')
  ]);

  // Only notify parent when activeRows content actually changes (not just reference)
  const activeRowsRef = useRef<any[]>([]);
  useEffect(() => {
    if (onGridRowsChange && activeRows.length > 0) {
      // Compare content, not reference
      const currentSignature = activeRows.map(row => `${row.id}-${row.productTypeId || 'empty'}`).join('|');
      const prevSignature = activeRowsRef.current.map(row => `${row.id}-${row.productTypeId || 'empty'}`).join('|');
      
      if (currentSignature !== prevSignature) {
        activeRowsRef.current = activeRows;
        onGridRowsChange(activeRows);
      }
    }
  }, [activeRows, onGridRowsChange]);

  // Load data when estimate changes (from original working version)
  useEffect(() => {
    
    if (estimate && versioningMode && estimate.id && !isCreatingNew && 
        gridState.productTypes.length > 0 && gridState.loadedEstimateId !== estimate.id) {
      gridActions.loadExistingEstimateData(estimate.id);
      gridState.setLoadedEstimateId(estimate.id);
    }
  }, [estimate?.id, gridState.productTypes, versioningMode, isCreatingNew, gridState.loadedEstimateId]);

  // Setup navigation guard
  useEffect(() => {
    if (onRequestNavigation) {
      const stableGuard = (navigationFn: () => void) => {
        if (gridState.navigationGuardRef.current) {
          gridState.navigationGuardRef.current(navigationFn);
        } else {
          navigationFn();
        }
      };
      onRequestNavigation(stableGuard);
      gridState.navigationGuardRef.current = gridActions.handleRequestNavigation;
    }
    
    return () => {
      if (onRequestNavigation) {
        onRequestNavigation(null);
      }
    };
  }, [onRequestNavigation]);

  // Fallback auto-save trigger - KEY MISSING PIECE from original working version!
  useEffect(() => {
    if (gridState.hasUnsavedChanges && versioningMode && estimateId && gridState.currentEstimate?.is_draft) {
      autoSave.debouncedAutoSave();
    }
  }, [gridState.hasUnsavedChanges, versioningMode, estimateId, gridState.currentEstimate?.is_draft]);

  // Setup beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (gridState.hasUnsavedChanges && !gridState.effectiveReadOnly) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    const handleUnload = () => {
      gridState.isUnloadingRef.current = true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      if (gridState.autoSaveTimeoutRef.current) {
        clearTimeout(gridState.autoSaveTimeoutRef.current);
      }
    };
  }, [gridState.hasUnsavedChanges, gridState.effectiveReadOnly]);

  // Initialize data on component mount
  useEffect(() => {
    gridActions.loadInitialData();
  }, []);

  // ✅ VALIDATION FIX: Remove redundant validation notification system
  // The useGridValidation hook already notifies parent via onValidationChange
  // This duplicate notification system was causing race conditions between
  // field UI state and preview warning state
  // 
  // Validation flow: useGridValidation performs validation → updates gridState.validationErrors → notifies parent
  // No additional notification needed here

  // Show loading state
  if (gridState.loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow w-full">
      {/* Edit Lock Indicator */}
      {versioningMode && estimateId && !isReadOnly && editLock.lockStatus && (
        <div className="p-4 border-b border-gray-200">
          <EditLockIndicator
            lockStatus={editLock.lockStatus}
            hasLock={editLock.hasLock}
            isLoading={editLock.isLoading}
            canOverride={editLock.canOverride}
            onOverride={editLock.overrideLock}
            onViewReadOnly={() => gridState.setEffectiveReadOnly(true)}
          />
        </div>
      )}

      {/* Header Section */}
      <GridHeader
        gridState={gridState}
        gridActions={gridActions}
        user={user}
        estimate={estimate}
        versioningMode={versioningMode}
        isCreatingNew={isCreatingNew}
        onBackToEstimates={onBackToEstimates}
        editLock={editLock}
      />

      {/* Main Grid Body */}
      <GridBody
        gridState={gridState}
        gridActions={gridActions}
        versioningMode={versioningMode}
        isCreatingNew={isCreatingNew}
        isDragCalculatingRef={isDragCalculatingRef}
        batchStateManager={batchStateManager}
      />

      {/* Footer Section */}
      <GridFooter
        gridState={gridState}
        gridActions={gridActions}
        user={user}
        estimate={estimate}
        estimateId={estimateId}
        versioningMode={versioningMode}
        onNavigateToEstimate={onNavigateToEstimate}
      />
    </div>
  );
};