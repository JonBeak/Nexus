import { useCallback, useMemo } from 'react';
import { BulkEntry } from '../../../../hooks/useBulkEntries';
import { VinylItem, VinylAutofillSuggestions } from '../../types';
import {
  buildColourMapping,
  buildSuggestionCache
} from '../../../../services/bulkEntry/bulkEntrySuggestions';
import {
  processFieldChange,
  processVinylProductChange,
  shouldAutoAddEntry
} from '../../../../services/bulkEntry/bulkEntryLogic';
import { TIMING } from '../../../../constants/bulkEntryConstants';

// Field order for tab navigation
const TAB_FIELD_ORDER = ['type', 'vinyl_product', 'width', 'length_yards', 'location', 'jobs', 'notes'] as const;

interface UseBulkEntryTableProps {
  bulkEntries: BulkEntry[];
  vinylItems: VinylItem[];
  bulkAutofillSuggestions: VinylAutofillSuggestions;
  updateBulkEntry: (id: string, updates: Partial<BulkEntry>) => void;
  addNewBulkEntry: () => void;
}

/**
 * Custom hook for bulk entry table logic
 */
export function useBulkEntryTable({
  bulkEntries,
  vinylItems,
  bulkAutofillSuggestions,
  updateBulkEntry,
  addNewBulkEntry
}: UseBulkEntryTableProps) {
  // Build color mapping function
  const getColourMapping = useCallback((brand: string, series: string) => {
    return buildColourMapping(
      vinylItems,
      bulkAutofillSuggestions.combinations || [],
      brand,
      series
    );
  }, [vinylItems, bulkAutofillSuggestions.combinations]);

  // Build suggestion cache
  const suggestionCache = useMemo(() => {
    return buildSuggestionCache(bulkEntries, vinylItems, bulkAutofillSuggestions);
  }, [bulkEntries, vinylItems, bulkAutofillSuggestions]);

  // Tab navigation handler - memoized
  const createTabHandler = useCallback((entryId: string, currentField: string) => {
    const currentIndex = TAB_FIELD_ORDER.indexOf(currentField as typeof TAB_FIELD_ORDER[number]);

    return () => {
      const nextFieldIndex = currentIndex + 1;

      if (nextFieldIndex < TAB_FIELD_ORDER.length) {
        // Move to next field in same row
        const nextField = TAB_FIELD_ORDER[nextFieldIndex];
        const nextElement = document.querySelector(`[data-field="${entryId}-${nextField}"]`) as HTMLElement;

        if (nextElement) {
          nextElement.focus();
          return;
        }

        // If next field doesn't exist, try name-based selector
        const autoFillElement = document.querySelector(`[name="${entryId}-${nextField}"]`) as HTMLElement;
        if (autoFillElement) {
          autoFillElement.focus();
          return;
        }
      }

      // Move to next row (first field of next entry)
      const entryIndex = bulkEntries.findIndex(e => e.id === entryId);
      if (entryIndex < bulkEntries.length - 1) {
        const nextEntryId = bulkEntries[entryIndex + 1].id;
        const firstFieldElement = document.querySelector(`[data-field="${nextEntryId}-type"]`) as HTMLElement;
        if (firstFieldElement) {
          firstFieldElement.focus();
          return;
        }
      }

      // If we're on the last row, add a new entry and focus it
      if (entryIndex === bulkEntries.length - 1) {
        addNewBulkEntry();

        // Focus the new entry after a short delay to ensure it's rendered
        setTimeout(() => {
          const entries = [...bulkEntries]; // Get current state
          const newEntryId = entries[entries.length - 1]?.id;
          const firstFieldElement = document.querySelector(`[data-field="${newEntryId}-type"]`) as HTMLElement;
          if (firstFieldElement) {
            firstFieldElement.focus();
          }
        }, TIMING.FOCUS_DELAY);
      }
    };
  }, [bulkEntries, addNewBulkEntry]);

  // Handle vinyl product change
  const handleVinylProductChange = useCallback((entryId: string, value: {
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  }) => {
    const entry = bulkEntries.find(e => e.id === entryId);
    if (!entry) return;

    const result = processVinylProductChange(entry, value, vinylItems, bulkAutofillSuggestions);
    const { shouldShowSpecificSelector, ...updates } = result;

    updateBulkEntry(entryId, updates);

    // Check if should auto-add new entry
    const entryIndex = bulkEntries.findIndex(e => e.id === entryId);
    const isLastEntry = entryIndex === bulkEntries.length - 1;

    if (shouldAutoAddEntry({ ...entry, ...updates }, isLastEntry)) {
      setTimeout(() => addNewBulkEntry(), TIMING.AUTO_ADD_DELAY);
    }

    return shouldShowSpecificSelector;
  }, [bulkEntries, vinylItems, bulkAutofillSuggestions, updateBulkEntry, addNewBulkEntry]);

  // Handle specific vinyl selection
  const handleSpecificVinylSelect = useCallback((entryId: string, vinylItem: VinylItem) => {
    updateBulkEntry(entryId, {
      specific_vinyl_id: vinylItem.id,
      width: vinylItem.width?.toString() || '',
      length_yards: vinylItem.length_yards?.toString() || '',
      notes: vinylItem.notes || ''
    });
  }, [updateBulkEntry]);

  // Handle field changes with smart autofill
  const handleBulkEntryChange = useCallback((entryId: string, field: keyof BulkEntry, value: string) => {
    const entry = bulkEntries.find(e => e.id === entryId);
    if (!entry) return;

    const updates = processFieldChange(entry, field, value, getColourMapping);
    updateBulkEntry(entryId, updates);

    // Check if should auto-add new entry
    const entryIndex = bulkEntries.findIndex(e => e.id === entryId);
    const isLastEntry = entryIndex === bulkEntries.length - 1;
    const updatedEntry = { ...entry, ...updates };

    if (shouldAutoAddEntry(updatedEntry, isLastEntry, field)) {
      setTimeout(() => addNewBulkEntry(), TIMING.AUTO_ADD_DELAY);
    }
  }, [bulkEntries, getColourMapping, updateBulkEntry, addNewBulkEntry]);

  return {
    suggestionCache,
    createTabHandler,
    handleVinylProductChange,
    handleSpecificVinylSelect,
    handleBulkEntryChange
  };
}