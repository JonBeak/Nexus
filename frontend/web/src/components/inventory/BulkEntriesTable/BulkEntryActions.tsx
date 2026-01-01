import React from 'react';
import { Plus } from 'lucide-react';
import { BulkEntry } from '../../../hooks/useBulkEntries';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

interface BulkEntryActionsProps {
  bulkEntries: BulkEntry[];
  isSaving: boolean;
  onAddEntry: () => void;
}

/**
 * Action buttons and status display for bulk entries table
 */
export const BulkEntryActions: React.FC<BulkEntryActionsProps> = ({
  bulkEntries,
  isSaving,
  onAddEntry
}) => {
  const successCount = bulkEntries.filter(e => e.submissionState === 'success').length;
  const errorCount = bulkEntries.filter(e => e.submissionState === 'error').length;

  return (
    <div className={`px-6 py-4 border-b ${PAGE_STYLES.panel.border}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Bulk Entries</h3>

          {/* Status counts */}
          <div className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
            {successCount > 0 && (
              <span className="text-green-600 font-medium">
                {successCount} successful
              </span>
            )}
            {errorCount > 0 && (
              <span className="text-red-600 font-medium ml-2">
                {errorCount} failed
              </span>
            )}
            {isSaving && (
              <span className={`${PAGE_STYLES.panel.textMuted} italic ml-2`}>
                Saving changes...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Entry Button */}
          <button
            onClick={onAddEntry}
            className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${MODULE_COLORS.vinyls.base} ${MODULE_COLORS.vinyls.hover} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Entry
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEntryActions;