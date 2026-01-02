import React from 'react';
import type { BulkEditValues } from '../../../types/time';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

const TIME_COLORS = MODULE_COLORS.timeTracking;

interface BulkEditModalProps {
  selectedEntries: number[];
  bulkEditValues: BulkEditValues;
  onBulkEditValuesChange: (values: BulkEditValues) => void;
  onApplyChanges: () => void;
  onClose: () => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  selectedEntries,
  bulkEditValues,
  onBulkEditValuesChange,
  onApplyChanges,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-md w-full mx-4`}>
        <div className={`px-6 py-4 border-b ${PAGE_STYLES.panel.border}`}>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>
            Bulk Edit {selectedEntries.length} Entries
          </h3>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
              Clock In (Leave empty to keep current)
            </label>
            <input
              type="datetime-local"
              value={bulkEditValues.clock_in || ''}
              onChange={(e) => onBulkEditValuesChange({ ...bulkEditValues, clock_in: e.target.value || undefined })}
              className={`w-full px-3 py-2 ${PAGE_STYLES.input.border} rounded-md ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
              Clock Out (Leave empty to keep current)
            </label>
            <input
              type="datetime-local"
              value={bulkEditValues.clock_out || ''}
              onChange={(e) => onBulkEditValuesChange({ ...bulkEditValues, clock_out: e.target.value || undefined })}
              className={`w-full px-3 py-2 ${PAGE_STYLES.input.border} rounded-md ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
              Break Minutes (Leave empty to keep current)
            </label>
            <input
              type="number"
              min="0"
              max="480"
              placeholder="e.g. 30"
              value={bulkEditValues.break_minutes || ''}
              onChange={(e) => onBulkEditValuesChange({
                ...bulkEditValues,
                break_minutes: e.target.value ? Number(e.target.value) : undefined
              })}
              className={`w-full px-3 py-2 ${PAGE_STYLES.input.border} rounded-md ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}`}
            />
          </div>
        </div>

        <div className={`px-6 py-4 ${PAGE_STYLES.header.background} flex justify-end space-x-3 rounded-b-lg`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.panel.background} ${PAGE_STYLES.input.border} border rounded-md ${PAGE_STYLES.interactive.hover}`}
          >
            Cancel
          </button>
          <button
            onClick={onApplyChanges}
            className={`px-4 py-2 text-sm font-medium text-white ${TIME_COLORS.base} rounded-md ${TIME_COLORS.hover}`}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
