/**
 * Confirmation modal dialogs for grid operations
 */

import React from 'react';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface GridConfirmationModalsProps {
  // Clear confirmation modal state
  showClearConfirmation: boolean;
  clearModalType: 'reset' | 'clearAll' | 'clearEmpty' | null;
  onClearCancel: () => void;
  onReset: () => void;
  onClearAll: () => void;
  onClearEmpty: () => void;

  // Row confirmation modal state
  showRowConfirmation: boolean;
  rowConfirmationType: 'clear' | 'delete' | null;
  pendingRowIndex: number | null;
  onRowCancel: () => void;
  onClearRow: () => void;
  onDeleteRow: () => void;
}

/**
 * Renders confirmation modals for grid-level and row-level operations.
 * Handles both "clear" operations (reset/clearAll/clearEmpty) and row operations (clear/delete).
 */
export const GridConfirmationModals: React.FC<GridConfirmationModalsProps> = ({
  showClearConfirmation,
  clearModalType,
  onClearCancel,
  onReset,
  onClearAll,
  onClearEmpty,
  showRowConfirmation,
  rowConfirmationType,
  pendingRowIndex,
  onRowCancel,
  onClearRow,
  onDeleteRow
}) => {
  return (
    <>
      {/* Grid-level clear confirmation modal */}
      {showClearConfirmation && clearModalType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg p-6 max-w-md w-full mx-4`}>
            <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text} mb-4`}>
              {clearModalType === 'reset' && 'Reset Grid to Default Template?'}
              {clearModalType === 'clearAll' && 'Clear All Items?'}
              {clearModalType === 'clearEmpty' && 'Clear Empty Rows?'}
            </h3>
            <p className={`${PAGE_STYLES.panel.textMuted} mb-6`}>
              {clearModalType === 'reset' && 'This will reset all items to the default template configuration. Your current data will be lost.'}
              {clearModalType === 'clearAll' && 'This will permanently delete all items in the grid. This action cannot be undone.'}
              {clearModalType === 'clearEmpty' && 'This will remove all empty rows with no input data.'}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClearCancel}
                className={`px-4 py-2 ${PAGE_STYLES.panel.textMuted} border ${PAGE_STYLES.border} rounded ${PAGE_STYLES.interactive.hover}`}
              >
                Cancel
              </button>
              <button
                onClick={clearModalType === 'reset' ? onReset : clearModalType === 'clearAll' ? onClearAll : onClearEmpty}
                className={`px-4 py-2 text-white rounded ${
                  clearModalType === 'reset' ? 'bg-orange-600 hover:bg-orange-700' :
                  clearModalType === 'clearAll' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {clearModalType === 'reset' && 'Reset'}
                {clearModalType === 'clearAll' && 'Clear All'}
                {clearModalType === 'clearEmpty' && 'Clear Empty'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row-level confirmation modal for clear and delete actions */}
      {showRowConfirmation && rowConfirmationType && pendingRowIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg p-6 max-w-md w-full mx-4`}>
            <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text} mb-4`}>
              {rowConfirmationType === 'clear' && 'Clear Row Data?'}
              {rowConfirmationType === 'delete' && 'Delete Row?'}
            </h3>
            <p className={`${PAGE_STYLES.panel.textMuted} mb-6`}>
              {rowConfirmationType === 'clear' && 'This will reset all editable fields in this row. The product type selection will remain.'}
              {rowConfirmationType === 'delete' && 'This will permanently remove this row from the grid. This action cannot be undone.'}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onRowCancel}
                className={`px-4 py-2 ${PAGE_STYLES.panel.textMuted} border ${PAGE_STYLES.border} rounded ${PAGE_STYLES.interactive.hover}`}
              >
                Cancel
              </button>
              <button
                onClick={rowConfirmationType === 'clear' ? onClearRow : onDeleteRow}
                className={`px-4 py-2 text-white rounded ${
                  rowConfirmationType === 'clear'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {rowConfirmationType === 'clear' && 'Clear'}
                {rowConfirmationType === 'delete' && 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
