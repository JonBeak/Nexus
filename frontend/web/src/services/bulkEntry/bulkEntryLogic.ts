import { BulkEntry } from '../../hooks/useBulkEntries';
import { VinylItem, VinylAutofillSuggestions } from '../../components/inventory/types';
import { ENTRY_TYPE_STYLES, SUBMISSION_STATE_STYLES, FIELD_CONFIG } from '../../constants/bulkEntryConstants';
import { getBulkSuggestions } from './bulkEntrySuggestions';

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

    // Clear width and length when changing to a usage mode (since they're now disabled and must come from specific vinyl)
    if (USE_AUTOFILL_TYPES.has(value as BulkEntry['type'])) {
      updates.width = '';
      updates.length_yards = '';
    }

    const prefix = getNotePlaceholder(value as BulkEntry['type']);
    const currentNotes = entry.notes || '';
    const startsWithPrefix = FIELD_CONFIG.TYPE_PREFIXES.some(p => currentNotes.startsWith(p));

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

  // Check if vinyl specifications have changed (brand, series, or colour)
  const specsChanged =
    entry.brand !== value.brand ||
    entry.series !== value.series ||
    entry.colour_number !== value.colour_number ||
    entry.colour_name !== value.colour_name;

  // Clear specific vinyl selection if clearing or if specifications changed
  if (isClearingSelection || specsChanged) {
    baseUpdates.specific_vinyl_id = undefined;

    // In usage modes, also clear width and length when specific vinyl is deselected
    if (['use', 'waste', 'returned', 'damaged'].includes(entry.type)) {
      baseUpdates.width = '';
      baseUpdates.length_yards = '';
    }
  }

  const updatedEntry = { ...entry, ...baseUpdates };

  // Auto-fill width if only one option (but not in usage modes where it must come from specific vinyl)
  const isUsageMode = ['use', 'waste', 'returned', 'damaged'].includes(entry.type);
  if (!isClearingSelection && !isUsageMode && !updatedEntry.width?.trim()) {
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
  if (entry.submissionState === 'submitting') return SUBMISSION_STATE_STYLES.submitting;
  if (entry.submissionState === 'success') return SUBMISSION_STATE_STYLES.success;
  if (entry.submissionState === 'error') return SUBMISSION_STATE_STYLES.error;

  // Validation error
  if (hasValidationError) return SUBMISSION_STATE_STYLES.validation_error;

  // Entry type colors
  if (entry.type && entry.type in ENTRY_TYPE_STYLES) {
    return ENTRY_TYPE_STYLES[entry.type as keyof typeof ENTRY_TYPE_STYLES];
  }

  return '';
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

