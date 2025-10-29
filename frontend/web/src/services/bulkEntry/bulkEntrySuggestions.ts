import { BulkEntry } from '../../hooks/useBulkEntries';
import { VinylItem, VinylAutofillSuggestions, VinylAutofillCombination } from '../../components/inventory/types';
import { USE_AUTOFILL_TYPES, DEFAULT_WIDTH_OPTIONS } from './bulkEntryLogic';

/**
 * Build color mapping for number <-> name conversion
 */
export function buildColourMapping(
  vinylItems: VinylItem[],
  combinations: VinylAutofillCombination[],
  currentBrand?: string,
  currentSeries?: string
): {
  numberToName: Record<string, string>;
  nameToNumber: Record<string, string>;
} {
  const numberToName: Record<string, string> = {};
  const nameToNumber: Record<string, string> = {};

  // Process vinyl items - filter to current context if provided
  const relevantVinylItems = currentBrand && currentSeries
    ? vinylItems.filter(vinyl => vinyl.brand === currentBrand && vinyl.series === currentSeries)
    : vinylItems;

  relevantVinylItems.forEach(vinyl => {
    if (vinyl.colour_number && vinyl.colour_name) {
      numberToName[vinyl.colour_number] = vinyl.colour_name;
      nameToNumber[vinyl.colour_name] = vinyl.colour_number;
    }
  });

  // Process combinations from autofill suggestions
  const relevantCombinations = currentBrand && currentSeries
    ? combinations.filter((combo) => combo.brand === currentBrand && combo.series === currentSeries)
    : combinations;

  relevantCombinations.forEach((combo) => {
    if (combo.colour_number && combo.colour_name) {
      numberToName[combo.colour_number] = combo.colour_name;
      nameToNumber[combo.colour_name] = combo.colour_number;
    }
  });

  return { numberToName, nameToNumber };
}

/**
 * Get matching items based on current entry data
 */
export function getMatchingItems(
  vinylItems: VinylItem[],
  currentData: BulkEntry,
  excludeField: string
): VinylItem[] {
  // Filter to only available inventory
  let matches = vinylItems.filter(item => item.disposition === 'in_stock');

  // Apply filters for each field except the excluded one
  if (excludeField !== 'brand' && currentData.brand) {
    matches = matches.filter(item => item.brand === currentData.brand);
  }
  if (excludeField !== 'series' && currentData.series) {
    matches = matches.filter(item => item.series === currentData.series);
  }
  if (excludeField !== 'colour_number' && currentData.colour_number) {
    matches = matches.filter(item => item.colour_number === currentData.colour_number);
  }
  if (excludeField !== 'colour_name' && currentData.colour_name) {
    matches = matches.filter(item =>
      item.colour_name && item.colour_name.toLowerCase().includes(currentData.colour_name.toLowerCase())
    );
  }
  if (excludeField !== 'width' && currentData.width) {
    matches = matches.filter(item => item.width === currentData.width);
  }
  if (excludeField !== 'length_yards' && currentData.length_yards) {
    matches = matches.filter(item => item.length_yards?.toString() === currentData.length_yards);
  }

  return matches;
}

/**
 * Get contextual suggestions for a field
 */
export function getBulkSuggestions(
  _entryId: string,
  field: 'brand' | 'series' | 'colour' | 'colour_number' | 'colour_name' | 'width' | 'length_yards',
  currentData: BulkEntry,
  vinylItems: VinylItem[],
  bulkAutofillSuggestions: VinylAutofillSuggestions
): string[] {
  // For width field with non-autofill types, return defaults
  if (field === 'width' && !USE_AUTOFILL_TYPES.has(currentData.type)) {
    return DEFAULT_WIDTH_OPTIONS;
  }

  // For brand suggestions
  if (field === 'brand') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const brands = [...new Set(availableItems.map(item => item.brand))].filter(Boolean);

    const contextualBulkBrands = bulkAutofillSuggestions.combinations?.filter((combo) => {
      return (!currentData.series || combo.series === currentData.series) &&
             (!currentData.width || combo.default_width?.toString() === currentData.width) &&
             (!currentData.colour_number || combo.colour_number === currentData.colour_number) &&
             (!currentData.colour_name || combo.colour_name?.toLowerCase().includes(currentData.colour_name.toLowerCase()));
    }).map((c) => c.brand).filter(Boolean) || [];

    return [...new Set([...brands, ...contextualBulkBrands])].sort();
  }

  // For series suggestions
  if (field === 'series') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const series = [...new Set(availableItems.map(item => item.series))].filter(Boolean);

    const contextualBulkSeries = bulkAutofillSuggestions.combinations?.filter((combo) => {
      return (!currentData.brand || combo.brand === currentData.brand) &&
             (!currentData.width || combo.default_width?.toString() === currentData.width) &&
             (!currentData.colour_number || combo.colour_number === currentData.colour_number) &&
             (!currentData.colour_name || combo.colour_name?.toLowerCase().includes(currentData.colour_name.toLowerCase()));
    }).map((c) => c.series).filter(Boolean) || [];

    return [...new Set([...series, ...contextualBulkSeries])].sort();
  }

  // For width suggestions
  if (field === 'width') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const widths = [...new Set(availableItems.map(item => item.width))].filter(Boolean);

    const contextualBulkWidths = bulkAutofillSuggestions.combinations?.filter((combo) => {
      return (!currentData.brand || combo.brand === currentData.brand) &&
             (!currentData.series || combo.series === currentData.series) &&
             (!currentData.colour_number || combo.colour_number === currentData.colour_number) &&
             (!currentData.colour_name || combo.colour_name?.toLowerCase().includes(currentData.colour_name.toLowerCase()));
    }).map((c) => c.default_width?.toString()).filter(Boolean) || [];

    return [...new Set([...widths, ...contextualBulkWidths])].sort((a, b) => parseFloat(a) - parseFloat(b));
  }

  // For length suggestions
  if (field === 'length_yards') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const lengths = availableItems
      .map(item => item.length_yards?.toString())
      .filter(Boolean);

    return [...new Set(lengths)].sort((a, b) => parseFloat(a) - parseFloat(b));
  }

  return [];
}

/**
 * Build suggestion cache for all entries
 */
export function buildSuggestionCache(
  bulkEntries: BulkEntry[],
  vinylItems: VinylItem[],
  bulkAutofillSuggestions: VinylAutofillSuggestions
): Map<string, { width: string[]; length_yards: string[] }> {
  const cache = new Map<string, { width: string[]; length_yards: string[] }>();

  bulkEntries.forEach((entry) => {
    const shouldAutofill = USE_AUTOFILL_TYPES.has(entry.type);

    const widthSuggestions = shouldAutofill
      ? getBulkSuggestions(entry.id, 'width', entry, vinylItems, bulkAutofillSuggestions)
      : DEFAULT_WIDTH_OPTIONS;

    const lengthSuggestions = shouldAutofill
      ? getBulkSuggestions(entry.id, 'length_yards', entry, vinylItems, bulkAutofillSuggestions)
      : [];

    cache.set(entry.id, {
      width: widthSuggestions,
      length_yards: lengthSuggestions
    });
  });

  return cache;
}