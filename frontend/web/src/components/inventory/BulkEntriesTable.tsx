import React, { useMemo, useCallback } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { BulkEntry } from '../../hooks/useBulkEntries';
import { VinylItem } from './InventoryTab';
import { CombinedVinylDropdown } from '../common/CombinedVinylDropdown';
import { VinylSpecificSelector } from '../common/VinylSpecificSelector';
import { AutofillComboBox } from '../common/AutofillComboBox';
import { 
  buildColourMapping, 
  getBulkSuggestions, 
  hasMatchingInventory, 
  getNotePlaceholder 
} from '../../utils/bulkEntryValidation';

interface Job {
  job_id: number;
  customer_name: string;
  job_name?: string;
  job_description?: string;
}

interface Product {
  brand: string;
  series: string;
  colour_number: string;
  colour_name?: string;
  available_widths?: string;
  default_width?: number;
  is_active: boolean;
}

interface BulkAutofillSuggestions {
  combinations?: Array<{
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  }>;
}

interface BulkEntriesTableProps {
  bulkEntries: BulkEntry[];
  vinylItems: VinylItem[];
  bulkAutofillSuggestions: BulkAutofillSuggestions;
  products: Product[];
  availableJobs: Job[];
  isSaving: boolean;
  bulkLoadingSuggestions: boolean;
  updateBulkEntry: (id: string, updates: Partial<BulkEntry>) => void;
  removeBulkEntry: (id: string) => void;
  addNewBulkEntry: () => void;
  handleJobChange: (entryId: string, jobIndex: number, value: string) => void;
  removeJobField: (entryId: string, jobIndex: number) => void;
  clearSuccessfulEntries?: () => void;
}

export const BulkEntriesTable: React.FC<BulkEntriesTableProps> = ({
  bulkEntries,
  vinylItems,
  bulkAutofillSuggestions,
  products,
  availableJobs,
  isSaving,
  bulkLoadingSuggestions,
  updateBulkEntry,
  removeBulkEntry,
  addNewBulkEntry,
  handleJobChange,
  removeJobField,
  clearSuccessfulEntries
}) => {
  const [specificSelectorOpen, setSpecificSelectorOpen] = React.useState<string | null>(null);
  const [specificSelectorSpecs, setSpecificSelectorSpecs] = React.useState<{
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  } | null>(null);

  // Build contextual color mapping for cross-autofill per entry
  const getColourMapping = useCallback((brand: string, series: string) => {
    return buildColourMapping(
      vinylItems, 
      bulkAutofillSuggestions.combinations || [], 
      brand, 
      series
    );
  }, [vinylItems, bulkAutofillSuggestions.combinations]);

  // Tab navigation handler
  const createTabHandler = (entryId: string, currentField: string) => {
    const fieldOrder = ['type', 'vinyl_product', 'width', 'length_yards', 'location', 'jobs', 'notes'];
    const currentIndex = fieldOrder.indexOf(currentField);

    return () => {
      const nextFieldIndex = currentIndex + 1;
      
      if (nextFieldIndex < fieldOrder.length) {
        // Move to next field in same row
        const nextField = fieldOrder[nextFieldIndex];
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
          const newEntryId = bulkEntries[bulkEntries.length - 1]?.id;
          const firstFieldElement = document.querySelector(`[data-field="${newEntryId}-type"]`) as HTMLElement;
          if (firstFieldElement) {
            firstFieldElement.focus();
          }
        }, 10);
      }
    };
  };

  // Handler for combined vinyl product field
  const handleVinylProductChange = (entryId: string, value: {
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  }) => {
    updateBulkEntry(entryId, {
      brand: value.brand,
      series: value.series,
      colour_number: value.colour_number,
      colour_name: value.colour_name
    });

    // Show specific vinyl selector for 'use' type entries
    const entry = bulkEntries.find(e => e.id === entryId);
    if (entry && (entry.type === 'use' || entry.type === 'waste' || entry.type === 'returned' || entry.type === 'damaged') && 
        value.brand && value.series && (value.colour_number || value.colour_name)) {
      setSpecificSelectorSpecs(value);
      setSpecificSelectorOpen(entryId);
    }

    // Auto-add new entry if this is complete and is the last entry
    const entryIndex = bulkEntries.findIndex(e => e.id === entryId);
    const isLastEntry = entryIndex === bulkEntries.length - 1;
    
    if (isLastEntry && value.brand && value.series && (value.colour_number || value.colour_name)) {
      setTimeout(() => addNewBulkEntry(), 50);
    }
  };

  // Handler for specific vinyl selection
  const handleSpecificVinylSelect = (vinylItem: VinylItem) => {
    if (specificSelectorOpen) {
      updateBulkEntry(specificSelectorOpen, {
        specific_vinyl_id: vinylItem.id,
        width: vinylItem.width?.toString() || '',
        // Set max available length for use/waste/returned/damaged types
        length_yards: vinylItem.length_yards?.toString() || '',
        // Autofill notes from selected vinyl item
        notes: vinylItem.notes || ''
      });
      setSpecificSelectorOpen(null);
      setSpecificSelectorSpecs(null);
    }
  };

  // Handler for closing specific vinyl selector
  const handleCloseSpecificSelector = () => {
    setSpecificSelectorOpen(null);
    setSpecificSelectorSpecs(null);
  };

  // Enhanced change handler with intelligent autofill
  const handleBulkEntryChange = (entryId: string, field: keyof BulkEntry, value: string) => {
    const entry = bulkEntries.find(e => e.id === entryId);
    if (!entry) return;

    const updates: Partial<BulkEntry> = { [field]: value };

    // Smart autofill logic
    if (field === 'type') {
      // Clear location for non-store types and auto-populate notes prefix
      if (value !== 'store') {
        updates.location = '';
      }
      
      // Auto-populate notes with type-specific prefix
      const prefix = getNotePlaceholder(value);
      const currentNotes = entry.notes || '';
      
      // Only update notes if it's empty or starts with a different prefix
      const prefixes = ['Storage: ', 'Usage: ', 'Waste: ', 'Return: ', 'Damage: '];
      const startsWithPrefix = prefixes.some(p => currentNotes.startsWith(p));
      
      if (!currentNotes || startsWithPrefix) {
        updates.notes = prefix + (startsWithPrefix ? currentNotes.substring(currentNotes.indexOf(' ') + 1) : currentNotes);
      }
    }

    // Handle brand change - trigger intelligent suggestions
    if (field === 'brand') {
      const updatedEntry = { ...entry, ...updates };
      
      // If brand matches existing inventory, suggest common combinations
      const matchingItems = vinylItems.filter(item => 
        item.brand === value &&
        (!updatedEntry.series || item.series === updatedEntry.series) &&
        (!updatedEntry.width || item.width === updatedEntry.width)
      );

      // Let user see all available series options
    }

    // Handle colour_number change with cross-autofill
    if (field === 'colour_number') {
      const updatedEntry = { ...entry, ...updates };
      
      // Cross-autofill colour_name if we have a mapping (contextual to current brand/series)
      if (value && !updatedEntry.colour_name && updatedEntry.brand && updatedEntry.series) {
        const contextualMapping = getColourMapping(updatedEntry.brand, updatedEntry.series);
        const colourName = contextualMapping.numberToName[value];
        if (colourName) {
          updates.colour_name = colourName;
        }
      }
    }

    // Handle colour_name change with cross-autofill
    if (field === 'colour_name') {
      const updatedEntry = { ...entry, ...updates };
      
      // Cross-autofill colour_number if we have a mapping (contextual to current brand/series)
      if (value && !updatedEntry.colour_number && updatedEntry.brand && updatedEntry.series) {
        const contextualMapping = getColourMapping(updatedEntry.brand, updatedEntry.series);
        const colourNumber = contextualMapping.nameToNumber[value];
        if (colourNumber) {
          updates.colour_number = colourNumber;
        }
      }
    }

    // Handle width change - suggest common widths for current brand/series
    if (field === 'width') {
      const updatedEntry = { ...entry, ...updates };
      
      // Find matching product for width validation
      const matchingProduct = products.find((product: any) => 
        product.brand === updatedEntry.brand && 
        product.series === updatedEntry.series &&
        product.colour_number === updatedEntry.colour_number
      );

      if (matchingProduct && matchingProduct.available_widths) {
        // Validate width is available for this product
        const availableWidths = matchingProduct.available_widths.split(',').map((w: string) => w.trim());
        // Note: Width validation is informational only - user can still enter custom widths
      }
    }

    // Apply autofill suggestions for remaining fields based on current combination
    if (['width'].includes(field)) {
      const updatedEntry = { ...entry, ...updates };
      
      // Check for exact matches and suggest completing fields
      const additionalUpdates: Partial<BulkEntry> = {};
      
      // Only check width since other fields are now handled by CombinedVinylDropdown
      if (!updatedEntry.width) {
        const viableOptions = getBulkSuggestions(entryId, 'width', updatedEntry, vinylItems, bulkAutofillSuggestions);
        
        // If only one option, auto-fill it
        if (viableOptions.length === 1) {
          additionalUpdates.width = viableOptions[0];
        }
      }
      
      // Merge additional updates
      Object.assign(updates, additionalUpdates);
    }

    // Update the entry
    updateBulkEntry(entryId, updates);
    
    // Auto-focus next field logic
    const entryIndex = bulkEntries.findIndex(e => e.id === entryId);
    const isLastEntry = entryIndex === bulkEntries.length - 1;
    
    // Add new entry if this is the last entry and we're filling required fields
    if (isLastEntry && ['width'].includes(field) && value.trim()) {
      // Don't auto-add if this entry is still incomplete
      const updatedEntry = { ...entry, ...updates };
      if (updatedEntry.brand && updatedEntry.series && (updatedEntry.colour_number || updatedEntry.colour_name)) {
        setTimeout(() => addNewBulkEntry(), 50);
      }
    }
  };


  return (
    <div className="space-y-4">
      {/* Specific Vinyl Selector Modal */}
      <VinylSpecificSelector
        isOpen={!!specificSelectorOpen}
        onClose={handleCloseSpecificSelector}
        onSelect={handleSpecificVinylSelect}
        specifications={specificSelectorSpecs || { brand: '', series: '', colour_number: '', colour_name: '' }}
        vinylItems={vinylItems}
        title="Select Specific Vinyl Piece"
      />
      {/* Auto-save indicator */}
      {isSaving && (
        <div className="text-sm text-gray-600 italic">
          Saving changes...
        </div>
      )}

      {/* Bulk Entries Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-medium text-gray-900">Bulk Entries</h3>
              {/* Show counts */}
              <div className="text-sm text-gray-600">
                {bulkEntries.filter(e => e.submissionState === 'success').length > 0 && (
                  <span className="text-green-600 font-medium">
                    {bulkEntries.filter(e => e.submissionState === 'success').length} successful
                  </span>
                )}
                {bulkEntries.filter(e => e.submissionState === 'error').length > 0 && (
                  <span className="text-red-600 font-medium ml-2">
                    {bulkEntries.filter(e => e.submissionState === 'error').length} failed
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Clear Successful Entries Button */}
              {clearSuccessfulEntries && bulkEntries.filter(e => e.submissionState === 'success').length > 0 && (
                <button
                  onClick={clearSuccessfulEntries}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                  Clear Successful
                </button>
              )}
              {/* Add Entry Button */}
              <button
                onClick={addNewBulkEntry}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Entry
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full divide-y divide-gray-200 text-sm" style={{ minWidth: '1200px' }}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type<span className="text-red-500 ml-1">*</span>
                  </th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '280px' }}>
                    Vinyl Product<span className="text-red-500 ml-1">*</span>
                  </th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Width (in)<span className="text-red-500 ml-1">*</span>
                  </th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Length (yds)<span className="text-red-500 ml-1">*</span>
                  </th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>Jobs</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bulkEntries.map((entry) => {
                  const inventoryMatch = hasMatchingInventory(entry, vinylItems);
                  const hasValidationError = entry.type === 'use' && inventoryMatch === false;
                  
                  // Get row background color based on submission state first, then entry type
                  const getRowBgColor = () => {
                    // Submission state takes priority over entry type and validation
                    if (entry.submissionState === 'submitting') return 'bg-blue-50 border-l-4 border-blue-400';
                    if (entry.submissionState === 'success') return 'bg-green-100 border-l-4 border-green-500';
                    if (entry.submissionState === 'error') return 'bg-red-100 border-l-4 border-red-500';
                    
                    // Validation error
                    if (hasValidationError) return 'bg-red-50 border-l-4 border-red-400';
                    
                    // Entry type colors (lighter since submission states take priority)
                    switch (entry.type) {
                      case 'store': return 'bg-green-50 border-l-4 border-green-300';
                      case 'use': return 'bg-red-50 border-l-4 border-red-300';
                      case 'waste': return 'bg-orange-50 border-l-4 border-orange-300';
                      case 'returned': return 'bg-blue-50 border-l-4 border-blue-300';
                      case 'damaged': return 'bg-purple-50 border-l-4 border-purple-300';
                      default: return '';
                    }
                  };
                  
                  return (
                    <tr key={entry.id} className={`hover:bg-gray-50 ${getRowBgColor()}`}>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <select
                          value={entry.type}
                          onChange={(e) => updateBulkEntry(entry.id, { type: e.target.value as 'store' | 'use' | 'waste' | 'returned' | 'damaged' })}
                          data-field={`${entry.id}-type`}
                          onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && (e.preventDefault(), createTabHandler(entry.id, 'type')())}
                          className={`w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 ${!entry.type ? 'text-gray-400' : ''}`}
                        >
                          <option value="">Select</option>
                          <option value="store">Store (In Stock)</option>
                          <option value="use">Use</option>
                          <option value="waste">Waste</option>
                          <option value="returned">Returned</option>
                          <option value="damaged">Damaged</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap" style={{ minWidth: '280px' }}>
                        <div className="space-y-2">
                          <CombinedVinylDropdown
                            label=""
                            value={{
                              brand: entry.brand || '',
                              series: entry.series || '',
                              colour_number: entry.colour_number || '',
                              colour_name: entry.colour_name || ''
                            }}
                            onChange={(value) => handleVinylProductChange(entry.id, value)}
                            combinations={bulkAutofillSuggestions.combinations || []}
                            placeholder="Search vinyl products..."
                            className="w-full"
                            name={`${entry.id}-vinyl_product`}
                            loading={bulkLoadingSuggestions}
                            onTab={createTabHandler(entry.id, 'vinyl_product')}
                          />
                          {/* Show specific vinyl indicator */}
                          {entry.specific_vinyl_id && (
                            <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                              Specific vinyl #{entry.specific_vinyl_id} selected
                            </div>
                          )}
                          {/* Show selector button for use/waste/returned/damaged types */}
                          {['use', 'waste', 'returned', 'damaged'].includes(entry.type) && 
                           entry.brand && entry.series && (entry.colour_number || entry.colour_name) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSpecificSelectorSpecs({
                                  brand: entry.brand || '',
                                  series: entry.series || '',
                                  colour_number: entry.colour_number || '',
                                  colour_name: entry.colour_name || ''
                                });
                                setSpecificSelectorOpen(entry.id);
                              }}
                              className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 w-full"
                            >
                              Choose Specific Piece
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <AutofillComboBox
                          label=""
                          value={entry.width}
                          onChange={(value) => handleBulkEntryChange(entry.id, 'width', value)}
                          suggestions={['use', 'waste', 'returned', 'damaged'].includes(entry.type) ? 
                            getBulkSuggestions(entry.id, 'width', entry, vinylItems, bulkAutofillSuggestions) : 
                            ['48', '24', '60', '54', '12']
                          }
                          placeholder="Width"
                          className="w-20"
                          name={`${entry.id}-width`}
                          onTab={createTabHandler(entry.id, 'width')}
                        />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {['use', 'waste', 'returned', 'damaged'].includes(entry.type) ? (
                          <AutofillComboBox
                            label=""
                            value={entry.length_yards}
                            onChange={(value) => handleBulkEntryChange(entry.id, 'length_yards', value)}
                            suggestions={getBulkSuggestions(entry.id, 'length_yards', entry, vinylItems, bulkAutofillSuggestions)}
                            placeholder="Length"
                            className="w-20"
                            name={`${entry.id}-length_yards`}
                            onTab={createTabHandler(entry.id, 'length_yards')}
                          />
                        ) : (
                          <input
                            type="number"
                            value={entry.length_yards}
                            onChange={(e) => handleBulkEntryChange(entry.id, 'length_yards', e.target.value)}
                            placeholder="Length"
                            data-field={`${entry.id}-length_yards`}
                            onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && (e.preventDefault(), createTabHandler(entry.id, 'length_yards')())}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.location || ''}
                          onChange={(e) => handleBulkEntryChange(entry.id, 'location', e.target.value)}
                          placeholder="Location"
                          data-field={`${entry.id}-location`}
                          onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && (e.preventDefault(), createTabHandler(entry.id, 'location')())}
                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-2 py-1" style={{ minWidth: '200px' }}>
                        <div className="space-y-1">
                          {entry.job_ids.map((jobId, jobIndex) => (
                            <div key={jobIndex} className="flex items-center gap-1">
                              <select
                                value={jobId || ''}
                                onChange={(e) => handleJobChange(entry.id, jobIndex, e.target.value)}
                                className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                              >
                                <option value="">Select job...</option>
                                {availableJobs.map(availableJob => (
                                  <option key={availableJob.job_id} value={availableJob.job_id}>
                                    {availableJob.customer_name} - {availableJob.job_name || availableJob.job_description}
                                  </option>
                                ))}
                              </select>
                              {entry.job_ids.length > 1 && (
                                <button
                                  onClick={() => removeJobField(entry.id, jobIndex)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <input
                          type="text"
                          value={entry.notes || ''}
                          onChange={(e) => handleBulkEntryChange(entry.id, 'notes', e.target.value)}
                          placeholder={entry.type ? `${getNotePlaceholder(entry.type)}Notes` : "Notes"}
                          data-field={`${entry.id}-notes`}
                          onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && (e.preventDefault(), createTabHandler(entry.id, 'notes')())}
                          className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* Submission State Icons */}
                          {entry.submissionState === 'submitting' && (
                            <Loader className="h-4 w-4 text-blue-500 animate-spin" title="Submitting..." />
                          )}
                          {entry.submissionState === 'success' && (
                            <CheckCircle className="h-4 w-4 text-green-500" title="Successfully submitted" />
                          )}
                          {entry.submissionState === 'error' && (
                            <XCircle className="h-4 w-4 text-red-500" title={entry.submissionError || "Submission failed"} />
                          )}
                          
                          {/* Validation Icons */}
                          {!entry.submissionState && hasValidationError && (
                            <AlertTriangle className="h-4 w-4 text-red-500" title="No matching inventory" />
                          )}
                          {!entry.submissionState && entry.type === 'use' && inventoryMatch === true && (
                            <span className="text-green-500 text-sm">✓</span>
                          )}
                          
                          {/* Delete Button */}
                          <button
                            onClick={() => removeBulkEntry(entry.id)}
                            disabled={bulkEntries.length === 1 || entry.submissionState === 'submitting'}
                            className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};