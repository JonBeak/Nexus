import React from 'react';
import { AlertTriangle, Lock, Save, Trash2, RotateCcw, Eraser } from 'lucide-react';
import { GridState } from '../hooks/useSimpleGridState';
import { GridActions } from '../hooks/useGridActions';
import { EditLockIndicator } from '../../common/EditLockIndicator';

interface GridHeaderProps {
  gridState: GridState;
  gridActions: GridActions;
  user: any;
  estimate?: any;
  versioningMode?: boolean;
  isCreatingNew: boolean;
  onBackToEstimates: () => void;
  editLock?: any; // From useEditLock hook
}

export const GridHeader: React.FC<GridHeaderProps> = ({
  gridState,
  gridActions,
  user,
  estimate,
  versioningMode = false,
  isCreatingNew,
  onBackToEstimates,
  editLock
}) => {

  return (
    <div className="px-6 py-4 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {versioningMode 
              ? 'Job Estimate'
              : (isCreatingNew ? 'New Job Estimate' : 'Edit Job Estimate')
            }
          </h2>
          
          {/* Status indicators */}
          <div className="flex items-center mt-1 space-x-3">
            {/* Edit lock status */}
            {versioningMode && editLock && (
              <EditLockIndicator
                lockStatus={editLock.lockStatus}
                hasLock={editLock.hasLock}
                isLoading={editLock.isLoading}
                canOverride={editLock.canOverride}
                onOverride={editLock.overrideLock}
                compact={true}
                showDetails={false}
              />
            )}
            
            {gridState.hasUnsavedChanges && !gridState.effectiveReadOnly && (
              <div className="flex items-center text-orange-600 text-sm">
                <AlertTriangle className="w-4 h-4 mr-1" />
                {gridState.saving ? 'Saving...' : 'Unsaved changes'}
              </div>
            )}
            
            {gridState.lastSaved && !gridState.hasUnsavedChanges && versioningMode && (
              <div className="flex items-center text-green-600 text-sm">
                <span>Last saved: {gridState.lastSaved.toLocaleTimeString()}</span>
              </div>
            )}
            
            
            {gridState.effectiveReadOnly && (
              <div className="flex items-center text-gray-500 text-sm">
                <Lock className="w-4 h-4 mr-1" />
                Read-only mode
              </div>
            )}
            
            {versioningMode && estimate?.display_status && (
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                estimate.is_draft 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {estimate.display_status}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {!gridState.effectiveReadOnly && gridState.rows.length > 0 && (
            <>
              <button
                onClick={gridActions.handleClearTable}
                className="flex items-center space-x-2 px-3 py-2 text-orange-600 hover:text-orange-900 border border-orange-300 rounded hover:bg-orange-50"
                title="Reset all items to default state"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
              
              <button
                onClick={gridActions.handleShowClearAll}
                className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:text-red-900 border border-red-300 rounded hover:bg-red-50"
                title="Permanently delete all rows"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All</span>
              </button>
              
              <button
                onClick={gridActions.handleShowClearEmpty}
                className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-900 border border-blue-300 rounded hover:bg-blue-50"
                title="Remove empty rows with no input data"
              >
                <Eraser className="w-4 h-4" />
                <span>Clear Empty</span>
              </button>
            </>
          )}
          
          {!versioningMode && (
            <button
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              disabled={gridState.effectiveReadOnly}
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};