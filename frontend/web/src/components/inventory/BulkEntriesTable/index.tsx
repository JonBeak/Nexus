import React, { useCallback } from 'react';
import { BulkEntry } from '../../../hooks/useBulkEntries';
import { JobSuggestion, VinylItem, VinylAutofillSuggestions } from '../types';
import { BulkEntryHeader } from './BulkEntryHeader';
import { BulkEntryActions } from './BulkEntryActions';
import { BulkEntryRow } from './BulkEntryRow';
import { useBulkEntryTable } from './hooks/useBulkEntryTable';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface BulkEntriesTableProps {
  bulkEntries: BulkEntry[];
  vinylItems: VinylItem[];
  bulkAutofillSuggestions: VinylAutofillSuggestions;
  availableJobs: JobSuggestion[];
  isSaving: boolean;
  bulkLoadingSuggestions: boolean;
  updateBulkEntry: (id: string, updates: Partial<BulkEntry>) => void;
  removeBulkEntry: (id: string) => void;
  addNewBulkEntry: () => void;
  handleJobChange: (entryId: string, jobIndex: number, value: string) => void;
  removeJobField: (entryId: string, jobIndex: number) => void;
  ensureSuggestionsLoaded?: () => void;
}

/**
 * Refactored bulk entries table component
 */
export const BulkEntriesTable: React.FC<BulkEntriesTableProps> = ({
  bulkEntries,
  vinylItems,
  bulkAutofillSuggestions,
  availableJobs,
  isSaving,
  bulkLoadingSuggestions,
  updateBulkEntry,
  removeBulkEntry,
  addNewBulkEntry,
  handleJobChange,
  removeJobField,
  ensureSuggestionsLoaded
}) => {
  // Use custom hook for table logic
  const {
    suggestionCache,
    createTabHandler,
    handleVinylProductChange,
    handleSpecificVinylSelect,
    handleBulkEntryChange
  } = useBulkEntryTable({
    bulkEntries,
    vinylItems,
    bulkAutofillSuggestions,
    updateBulkEntry,
    addNewBulkEntry
  });

  // Handler to apply type to all non-submitting rows
  const handleBulkTypeChange = useCallback((type: BulkEntry['type']) => {
    bulkEntries.forEach(entry => {
      if (entry.submissionState !== 'submitting' && entry.submissionState !== 'success') {
        updateBulkEntry(entry.id, { type });
      }
    });
  }, [bulkEntries, updateBulkEntry]);

  return (
    <div className="space-y-4">
      {/* Auto-save indicator */}
      {isSaving && (
        <div className={`text-sm ${PAGE_STYLES.panel.textSecondary} italic`}>
          Saving changes...
        </div>
      )}

      {/* Bulk Entries Table */}
      <div className={`${PAGE_STYLES.panel.background} shadow rounded-lg overflow-hidden border ${PAGE_STYLES.panel.border}`}>
        <BulkEntryActions
          bulkEntries={bulkEntries}
          isSaving={isSaving}
          onAddEntry={addNewBulkEntry}
        />

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className={`w-full ${PAGE_STYLES.panel.divider} text-sm`} style={{ minWidth: '1200px' }}>
              <BulkEntryHeader onBulkTypeChange={handleBulkTypeChange} />

              <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.divider}`}>
                {bulkEntries.map((entry) => (
                  <BulkEntryRow
                    key={entry.id}
                    entry={entry}
                    vinylItems={vinylItems}
                    bulkAutofillSuggestions={bulkAutofillSuggestions}
                    availableJobs={availableJobs}
                    bulkLoadingSuggestions={bulkLoadingSuggestions}
                    widthSuggestions={suggestionCache.get(entry.id)?.width || []}
                    lengthSuggestions={suggestionCache.get(entry.id)?.length_yards || []}
                    canDelete={bulkEntries.length > 1}
                    onUpdateEntry={(updates) => updateBulkEntry(entry.id, updates)}
                    onRemoveEntry={() => removeBulkEntry(entry.id)}
                    onFieldChange={(field, value) => handleBulkEntryChange(entry.id, field, value)}
                    onVinylProductChange={(value) => handleVinylProductChange(entry.id, value)}
                    onSpecificVinylSelect={(item) => handleSpecificVinylSelect(entry.id, item)}
                    onJobChange={(jobIndex, value) => handleJobChange(entry.id, jobIndex, value)}
                    onRemoveJob={(jobIndex) => removeJobField(entry.id, jobIndex)}
                    onTabPress={(field) => createTabHandler(entry.id, field)()}
                    onSuggestionsNeeded={ensureSuggestionsLoaded}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEntriesTable;