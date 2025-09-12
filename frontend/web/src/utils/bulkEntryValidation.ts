import { BulkEntry } from '../hooks/useBulkEntries';
import { VinylItem } from '../components/inventory/InventoryTab';

export const buildColourMapping = (vinylItems: VinylItem[], combinations: any[], currentBrand?: string, currentSeries?: string) => {
  const numberToName: Record<string, string> = {};
  const nameToNumber: Record<string, string> = {};

  // Process vinyl items - filter to current context if provided
  const relevantVinylItems = currentBrand && currentSeries 
    ? vinylItems.filter(vinyl => vinyl.brand === currentBrand && vinyl.series === currentSeries)
    : vinylItems;

  relevantVinylItems.forEach(vinyl => {
    // Use the new separate fields directly
    if (vinyl.colour_number && vinyl.colour_name) {
      numberToName[vinyl.colour_number] = vinyl.colour_name;
      nameToNumber[vinyl.colour_name] = vinyl.colour_number;
    }
  });

  // Process combinations from autofill suggestions - filter to current context if provided
  const relevantCombinations = currentBrand && currentSeries
    ? combinations.filter((combo: any) => combo.brand === currentBrand && combo.series === currentSeries)
    : combinations;

  relevantCombinations.forEach((combo: any) => {
    // Use the new separate fields directly from API response
    if (combo.colour_number && combo.colour_name) {
      numberToName[combo.colour_number] = combo.colour_name;
      nameToNumber[combo.colour_name] = combo.colour_number;
    }
  });

  return { numberToName, nameToNumber };
};

export const getMatchingItems = (vinylItems: VinylItem[], currentData: BulkEntry, excludeField: string) => {
  // Step 1: Filter to only available inventory (in_stock items)
  let matches = vinylItems.filter(item => item.disposition === 'in_stock');

  // Step 2: Apply filters for each field except the excluded one
  if (excludeField !== 'brand' && currentData.brand) {
    matches = matches.filter(item => item.brand === currentData.brand);
  }
  if (excludeField !== 'series' && currentData.series) {
    matches = matches.filter(item => item.series === currentData.series);
  }
  if (excludeField !== 'colour_number' && currentData.colour_number) {
    matches = matches.filter(item => {
      // Use the new colour_number field directly
      return item.colour_number === currentData.colour_number;
    });
  }
  if (excludeField !== 'colour_name' && currentData.colour_name) {
    matches = matches.filter(item => {
      // Use the new colour_name field directly
      return item.colour_name && item.colour_name.toLowerCase().includes(currentData.colour_name.toLowerCase());
    });
  }
  if (excludeField !== 'width' && currentData.width) {
    matches = matches.filter(item => item.width === currentData.width);
  }
  if (excludeField !== 'length_yards' && currentData.length_yards) {
    matches = matches.filter(item => item.length_yards?.toString() === currentData.length_yards);
  }

  return matches;
};

export const getBulkSuggestions = (
  _entryId: string, 
  field: 'brand' | 'series' | 'colour' | 'colour_number' | 'colour_name' | 'width' | 'length_yards',
  currentData: BulkEntry,
  vinylItems: VinylItem[],
  bulkAutofillSuggestions: any
) => {
  if (field === 'brand') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const brands = [...new Set(availableItems.map(item => item.brand))].filter(Boolean);
    
    // Apply contextual filtering to bulk suggestions
    const contextualBulkBrands = bulkAutofillSuggestions.combinations?.filter((combo: any) => {
      // Only include if it matches current context (excluding brand field)
      return (!currentData.series || combo.series === currentData.series) &&
             (!currentData.width || combo.width?.toString() === currentData.width) &&
             (!currentData.colour_number || combo.colour_number === currentData.colour_number) &&
             (!currentData.colour_name || combo.colour_name?.toLowerCase().includes(currentData.colour_name.toLowerCase()));
    }).map((c: any) => c.brand).filter(Boolean) || [];
    
    const allBrands = [...new Set([...brands, ...contextualBulkBrands])];
    
    return allBrands.sort();
  }

  if (field === 'series') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const series = [...new Set(availableItems.map(item => item.series))].filter(Boolean);
    
    // Apply contextual filtering to bulk suggestions
    const contextualBulkSeries = bulkAutofillSuggestions.combinations?.filter((combo: any) => {
      // Only include if it matches current context (excluding series field)
      return (!currentData.brand || combo.brand === currentData.brand) &&
             (!currentData.width || combo.width?.toString() === currentData.width) &&
             (!currentData.colour_number || combo.colour_number === currentData.colour_number) &&
             (!currentData.colour_name || combo.colour_name?.toLowerCase().includes(currentData.colour_name.toLowerCase()));
    }).map((c: any) => c.series).filter(Boolean) || [];
    
    const allSeries = [...new Set([...series, ...contextualBulkSeries])];
    
    return allSeries.sort();
  }

  if (field === 'colour_number') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const numbers = new Set<string>();
    let hasColoursWithoutNumbers = false;
    
    // From vinyl items - collect colour numbers
    availableItems.forEach(item => {
      if (item.colour_number) {
        numbers.add(item.colour_number);
      } else if (item.colour_name && !item.colour_number) {
        // Item has colour name but no number - add empty as option
        hasColoursWithoutNumbers = true;
      }
    });
    
    // If colours exist without numbers, add empty as an option
    if (hasColoursWithoutNumbers) {
      numbers.add(''); // Empty string = no colour code
    }
    
    // Apply contextual filtering to bulk suggestions
    const contextualBulkCombos = bulkAutofillSuggestions.combinations?.filter((combo: any) => {
      // Only include if it matches current context (excluding colour_number field)
      return (!currentData.brand || combo.brand === currentData.brand) &&
             (!currentData.series || combo.series === currentData.series) &&
             (!currentData.width || combo.width?.toString() === currentData.width) &&
             (!currentData.colour_name || combo.colour_name?.toLowerCase().includes(currentData.colour_name.toLowerCase()));
    }) || [];
    
    contextualBulkCombos.forEach((combo: any) => {
      if (combo.colour_number) {
        numbers.add(combo.colour_number);
      }
    });
    
    return Array.from(numbers).sort((a, b) => {
      if (a === '') return -1; // Empty first
      if (b === '') return 1;
      return a.localeCompare(b);
    });
  }

  if (field === 'colour_name') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const names = new Set<string>();
    let hasItemsWithoutColourNames = false;
    
    // From vinyl items - collect colour names
    availableItems.forEach(item => {
      if (item.colour_name) {
        names.add(item.colour_name);
      } else {
        hasItemsWithoutColourNames = true; // Has items with null/empty colour
      }
    });
    
    // If items exist without colour names, add empty as an option
    if (hasItemsWithoutColourNames) {
      names.add(''); // Empty string = no colour name
    }
    
    // Apply contextual filtering to bulk suggestions
    const contextualBulkCombos = bulkAutofillSuggestions.combinations?.filter((combo: any) => {
      // Only include if it matches current context (excluding colour_name field)
      return (!currentData.brand || combo.brand === currentData.brand) &&
             (!currentData.series || combo.series === currentData.series) &&
             (!currentData.width || combo.width?.toString() === currentData.width) &&
             (!currentData.colour_number || combo.colour_number === currentData.colour_number);
    }) || [];
    
    contextualBulkCombos.forEach((combo: any) => {
      if (combo.colour_name) {
        names.add(combo.colour_name);
      }
    });
    
    return Array.from(names).sort((a, b) => {
      if (a === '') return -1; // Empty first
      if (b === '') return 1;
      return a.localeCompare(b);
    });
  }

  if (field === 'width') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const widths = [...new Set(availableItems.map(item => item.width))].filter(Boolean);
    
    // Apply contextual filtering to bulk suggestions
    const contextualBulkWidths = bulkAutofillSuggestions.combinations?.filter((combo: any) => {
      // Only include if it matches current context (excluding width field)
      return (!currentData.brand || combo.brand === currentData.brand) &&
             (!currentData.series || combo.series === currentData.series) &&
             (!currentData.colour_number || combo.colour_number === currentData.colour_number) &&
             (!currentData.colour_name || combo.colour_name?.toLowerCase().includes(currentData.colour_name.toLowerCase()));
    }).map((c: any) => c.width).filter(Boolean) || [];
    
    const allWidths = [...new Set([...widths.map(String), ...contextualBulkWidths.map(String)])];
    
    return allWidths.sort();
  }

  if (field === 'length_yards') {
    const availableItems = getMatchingItems(vinylItems, currentData, field);
    const lengths = [...new Set(availableItems.map(item => item.length_yards?.toString()))].filter(Boolean);
    
    return lengths.sort((a, b) => parseFloat(a) - parseFloat(b));
  }

  return [];
};

export const hasMatchingInventory = (entry: BulkEntry, vinylItems: VinylItem[]) => {
  // Only check for 'use' type entries
  if (entry.type !== 'use') return true;

  return vinylItems.some(vinyl => {
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
      ? vinyl.colour_name?.toLowerCase().includes(entry.colour_name.toLowerCase())
      : true;

    return numberMatch && nameMatch;
  });
};

export const validateBulkEntries = (entries: BulkEntry[], vinylItems: VinylItem[]) => {
  const errors: string[] = [];
  const useEntriesMap = new Map<string, number>(); // Track count of each USE combination

  entries.forEach((entry, index) => {
    const lineNum = index + 1;

    // Required field validation
    if (!entry.type) {
      errors.push(`Line ${lineNum}: Type is required`);
    }
    if (!entry.brand) {
      errors.push(`Line ${lineNum}: Brand is required`);
    }
    if (!entry.series) {
      errors.push(`Line ${lineNum}: Series is required`);
    }
    if (!entry.colour_number && !entry.colour_name) {
      errors.push(`Line ${lineNum}: Either color number or color name is required`);
    }
    if (!entry.width) {
      errors.push(`Line ${lineNum}: Width is required`);
    }
    if (!entry.length_yards || parseFloat(entry.length_yards) <= 0) {
      errors.push(`Line ${lineNum}: Length (yards) must be greater than 0`);
    }

    // Inventory validation for 'use' entries
    if (entry.type === 'use') {
      // Check if there's potential matching inventory
      const potentialMatches = vinylItems.filter(vinyl => {
        const basicMatch = vinyl.brand === entry.brand &&
                          vinyl.series === entry.series &&
                          vinyl.width === entry.width;

        if (!basicMatch) return false;

        // Check color matching (more lenient for finding potential matches)
        if (entry.colour_number) {
          if (!vinyl.colour_number || vinyl.colour_number !== entry.colour_number) return false;
        }

        if (entry.colour_name) {
          if (!vinyl.colour_name || !vinyl.colour_name.toLowerCase().includes(entry.colour_name.toLowerCase())) return false;
        }

        return true;
      });

      if (potentialMatches.length === 0) {
        const colourDisplay = [entry.colour_number, entry.colour_name].filter(Boolean).join(' ');
        errors.push(`Line ${lineNum}: No matching inventory found for ${entry.brand} ${entry.series} ${colourDisplay} ${entry.width}"`);
      } else {
        // Check if we have enough inventory considering all USE entries
        const hasMatch = hasMatchingInventory(entry, vinylItems);
        if (!hasMatch) {
          const colourDisplay = [entry.colour_number, entry.colour_name].filter(Boolean).join(' ');
          errors.push(`Line ${lineNum}: Insufficient inventory for ${entry.brand} ${entry.series} ${colourDisplay} ${entry.width}" (need ${entry.length_yards} yards)`);
        }

        // Track USE entries to check for over-allocation
        const comboKey = `${entry.brand}|${entry.series}|${entry.colour_number || ''}|${entry.colour_name || ''}|${entry.width}|${entry.length_yards}`;
        const currentCount = useEntriesMap.get(comboKey) || 0;
        useEntriesMap.set(comboKey, currentCount + parseFloat(entry.length_yards));

        // Check if total USE entries exceed available inventory
        const availableCount = vinylItems.filter(vinyl => {
          const basicMatch = vinyl.brand === entry.brand &&
                            vinyl.series === entry.series &&
                            vinyl.width === entry.width;

          if (!basicMatch) return false;

          // Check color matching
          const numberMatch = entry.colour_number 
            ? vinyl.colour_number === entry.colour_number
            : true;

          const nameMatch = entry.colour_name
            ? vinyl.colour_name?.toLowerCase().includes(entry.colour_name.toLowerCase())
            : true;

          return numberMatch && nameMatch;
        }).reduce((total, vinyl) => total + parseFloat(vinyl.length_yards?.toString() || '0'), 0);

        if (useEntriesMap.get(comboKey)! > availableCount) {
          const colourDisplay = [entry.colour_number, entry.colour_name].filter(Boolean).join(' ');
          errors.push(`Line ${lineNum}: Total USE entries exceed available inventory for ${entry.brand} ${entry.series} ${colourDisplay} ${entry.width}" (requested: ${useEntriesMap.get(comboKey)}, available: ${availableCount})`);
        }
      }
    }
  });

  return errors;
};

export const getNotePlaceholder = (type: string) => {
  switch (type) {
    case 'store': return 'Storage: ';
    case 'use': return 'Usage: ';
    case 'waste': return 'Waste: ';
    case 'returned': return 'Return: ';
    case 'damaged': return 'Damage: ';
    default: return '';
  }
};