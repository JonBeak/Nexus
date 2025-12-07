/**
 * SpecRowActions Component
 *
 * Hover-only actions for individual specification rows:
 * - Insert After (+): Inserts blank row after this row
 * - Delete (-): Removes this row with confirmation
 *
 * Only visible when hovering over the parent row.
 */

import React from 'react';

interface SpecRowActionsProps {
  partId: number;
  rowNum: number;
  totalRows: number;
  onInsertAfter: (partId: number, afterRowNum: number) => void;
  onDelete: (partId: number, rowNum: number) => void;
}

export const SpecRowActions: React.FC<SpecRowActionsProps> = ({
  partId,
  rowNum,
  totalRows,
  onInsertAfter,
  onDelete
}) => {
  return (
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
        onClick={() => onDelete(partId, rowNum)}
        disabled={totalRows <= 1}
        className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white bg-gray-500 hover:bg-gray-600 border border-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed rounded"
        title={`Delete row ${rowNum}`}
      >
        −
      </button>
    </div>
  );
};

export default SpecRowActions;
