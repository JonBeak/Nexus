import React, { useCallback, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { BulkEntry } from '../../hooks/useBulkEntries';
import { JobSuggestion, VinylItem, VinylAutofillSuggestions } from './types';
import { CombinedVinylDropdown } from '../common/CombinedVinylDropdown';
import { VinylSpecificSelector } from '../common/VinylSpecificSelector';
import { AutofillComboBox } from '../common/AutofillComboBox';
import { 
  buildColourMapping, 
  getBulkSuggestions, 
  hasMatchingInventory, 
  getNotePlaceholder 
} from '../../utils/bulkEntryValidation';

const USE_AUTOFILL_TYPES = new Set<BulkEntry['type']>(['use', 'waste', 'returned', 'damaged']);
const DEFAULT_WIDTH_OPTIONS = ['48', '24', '60', '54', '12'];

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
  clearSuccessfulEntries?: () => void;
  ensureSuggestionsLoaded?: () => void;
}

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
  clearSuccessfulEntries,
  ensureSuggestionsLoaded
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

  const suggestionCache = useMemo(() => {
    const cache = new Map<string, { width: string[]; length_yards: string[] }>();
    const suggestionsSource = bulkAutofillSuggestions;

    bulkEntries.forEach((entry) => {
      const shouldAutofill = USE_AUTOFILL_TYPES.has(entry.type);
      const widthSuggestions = shouldAutofill
        ? getBulkSuggestions(entry.id, 'width', entry, vinylItems, suggestionsSource)
        : DEFAULT_WIDTH_OPTIONS;

      const lengthSuggestions = shouldAutofill
        ? getBulkSuggestions(entry.id, 'length_yards', entry, vinylItems, suggestionsSource)
        : [];

      cache.set(entry.id, {
        width: widthSuggestions,
        length_yards: lengthSuggestions
      });
    });

    return cache;
  }, [bulkEntries, vinylItems, bulkAutofillSuggestions]);

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

    const entry = bulkEntries.find(e => e.id === entryId);
    const updatedEntry = entry ? { ...entry, ...baseUpdates } : undefined;

    if (!isClearingSelection && updatedEntry) {
      if (!updatedEntry.width?.trim()) {
        const widthSuggestions = getBulkSuggestions(entryId, 'width', updatedEntry, vinylItems, bulkAutofillSuggestions);
        if (widthSuggestions.length === 1) {
          baseUpdates.width = widthSuggestions[0];
        }
      }
    }

    updateBulkEntry(entryId, baseUpdates);

    // Show specific vinyl selector for 'use' type entries
    if (!isClearingSelection && entry && (entry.type === 'use' || entry.type === 'waste' || entry.type === 'returned' || entry.type === 'damaged') && 
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

    // Smart autofill logic limited to non-product interactions
    if (field === 'type') {
      if (value !== 'store') {
        updates.location = '';
      }

      const prefix = getNotePlaceholder(value);
      const currentNotes = entry.notes || '';
      const prefixes = ['Storage: ', 'Usage: ', 'Waste: ', 'Return: ', 'Damage: '];
      const startsWithPrefix = prefixes.some(p => currentNotes.startsWith(p));

      if (!currentNotes || startsWithPrefix) {
        updates.notes = prefix + (startsWithPrefix ? currentNotes.substring(currentNotes.indexOf(' ') + 1) : currentNotes);
      }
    }

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
                            onSuggestionsNeeded={ensureSuggestionsLoaded}
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
                          suggestions={USE_AUTOFILL_TYPES.has(entry.type)
                            ? suggestionCache.get(entry.id)?.width || []
                            : DEFAULT_WIDTH_OPTIONS
                          }
                          placeholder="Width"
                          className="w-20"
                          name={`${entry.id}-width`}
                          onTab={createTabHandler(entry.id, 'width')}
                          onSuggestionsNeeded={ensureSuggestionsLoaded}
                        />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {['use', 'waste', 'returned', 'damaged'].includes(entry.type) ? (
                          <AutofillComboBox
                            label=""
                            value={entry.length_yards}
                            onChange={(value) => handleBulkEntryChange(entry.id, 'length_yards', value)}
                            suggestions={suggestionCache.get(entry.id)?.length_yards || []}
                            placeholder="Length"
                            className="w-20"
                            name={`${entry.id}-length_yards`}
                            onTab={createTabHandler(entry.id, 'length_yards')}
                            onSuggestionsNeeded={ensureSuggestionsLoaded}
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
