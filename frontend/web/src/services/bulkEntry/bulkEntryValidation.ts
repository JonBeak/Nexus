import { BulkEntry } from '../../hooks/useBulkEntries';
import { VinylItem } from '../../components/inventory/types';

/**
 * Check if a bulk entry has matching inventory
 */
export function hasMatchingInventory(entry: BulkEntry, vinylItems: VinylItem[]): boolean | null {
  // Only validate 'use' type entries
  if (entry.type !== 'use') return null;

  // Need minimum fields to validate
  if (!entry.brand || !entry.series || (!entry.colour_number && !entry.colour_name) || !entry.width) {
    return null;
  }

  // If specific vinyl is selected, check if it's still available
  if (entry.specific_vinyl_id) {
    return vinylItems.some(vinyl =>
      vinyl.id === entry.specific_vinyl_id &&
      vinyl.disposition === 'in_stock'
    );
  }

  // Find matching vinyl (legacy matching)
  const hasMatch = vinylItems.some(vinyl => {
    if (vinyl.disposition !== 'in_stock') return false;

    const basicMatch = vinyl.brand === entry.brand &&
                      vinyl.series === entry.series &&
                      vinyl.width === entry.width &&
                      parseFloat(vinyl.length_yards?.toString() || '0') >= parseFloat(entry.length_yards || '0');

    if (!basicMatch) return false;

    // Check color matching
    const numberMatch = entry.colour_number
      ? vinyl.colour_number === entry.colour_number
      : true;

    const nameMatch = entry.colour_name
      ? vinyl.colour_name?.toLowerCase() === entry.colour_name.toLowerCase()
      : true;

    return numberMatch && nameMatch;
  });

  return hasMatch;
}

/**
 * Validate a single bulk entry
 */
export function validateBulkEntry(entry: BulkEntry, vinylItems: VinylItem[]): string[] {
  const errors: string[] = [];

  // Required fields validation
  if (!entry.type) {
    errors.push('Type is required');
  }

  if (!entry.brand) {
    errors.push('Brand is required');
  }

  if (!entry.series) {
    errors.push('Series is required');
  }

  if (!entry.colour_number && !entry.colour_name) {
    errors.push('Either color number or color name is required');
  }

  if (!entry.width) {
    errors.push('Width is required');
  }

  if (!entry.length_yards || parseFloat(entry.length_yards) <= 0) {
    errors.push('Valid length is required');
  }

  // Type-specific validation
  if (entry.type === 'use') {
    const inventoryMatch = hasMatchingInventory(entry, vinylItems);
    if (inventoryMatch === false) {
      if (entry.specific_vinyl_id) {
        errors.push(`Selected vinyl piece #${entry.specific_vinyl_id} is not available`);
      } else {
        errors.push(`No matching inventory for ${entry.brand} ${entry.series} ${entry.colour_number || entry.colour_name} ${entry.width}"`);
      }
    }
  }

  if (entry.type === 'store' && !entry.location) {
    errors.push('Location is required for store entries');
  }

  return errors;
}

/**
 * Validate all bulk entries
 */
export function validateBulkEntries(entries: BulkEntry[], vinylItems: VinylItem[]): string[] {
  const allErrors: string[] = [];
  const usedVinylIds = new Set<number>();

  entries.forEach((entry, index) => {
    const entryErrors = validateBulkEntry(entry, vinylItems);

    // Check for duplicate specific vinyl selections
    if (entry.specific_vinyl_id) {
      if (usedVinylIds.has(entry.specific_vinyl_id)) {
        entryErrors.push(`Vinyl piece #${entry.specific_vinyl_id} is already selected in another entry`);
      }
      usedVinylIds.add(entry.specific_vinyl_id);
    }

    // Add entry-specific error prefix
    if (entryErrors.length > 0) {
      entryErrors.forEach(error => {
        allErrors.push(`Row ${index + 1}: ${error}`);
      });
    }
  });

  return allErrors;
}

/**
 * Check if an entry is valid for submission
 */
export function isEntryValid(entry: BulkEntry): boolean {
  return !!(
    entry.type &&
    entry.brand &&
    entry.series &&
    (entry.colour_number || entry.colour_name) &&
    entry.width &&
    entry.length_yards &&
    parseFloat(entry.length_yards) > 0
  );
}

/**
 * Filter entries that are valid for submission
 */
export function filterValidEntries(entries: BulkEntry[]): BulkEntry[] {
  return entries.filter(isEntryValid);
}

/**
 * Count valid entries
 */
export function countValidEntries(entries: BulkEntry[]): number {
  return filterValidEntries(entries).length;
}

/**
 * Get validation state for visual feedback
 */
export function getValidationState(entry: BulkEntry, vinylItems: VinylItem[]): {
  hasError: boolean;
  errorMessage?: string;
  isValid: boolean;
} {
  const errors = validateBulkEntry(entry, vinylItems);
  const isValid = isEntryValid(entry);

  return {
    hasError: errors.length > 0,
    errorMessage: errors[0], // Show first error
    isValid
  };
}