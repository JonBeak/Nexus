import React from 'react';
import { AlertTriangle, Lock, Save, Trash2, RotateCcw, Eraser, Plus, Copy } from 'lucide-react';
import { GridEngine } from '../core/GridEngine';
import { getStatusColorClasses } from '../utils/statusUtils';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface GridHeaderProps {
  gridEngine: GridEngine;
  estimate?: any;
  versioningMode?: boolean;
  isCreatingNew: boolean;
  onReset: () => void;
  onClearAll: () => void;
  onClearEmpty: () => void;
  onAddSection: () => void;
  onCopyRows: () => void;
  onManualSave?: () => void;
}

export const GridHeader: React.FC<GridHeaderProps> = ({
  gridEngine,
  estimate,
  versioningMode = false,
  isCreatingNew,
  onReset,
  onClearAll,
  onClearEmpty,
  onAddSection,
  onCopyRows,
  onManualSave
}) => {
  // Subscribe to GridEngine state changes
  const [gridState, setGridState] = React.useState(gridEngine.getState());

  React.useEffect(() => {
    // Update state when GridEngine changes
    const updateState = () => {
      setGridState(gridEngine.getState());
    };

    // Initial update
    updateState();

    // Set up polling to check for state changes (temporary solution)
    const interval = setInterval(updateState, 100);

    return () => clearInterval(interval);
  }, [gridEngine]);


  return (
    <div className={`px-6 py-4 border-b ${PAGE_STYLES.border}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text}`}>
            {versioningMode 
              ? 'Job Estimate'
              : (isCreatingNew ? 'New Job Estimate' : 'Edit Job Estimate')
            }
          </h2>
          
          {/* Status indicators */}
          <div className="flex items-center mt-1 space-x-3">
            
            {gridState.hasUnsavedChanges && gridState.editMode !== 'readonly' && (
              <div className="flex items-center text-orange-600 text-sm">
                <AlertTriangle className="w-4 h-4 mr-1" />
                {gridState.isAutoSaving ? 'Saving...' : 'Unsaved changes'}
              </div>
            )}

            {versioningMode && !gridState.hasUnsavedChanges && (
              <div className="flex items-center text-green-600 text-sm">
                <span>
                  {gridState.lastSaved
                    ? `Last saved: ${gridState.lastSaved.toLocaleTimeString()}`
                    : 'Ready'
                  }
                </span>
              </div>
            )}


            {gridState.editMode === 'readonly' && (
              <div className={`flex items-center ${PAGE_STYLES.panel.textMuted} text-sm`}>
                <Lock className="w-4 h-4 mr-1" />
                Read-only mode
              </div>
            )}
            
            {versioningMode && estimate?.display_status && (
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                getStatusColorClasses(estimate.display_status)
              }`}>
                {estimate.display_status}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {gridState.editMode !== 'readonly' && (
            <>
              <button
                onClick={onReset}
                className="flex items-center space-x-1.5 px-2 py-1.5 text-sm text-orange-600 hover:text-orange-900 border border-orange-300 rounded hover:bg-orange-50"
                title="Reset all items to default state"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                onClick={onClearAll}
                className="flex items-center space-x-1.5 px-2 py-1.5 text-sm text-red-600 hover:text-red-900 border border-red-300 rounded hover:bg-red-50"
                title="Permanently delete all rows"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>

              <button
                onClick={onClearEmpty}
                className="flex items-center space-x-1.5 px-2 py-1.5 text-sm text-blue-600 hover:text-blue-900 border border-blue-300 rounded hover:bg-blue-50"
                title="Remove empty rows with no input data"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear Empty</span>
              </button>

              <button
                onClick={onAddSection}
                className="flex items-center space-x-1.5 px-2 py-1.5 text-sm text-purple-600 hover:text-purple-900 border border-purple-300 rounded hover:bg-purple-50"
                title="Add template section to the end of the grid"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Section</span>
              </button>

              <button
                onClick={onCopyRows}
                className="flex items-center space-x-1.5 px-2 py-1.5 text-sm text-green-700 hover:text-green-900 border border-green-500 rounded hover:bg-green-100"
                title="Copy rows from another estimate"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Rows</span>
              </button>
            </>
          )}

          {/* Save button hidden - auto-save handles persistence */}
          {/* Manual save functionality still available via onManualSave prop if needed */}
        </div>
      </div>
    </div>
  );
};
