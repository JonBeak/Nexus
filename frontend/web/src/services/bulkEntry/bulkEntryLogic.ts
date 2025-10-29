import { BulkEntry } from '../../hooks/useBulkEntries';
import { VinylItem, VinylAutofillSuggestions } from '../../components/inventory/types';

// Constants
export const USE_AUTOFILL_TYPES = new Set<BulkEntry['type']>(['use', 'waste', 'returned', 'damaged']);
export const DEFAULT_WIDTH_OPTIONS = ['48', '24', '60', '54', '12'];

/**
 * Get the placeholder text for notes field based on entry type
 */
export function getNotePlaceholder(type: BulkEntry['type']): string {
  switch (type) {
    case 'store':
      return 'Storage: ';
    case 'use':
      return 'Usage: ';
    case 'waste':
      return 'Waste: ';
    case 'returned':
      return 'Return: ';
    case 'damaged':
      return 'Damage: ';
    default:
      return '';
  }
}

/**
 * Process smart autofill logic for field changes
 */
export function processFieldChange(
  entry: BulkEntry,
  field: keyof BulkEntry,
  value: string,
  getColourMapping: (brand: string, series: string) => { numberToName: Record<string, string>; nameToNumber: Record<string, string> }
): Partial<BulkEntry> {
  const updates: Partial<BulkEntry> = { [field]: value };

  // Type change logic
  if (field === 'type') {
    if (value !== 'store') {
      updates.location = '';
    }

    const prefix = getNotePlaceholder(value as BulkEntry['type']);
    const currentNotes = entry.notes || '';
    const prefixes = ['Storage: ', 'Usage: ', 'Waste: ', 'Return: ', 'Damage: '];
    const startsWithPrefix = prefixes.some(p => currentNotes.startsWith(p));

    if (!currentNotes || startsWithPrefix) {
      updates.notes = prefix + (startsWithPrefix ? currentNotes.substring(currentNotes.indexOf(' ') + 1) : currentNotes);
    }
  }

  // Color number change logic
  if (field === 'colour_number') {
    const updatedEntry = { ...entry, ...updates };

    if (value && !updatedEntry.colour_name && updatedEntry.brand && updatedEntry.series) {
      const contextualMapping = getColourMapping(updatedEntry.brand, updatedEntry.series);
      const colourName = contextualMapping.numberToName[value];
      if (colourName) {
        updates.colour_name = colourName;
      }
    }
  }

  // Color name change logic
  if (field === 'colour_name') {
    const updatedEntry = { ...entry, ...updates };

    if (value && !updatedEntry.colour_number && updatedEntry.brand && updatedEntry.series) {
      const contextualMapping = getColourMapping(updatedEntry.brand, updatedEntry.series);
      const colourNumber = contextualMapping.nameToNumber[value];
      if (colourNumber) {
        updates.colour_number = colourNumber;
      }
    }
  }

  return updates;
}

/**
 * Process vinyl product selection and apply autofill logic
 */
export function processVinylProductChange(
  entry: BulkEntry,
  value: {
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  },
  vinylItems: VinylItem[],
  bulkAutofillSuggestions: VinylAutofillSuggestions
): Partial<BulkEntry> & { shouldShowSpecificSelector?: boolean } {
  const baseUpdates: Partial<BulkEntry> = {
    brand: value.brand,
    series: value.series,
    colour_number: value.colour_number,
    colour_name: value.colour_name
  };

  const isClearingSelection = !value.brand && !value.series && !value.colour_number && !value.colour_name;
  if (isClearingSelection) {
    baseUpdates.specific_vinyl_id = undefined;
  }

  const updatedEntry = { ...entry, ...baseUpdates };

  // Auto-fill width if only one option
  if (!isClearingSelection && !updatedEntry.width?.trim()) {
    const widthSuggestions = getBulkSuggestions('', 'width', updatedEntry, vinylItems, bulkAutofillSuggestions);
    if (widthSuggestions.length === 1) {
      baseUpdates.width = widthSuggestions[0];
    }
  }

  // Determine if we should show specific selector
  const shouldShowSpecificSelector = !isClearingSelection &&
    (entry.type === 'use' || entry.type === 'waste' || entry.type === 'returned' || entry.type === 'damaged') &&
    value.brand && value.series && (value.colour_number || value.colour_name);

  return { ...baseUpdates, shouldShowSpecificSelector };
}

/**
 * Get row background color based on entry state
 */
export function getRowBackgroundColor(entry: BulkEntry, hasValidationError: boolean): string {
  // Submission state takes priority
  if (entry.submissionState === 'submitting') return 'bg-blue-50 border-l-4 border-blue-400';
  if (entry.submissionState === 'success') return 'bg-green-100 border-l-4 border-green-500';
  if (entry.submissionState === 'error') return 'bg-red-100 border-l-4 border-red-500';

  // Validation error
  if (hasValidationError) return 'bg-red-50 border-l-4 border-red-400';

  // Entry type colors
  switch (entry.type) {
    case 'store': return 'bg-green-50 border-l-4 border-green-300';
    case 'use': return 'bg-red-50 border-l-4 border-red-300';
    case 'waste': return 'bg-orange-50 border-l-4 border-orange-300';
    case 'returned': return 'bg-blue-50 border-l-4 border-blue-300';
    case 'damaged': return 'bg-purple-50 border-l-4 border-purple-300';
    default: return '';
  }
}

/**
 * Check if the last entry should trigger auto-add
 */
export function shouldAutoAddEntry(
  entry: BulkEntry,
  isLastEntry: boolean,
  field?: keyof BulkEntry
): boolean {
  if (!isLastEntry) return false;

  // Check if essential fields are filled
  const hasEssentialFields = entry.brand && entry.series &&
    (entry.colour_number || entry.colour_name);

  // For vinyl product changes
  if (!field) {
    return hasEssentialFields;
  }

  // For width field changes
  if (field === 'width' && entry.width?.trim()) {
    return hasEssentialFields;
  }

  return false;
}

// Re-export utility functions that will be moved to bulkEntrySuggestions.ts
export { getBulkSuggestions } from '../../utils/bulkEntryValidation';