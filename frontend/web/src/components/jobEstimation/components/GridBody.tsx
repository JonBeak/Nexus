import React, { useMemo, useRef, useEffect } from 'react';
import { GridRow } from './GridRow';
import { DragDropManager, useDragDropContext } from '../managers/DragDropManager';
import { RowManager } from '../managers/RowManager';
import { AssemblyManager } from '../managers/AssemblyManager';
import { GridState } from '../hooks/useSimpleGridState';
import { GridActions } from '../hooks/useGridActions';

// ✅ PERFORMANCE FIX: Memoize GridRow to prevent excessive re-renders
const MemoizedGridRow = React.memo(GridRow, (prevProps, nextProps) => {
  // Add debug logging to see what's changing
  const propsChanged = {
    row: prevProps.row !== nextProps.row,
    rowIndex: prevProps.rowIndex !== nextProps.rowIndex,
    rows: prevProps.rows !== nextProps.rows,
    productTypes: prevProps.productTypes !== nextProps.productTypes,
    assemblyColors: prevProps.assemblyColors !== nextProps.assemblyColors,
    rowOperations: prevProps.rowOperations !== nextProps.rowOperations,
    assemblyOperations: prevProps.assemblyOperations !== nextProps.assemblyOperations,
    assemblyItemsCache: prevProps.assemblyItemsCache !== nextProps.assemblyItemsCache,
    validationErrors: prevProps.validationErrors !== nextProps.validationErrors
  };
  
  const hasChanges = Object.values(propsChanged).some(changed => changed);
  
  return !hasChanges; // true means "skip render", false means "re-render"
});

// PHASE 3: Component to sync drag state with auto-save ref
const DragStateSync: React.FC<{ isDragCalculatingRef?: React.MutableRefObject<boolean> }> = ({ 
  isDragCalculatingRef 
}) => {
  const { isDragCalculating } = useDragDropContext();
  
  useEffect(() => {
    if (isDragCalculatingRef) {
      isDragCalculatingRef.current = isDragCalculating;
    }
  }, [isDragCalculating, isDragCalculatingRef]);
  
  return null; // This component only syncs state
};

interface GridBodyProps {
  gridState: GridState;
  gridActions: GridActions;
  versioningMode?: boolean;
  isCreatingNew: boolean;
  isDragCalculatingRef?: React.MutableRefObject<boolean>;  // PHASE 3: Auto-save drag awareness
  batchStateManager?: ReturnType<typeof import('../utils/batchStateManager').createBatchStateManager>; // PHASE 2B: Batch optimization
}

export const GridBody: React.FC<GridBodyProps> = ({
  gridState,
  gridActions,
  versioningMode = false,
  isCreatingNew,
  isDragCalculatingRef,
  batchStateManager
}) => {
  
  // ✅ STABILITY FIX: Create managers with stable references to break infinite loops
  const stableMarkEstimateChanged = useRef(gridActions.markEstimateChanged);
  const stableSetRows = useRef(gridState.setRows);
  
  // Update stable refs when functions change
  stableMarkEstimateChanged.current = gridActions.markEstimateChanged;
  stableSetRows.current = gridState.setRows;
  
  // Removed rowSignature optimization - use direct dependencies for reliability

  // Create managers only when essential data changes, not when functions change
  const rowManager = useMemo(() => {
    return new RowManager(
      gridState.rows,
      gridState.productTypes,
      (...args) => stableSetRows.current(...args),
      () => stableMarkEstimateChanged.current(),
      (message: string, type?: 'success' | 'error') => {
        // Removed console.log for performance
      },
      gridState.markFieldAsBlurred, // ✅ BLUR-ONLY: Pass blur tracking function
      batchStateManager // ✅ PHASE 2B: Pass batch manager for optimized updates
    );
  }, [
    gridState.rows, 
    gridState.productTypes,
    gridState.markFieldAsBlurred, // ✅ BLUR-ONLY: Include in dependencies
    batchStateManager // ✅ PHASE 2B: Include batch manager in dependencies
  ]);

  const assemblyManager = useMemo(() => {
    return new AssemblyManager(
      gridState.rows,
      (...args) => stableSetRows.current(...args),
      () => stableMarkEstimateChanged.current()
    );
  }, [
    gridState.rows
  ]);

  // Assembly system will be added later
  const assemblyItemsCache = useMemo(() => {
    return { allItems: [], unassignedItems: [] };
  }, []);

  // ✅ FIXED: Memoize assemblyColors to prevent new array reference every render
  const assemblyColors = useMemo(() => [
    'bg-purple-200 text-purple-900 hover:brightness-95',
    'bg-blue-200 text-blue-900 hover:brightness-95', 
    'bg-green-200 text-green-900 hover:brightness-95',
    'bg-orange-200 text-orange-900 hover:brightness-95',
    'bg-pink-200 text-pink-900 hover:brightness-95',
    'bg-cyan-200 text-cyan-900 hover:brightness-95',
    'bg-red-200 text-red-900 hover:brightness-95',
    'bg-yellow-200 text-yellow-900 hover:brightness-95',
    'bg-indigo-200 text-indigo-900 hover:brightness-95',
    'bg-emerald-200 text-emerald-900 hover:brightness-95'
  ], []); // Never changes

  return (
    <>
      {/* Basic Info - Hidden in versioning mode */}
      {!versioningMode && (
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                disabled={gridState.effectiveReadOnly}
              >
                <option value="">Select Customer</option>
                {gridState.customers.map(customer => (
                  <option key={customer.customer_id} value={customer.customer_id}>
                    {customer.company_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estimate Name</label>
              <input
                type="text"
                placeholder="Enter estimate name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
                disabled={gridState.effectiveReadOnly}
              />
            </div>
          </div>
        </div>
      )}

      {/* Grid Table */}
      <div className="overflow-x-auto">
        <DragDropManager
          rows={gridState.rows}
          onRowsReorder={gridActions.handleRowsReorder}
          onEstimateChange={gridActions.markEstimateChanged}
          onImmediateSave={gridActions.performAutoSave}
          onReloadGridData={gridActions.reloadCurrentEstimate}
        >
          {/* PHASE 3: Sync drag state with auto-save ref */}
          <DragStateSync isDragCalculatingRef={isDragCalculatingRef} />
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="w-12 px-2 py-1 text-xs font-medium text-gray-600 text-center">#</th>
                <th className="px-2 py-1 text-xs font-medium text-gray-600 text-left w-36">Product / Item</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-14">QTY</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 1</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 2</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 3</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 4</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 5</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 6</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 7</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 8</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 9</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 10</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 11</th>
                <th className="px-1 py-1 text-xs font-medium text-gray-600 text-center w-16">Field 12</th>
                <th className="w-12 px-1 py-1 text-xs font-medium text-gray-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {gridState.rows.map((row, index) => (
                <MemoizedGridRow
                  key={row.id}
                  row={row}
                  rowIndex={index}
                  rows={gridState.rows}
                  productTypes={gridState.productTypes}
                  assemblyColors={assemblyColors}
                  rowOperations={rowManager}
                  assemblyOperations={assemblyManager}
                  assemblyItemsCache={assemblyItemsCache}
                  validationErrors={gridState.validationErrors[row.id]}
                  hasFieldBeenBlurred={gridState.hasFieldBeenBlurred}
                />
              ))}
            </tbody>
          </table>
        </DragDropManager>
      </div>
    </>
  );
};