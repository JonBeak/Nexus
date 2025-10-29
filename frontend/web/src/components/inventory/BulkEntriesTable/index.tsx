import React from 'react';
import { BulkEntry } from '../../../hooks/useBulkEntries';
import { JobSuggestion, VinylItem, VinylAutofillSuggestions } from '../types';
import { BulkEntryHeader } from './BulkEntryHeader';
import { BulkEntryActions } from './BulkEntryActions';
import { BulkEntryRow } from './BulkEntryRow';
import { useBulkEntryTable } from './hooks/useBulkEntryTable';

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

  return (
    <div className="space-y-4">
      {/* Auto-save indicator */}
      {isSaving && (
        <div className="text-sm text-gray-600 italic">
          Saving changes...
        </div>
      )}

      {/* Bulk Entries Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <BulkEntryActions
          bulkEntries={bulkEntries}
          isSaving={isSaving}
          onAddEntry={addNewBulkEntry}
        />

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full divide-y divide-gray-200 text-sm" style={{ minWidth: '1200px' }}>
              <BulkEntryHeader />

              <tbody className="bg-white divide-y divide-gray-200">
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