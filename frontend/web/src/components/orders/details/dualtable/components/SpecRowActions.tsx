/**
 * SpecRowActions Component
 *
 * Hover-only actions for individual specification rows:
 * - Insert After (+): Inserts blank row after this row
 * - Delete/Clear (-):
 *   - Multiple rows exist: Deletes this row with confirmation (if has data)
 *   - Only one row remains with data: Clears the row (resets to "Select...")
 *   - Only one row remains and empty: Button disabled
 *
 * Only visible when hovering over the parent row.
 */

import React, { useState } from 'react';
import ConfirmationModal from '../../components/ConfirmationModal';

interface SpecRowActionsProps {
  partId: number;
  rowNum: number;
  totalRows: number;
  isRowEmpty: boolean;
  onInsertAfter: (partId: number, afterRowNum: number) => void;
  onDelete: (partId: number, rowNum: number) => void;
  onClear: (partId: number, rowNum: number) => void;
}

type ModalAction = 'clear' | 'delete' | null;

export const SpecRowActions: React.FC<SpecRowActionsProps> = ({
  partId,
  rowNum,
  totalRows,
  isRowEmpty,
  onInsertAfter,
  onDelete,
  onClear
}) => {
  const [pendingAction, setPendingAction] = useState<ModalAction>(null);
  const isOnlyRow = totalRows === 1;

  // Handle minus button click
  const handleMinusClick = () => {
    if (isOnlyRow && !isRowEmpty) {
      // Only remaining row with data: show confirmation modal before clearing
      setPendingAction('clear');
    } else if (!isRowEmpty) {
      // Multiple rows, this one has data: show confirmation modal before deleting
      setPendingAction('delete');
    } else if (!isOnlyRow) {
      // Empty row and not the only row: delete without confirmation
      onDelete(partId, rowNum);
    }
    // If it's the only row AND empty: do nothing (button should be disabled)
  };

  // Handle modal confirmation
  const handleConfirm = () => {
    if (pendingAction === 'clear') {
      onClear(partId, rowNum);
    } else if (pendingAction === 'delete') {
      onDelete(partId, rowNum);
    }
    setPendingAction(null);
  };

  // Determine if minus button should be disabled
  // Disabled when: it's the only row AND it's already empty
  const isMinusDisabled = isOnlyRow && isRowEmpty;

  // Determine tooltip text
  const getMinusTitle = () => {
    if (isOnlyRow && !isRowEmpty) {
      return `Clear row ${rowNum} (reset to Select...)`;
    }
    return `Delete row ${rowNum}`;
  };

  // Modal content based on action type
  const getModalContent = () => {
    if (pendingAction === 'clear') {
      return {
        title: 'Clear Specification Row',
        message: `This will reset row ${rowNum} to "Select..." and remove all data in this row.`,
        confirmText: 'Clear Row'
      };
    }
    return {
      title: 'Delete Specification Row',
      message: `Delete specification row ${rowNum}? This will remove all data in this row and cannot be undone.`,
      confirmText: 'Delete Row'
    };
  };

  const modalContent = getModalContent();

  return (
    <>
      <div className="flex items-center justify-center gap-1.5 h-[26px] px-1">
        <button
          onClick={() => onInsertAfter(partId, rowNum)}
          disabled={totalRows >= 20}
          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-500 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed rounded"
          title={`Insert blank row after row ${rowNum}`}
        >
          +
        </button>
        <button
          onClick={handleMinusClick}
          disabled={isMinusDisabled}
          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white bg-gray-500 hover:bg-gray-600 border border-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed rounded"
          title={getMinusTitle()}
        >
          −
        </button>
      </div>

      <ConfirmationModal
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirm}
        title={modalContent.title}
        message={modalContent.message}
        confirmText={modalContent.confirmText}
        confirmColor="blue"
      />
    </>
  );
};

export default SpecRowActions;
