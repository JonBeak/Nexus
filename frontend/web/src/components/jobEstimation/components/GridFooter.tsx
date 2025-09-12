import React from 'react';
import { Trash2 } from 'lucide-react';
import { EstimateActions } from '../EstimateActions';
import { GridState } from '../hooks/useSimpleGridState';
import { GridActions } from '../hooks/useGridActions';

interface GridFooterProps {
  gridState: GridState;
  gridActions: GridActions;
  user: any;
  estimate?: any;
  estimateId?: number;
  versioningMode?: boolean;
  onNavigateToEstimate?: (jobId: number, estimateId: number) => void;
}

export const GridFooter: React.FC<GridFooterProps> = ({
  gridState,
  gridActions,
  user,
  estimate,
  estimateId,
  versioningMode = false,
  onNavigateToEstimate
}) => {
  return (
    <>
      {/* Estimate Actions for Versioning Mode */}
      {versioningMode && estimateId && estimate && (
        <EstimateActions
          estimateId={estimateId}
          estimate={gridState.currentEstimate || estimate}
          onSaveDraft={gridActions.handleSaveDraft}
          onFinalize={gridActions.handleFinalize}
          onStatusChange={gridActions.handleStatusChange}
          onNavigateToEstimate={onNavigateToEstimate}
          user={user}
        />
      )}

      {/* Clear Confirmation Modal */}
      {gridState.showClearConfirmation && gridState.clearModalType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-md">
            {gridState.clearModalType === 'reset' && (
              <>
                <div className="flex items-center mb-4">
                  <div className="w-6 h-6 text-orange-600 mr-3">⟲</div>
                  <h3 className="text-lg font-semibold">Reset Grid</h3>
                </div>
                
                <div className="mb-6">
                  <p className="text-gray-700 mb-2">
                    Reset the grid to default template with a Channel Letters row?
                  </p>
                  <p className="text-sm text-gray-500">
                    <strong>Note:</strong> This will clear all current data and recreate the default template.
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={gridActions.cancelClearTable}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={gridActions.confirmClearTable}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    Reset Grid
                  </button>
                </div>
              </>
            )}
            
            {gridState.clearModalType === 'clearAll' && (
              <>
                <div className="flex items-center mb-4">
                  <Trash2 className="w-6 h-6 text-red-500 mr-3" />
                  <h3 className="text-lg font-semibold">Clear All Items</h3>
                </div>
                
                <div className="mb-6">
                  <p className="text-gray-700 mb-2">
                    Are you sure you want to permanently delete all rows?
                  </p>
                  <p className="text-sm text-gray-500">
                    <strong>Warning:</strong> This action cannot be undone. All product configurations, assembly groups, and data will be permanently removed.
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={gridActions.cancelClearTable}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={gridActions.confirmClearAll}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete All
                  </button>
                </div>
              </>
            )}
            
            {gridState.clearModalType === 'clearEmpty' && (
              <>
                <div className="flex items-center mb-4">
                  <div className="w-6 h-6 text-blue-600 mr-3">🧹</div>
                  <h3 className="text-lg font-semibold">Clear Empty Rows</h3>
                </div>
                
                <div className="mb-6">
                  <p className="text-gray-700 mb-2">
                    Remove empty rows and keep only rows with input data?
                  </p>
                  <p className="text-sm text-gray-500">
                    <strong>Note:</strong> Rows with any field content will be preserved.
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={gridActions.cancelClearTable}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={gridActions.confirmClearEmpty}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Clear Empty
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};