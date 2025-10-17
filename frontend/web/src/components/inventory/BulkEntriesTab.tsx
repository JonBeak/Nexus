import React, { useMemo, useCallback } from 'react';
import { VinylItem, VinylAutofillSuggestions } from './types';
import { useBulkEntries } from '../../hooks/useBulkEntries';
import { BulkEntriesTable } from './BulkEntriesTable';
import { validateBulkEntries } from '../../utils/bulkEntryValidation';
import { submitBulkEntries } from '../../services/bulkEntrySubmission';

interface BulkEntriesTabProps {
  vinylItems: VinylItem[];
  onSuccess: () => void;
  showConfirmation: (title: string, message: string, onConfirm: () => void, type?: string, confirmText?: string) => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  bulkAutofillSuggestions: VinylAutofillSuggestions;
  bulkLoadingSuggestions: boolean;
}

export const BulkEntriesTab: React.FC<BulkEntriesTabProps> = ({
  vinylItems,
  onSuccess,
  showConfirmation,
  showNotification,
  bulkAutofillSuggestions,
  bulkLoadingSuggestions
}) => {
  const {
    bulkEntries,
    availableJobs,
    isSaving,
    addNewBulkEntry,
    updateBulkEntry,
    removeBulkEntry,
    clearAllBulkEntries,
    removeBulkEntriesByIds,
    clearSuccessfulEntries,
    updateMultipleSubmissionStates,
    handleJobChange,
    removeJobField
  } = useBulkEntries();

  // Parent (VinylInventory) handles loading suggestions on mount
  // No need to duplicate loading logic here

  // Count valid entries for display
  const validEntryCount = useMemo(() => {
    return bulkEntries.filter(entry => 
      entry.type && 
      entry.brand && 
      entry.series && 
      (entry.colour_number || entry.colour_name) &&
      entry.width && 
      entry.length_yards &&
      parseFloat(entry.length_yards) > 0
    ).length;
  }, [bulkEntries]);

  // Handle bulk submission
  const handleSubmitBulkEntries = async () => {
    // Filter valid entries
    const validEntries = bulkEntries.filter(entry => 
      entry.type && 
      entry.brand && 
      entry.series && 
      (entry.colour_number || entry.colour_name) &&
      entry.width && 
      entry.length_yards &&
      parseFloat(entry.length_yards) > 0
    );

    if (validEntries.length === 0) {
      showNotification('No valid entries to submit', 'error');
      return;
    }

    // Pre-validate entries
    const validationErrors = validateBulkEntries(validEntries, vinylItems);
    if (validationErrors.length > 0) {
      showConfirmation(
        'Validation Errors Found',
        `The following errors were found:\n\n${validationErrors.join('\n')}\n\nDo you want to fix these issues first?`,
        () => {}, // Do nothing if they confirm - just close the dialog
        'error',
        'Fix Issues'
      );
      return;
    }

    // Show confirmation dialog
    showConfirmation(
      'Submit Bulk Entries',
      `Submit ${validEntries.length} bulk entries?`,
      async () => {
        // Set all valid entries to submitting state
        const validEntries = bulkEntries.filter(entry => 
          entry.type && 
          entry.brand && 
          entry.series && 
          (entry.colour_number || entry.colour_name) &&
          entry.width && 
          entry.length_yards &&
          parseFloat(entry.length_yards) > 0
        );
        
        const submittingStates = validEntries.map(entry => ({
          id: entry.id,
          state: 'submitting' as const,
          error: undefined
        }));
        
        updateMultipleSubmissionStates(submittingStates);
        
        const result = await submitBulkEntries(
          bulkEntries,
          vinylItems,
          availableJobs,
          showNotification
        );

        // Update submission states based on results
        const stateUpdates = result.results.map(r => ({
          id: r.entryId!,
          state: r.success ? 'success' as const : 'error' as const,
          error: r.error
        }));
        
        updateMultipleSubmissionStates(stateUpdates);
        
        if (result.success) {
          // Wait briefly to show success states, then remove successful entries
          setTimeout(() => {
            if (result.successfulEntryIds.length > 0) {
              removeBulkEntriesByIds(result.successfulEntryIds);
              
              if (result.failCount > 0) {
                showNotification(
                  `${result.successCount} entries processed successfully. ${result.failCount} entries failed - please review and resubmit.`,
                  'success'
                );
              }
            }
          }, 1500); // Show success states for 1.5 seconds
          
          // Refresh parent component data
          onSuccess();
        } else if (result.failCount > 0) {
          const failedEntries = result.results.filter(r => !r.success);
          const errorMessage = `${result.failCount} entries failed: ${failedEntries.map(f => f.error).join('; ')}`;
          showNotification(errorMessage, 'error');
        }
      },
      'success',
      'Submit'
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
      {/* Header with summary and actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {validEntryCount} valid entries ready for submission
          {isSaving && <span className="ml-2 text-purple-600 italic">Auto-saving...</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearAllBulkEntries}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            Clear All
          </button>
          <button
            onClick={handleSubmitBulkEntries}
            disabled={validEntryCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Submit {validEntryCount} Entries
          </button>
        </div>
      </div>

      {/* Bulk entries table */}
      <BulkEntriesTable
        bulkEntries={bulkEntries}
        vinylItems={vinylItems}
        bulkAutofillSuggestions={bulkAutofillSuggestions}
        availableJobs={availableJobs}
        isSaving={isSaving}
        bulkLoadingSuggestions={bulkLoadingSuggestions}
        updateBulkEntry={updateBulkEntry}
        removeBulkEntry={removeBulkEntry}
        addNewBulkEntry={addNewBulkEntry}
        handleJobChange={handleJobChange}
        removeJobField={removeJobField}
        clearSuccessfulEntries={clearSuccessfulEntries}
      />

    </div>
  );
};
