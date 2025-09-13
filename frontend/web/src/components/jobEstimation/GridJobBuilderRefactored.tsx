/**
 * GridJobBuilder implementation using Base Layer architecture
 * Clean, performant, and maintainable grid system
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { GridJobBuilderProps } from './types';

// Base Layer architecture
import { GridEngine, GridEngineConfig } from './core/GridEngine';
import { estimateRowsToGridRowCores, gridRowCoresToEstimateRows, gridRowsToEstimateRows } from './core/adapters/EstimateRowAdapter';

// UI components
import { DragDropGridRenderer } from './components/DragDropGridRenderer';

// Hooks
import { useEditLock } from '../../hooks/useEditLock';
import { useProductTypes } from './hooks/useProductTypes';
import { EditLockIndicator } from '../common/EditLockIndicator';

// Helper function to convert ProductType to ProductTypeConfig
const convertProductTypeToConfig = (productType: any): any => {
  // For now, create a basic config - will be enhanced when we implement dynamic templates
  return {
    id: productType.id,
    name: productType.name,
    fields: [], // TODO: Load from input_template when dynamic templates are integrated
    category: productType.category
  };
};

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
  onValidationChange,
  onGridRowsChange,
  onRequestNavigation
}) => {
  // Load product types from database
  const { productTypes, loading: productTypesLoading, error: productTypesError } = useProductTypes();
  // Initialize GridEngine with configuration
  const gridEngine = useMemo(() => {
    const config: GridEngineConfig = {
      productTypes: [], // Will be populated when useProductTypes loads
      staticDataCache: {}, // TODO: Load from API
      autoSave: {
        enabled: !isReadOnly && versioningMode,
        debounceMs: 500,
        onSave: async (coreRows) => {
          // Convert back to EstimateRow format for API
          const estimateRows = gridRowCoresToEstimateRows(coreRows);
          // TODO: Save to backend API
          console.log('Auto-saving rows:', estimateRows);
        }
      },
      callbacks: {
        onRowsChange: (gridRows) => {
          // Convert to EstimateRow format for parent components
          const estimateRows = gridRowsToEstimateRows(gridRows);
          
          // Filter out empty rows for parent callback
          const activeRows = estimateRows.filter(row => 
            row.productTypeId || 
            Object.values(row.data || {}).some(value => value && String(value).trim() !== '')
          );
          
          onGridRowsChange?.(activeRows);
        },
        onStateChange: (state) => {
          // Future validation layer integration point
          const hasErrors = false; // TODO: Implement validation in future layers
          const errorCount = 0;
          onValidationChange?.(hasErrors, errorCount);
        }
      },
      permissions: {
        canEdit: !isReadOnly,
        canDelete: !isReadOnly,
        userRole: user?.role || 'viewer'
      }
    };

    return new GridEngine(config);
  }, [isReadOnly, versioningMode, user?.role]);

  // Update GridEngine configuration when product types load
  useEffect(() => {
    if (productTypes.length > 0) {
      const convertedProductTypes = productTypes.map(convertProductTypeToConfig);
      gridEngine.updateConfig({ productTypes: convertedProductTypes });
    }
  }, [productTypes, gridEngine]);

  // Expose GridEngine for testing in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && gridEngine) {
      (window as any).gridEngineTestAccess = gridEngine;
      console.log('🧪 GridEngine exposed for testing via window.gridEngineTestAccess');
    }
    
    return () => {
      if (process.env.NODE_ENV === 'development') {
        delete (window as any).gridEngineTestAccess;
      }
    };
  }, [gridEngine]);

  // Edit lock system
  const editLock = useEditLock({
    resourceType: 'estimate',
    resourceId: estimateId?.toString() || '',
    userId: user?.user_id || 0,
    username: user?.username || '',
    userRole: user?.role || '',
    autoAcquire: versioningMode && estimateId && !isReadOnly,
    onLockLost: () => {
      gridEngine.setEditMode('readonly');
    }
  });

  // Update edit mode based on lock status
  useEffect(() => {
    if (versioningMode && estimateId) {
      const shouldBeReadOnly = isReadOnly || !editLock.hasLock;
      gridEngine.setEditMode(shouldBeReadOnly ? 'readonly' : 'normal');
    }
  }, [editLock.hasLock, isReadOnly, versioningMode, estimateId, gridEngine]);

  // Load initial data
  useEffect(() => {
    if (estimate && estimate.grid_data) {
      // Convert existing EstimateRow data to GridRowCore format
      const coreRows = estimateRowsToGridRowCores(estimate.grid_data);
      gridEngine.updateCoreData(coreRows);
    } else {
      // Initialize with empty row
      const emptyRow = gridEngine.getCoreOperations().createEmptyRow('main', []);
      gridEngine.updateCoreData([emptyRow]);
    }
  }, [estimate, gridEngine]);

  // Get current state
  const gridState = gridEngine.getState();
  const displayRows = gridEngine.getRows();

  // Event handlers using GridEngine methods
  const handleFieldCommit = useCallback((
    rowIndex: number,
    fieldName: string,
    value: string
  ) => {
    const row = displayRows[rowIndex];
    if (!row) return;

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

    gridEngine.updateRowProductType(row.id, productTypeId, productTypeName);
  }, [displayRows, gridEngine, productTypes]);

  const handleInsertRow = useCallback((afterIndex: number) => {
    gridEngine.insertRow(afterIndex, 'main');
  }, [gridEngine]);

  const handleDeleteRow = useCallback((rowIndex: number) => {
    const row = displayRows[rowIndex];
    if (!row) return;

    gridEngine.deleteRow(row.id);
  }, [displayRows, gridEngine]);

  const handleDuplicateRow = useCallback((rowIndex: number) => {
    const row = displayRows[rowIndex];
    if (!row) return;

    gridEngine.duplicateRow(row.id);
  }, [displayRows, gridEngine]);

  // Drag and drop handling
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceRow = displayRows.find(r => r.id === active.id);
    if (!sourceRow) return;

    // Determine drop position based on mouse position (top 50% = above, bottom 50% = below)
    // Try to get the current mouse position (not the initial click position)
    const mouseY = event.activatorEvent?.clientY; // Initial click position
    const currentMouseY = window.event?.clientY || mouseY; // Try to get current position
    const overRect = event.over?.rect?.current?.translated || event.over?.rect;
    
    const midpoint = overRect ? overRect.top + overRect.height / 2 : 0;
    const finalMouseY = currentMouseY || mouseY;
    const isAbove = finalMouseY && overRect ? finalMouseY < midpoint : false;
    
    const dropPosition = finalMouseY && overRect
      ? finalMouseY < midpoint 
        ? 'above' 
        : 'below'
      : 'below'; // Default fallback

    gridEngine.moveRows(sourceRow.draggedRowIds, over.id, dropPosition);
  }, [displayRows, gridEngine]);

  // Manual save
  const handleManualSave = useCallback(async () => {
    if (!estimateId) return;

    const coreData = gridEngine.getCoreData();
    const estimateRows = gridRowCoresToEstimateRows(coreData);
    
    try {
      // TODO: Save to backend API
      console.log('Manual save:', estimateRows);
      gridEngine.markAsSaved();
      showNotification?.('Grid saved successfully', 'success');
    } catch (error) {
      console.error('Save error:', error);
      showNotification?.('Failed to save grid', 'error');
    }
  }, [estimateId, gridEngine, showNotification]);

  // Navigation guard - simplified
  useEffect(() => {
    if (onRequestNavigation) {
      const navigationGuard = (navigationFn?: () => void) => {
        // Only proceed if we have a valid function
        if (typeof navigationFn === 'function') {
          if (gridState.hasUnsavedChanges) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
            if (confirmed) {
              navigationFn();
            }
          } else {
            navigationFn();
          }
        }
      };

      onRequestNavigation(navigationGuard);

      return () => {
        onRequestNavigation(null);
      };
    }
  }, [onRequestNavigation, gridState.hasUnsavedChanges]);

  // Beforeunload protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (gridState.hasUnsavedChanges && !isReadOnly) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [gridState.hasUnsavedChanges, isReadOnly]);

  // Loading states
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

      {/* Header Section - Simple for now */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Grid Job Builder</h2>
          <div className="flex gap-2">
            {gridState.hasUnsavedChanges && (
              <span className="text-orange-600 text-sm">Unsaved changes</span>
            )}
            {!isReadOnly && (
              <button
                onClick={handleManualSave}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Body - New Drag-Drop Renderer */}
      <DragDropGridRenderer
        rows={displayRows}
        productTypes={gridEngine.getConfig().productTypes || []}
        staticDataCache={gridEngine.getConfig().staticDataCache}
        onFieldCommit={handleFieldCommit}
        onProductTypeSelect={handleProductTypeSelect}
        onInsertRow={handleInsertRow}
        onDeleteRow={handleDeleteRow}
        onDuplicateRow={handleDuplicateRow}
        onDragEnd={handleDragEnd}
        isReadOnly={gridState.editMode === 'readonly'}
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
    </div>
  );
};