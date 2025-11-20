import React from 'react';
import { Trash2, AlertTriangle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { BulkEntry } from '../../../hooks/useBulkEntries';
import { JobSuggestion, VinylItem, VinylAutofillSuggestions } from '../types';
import { AutofillComboBox } from '../../common/AutofillComboBox';
import { VinylProductSelector } from './VinylProductSelector';
import {
  USE_AUTOFILL_TYPES,
  getNotePlaceholder,
  getRowBackgroundColor
} from '../../../services/bulkEntry/bulkEntryLogic';
import { hasMatchingInventory } from '../../../services/bulkEntry/bulkEntryValidation';

interface BulkEntryRowProps {
  entry: BulkEntry;
  vinylItems: VinylItem[];
  bulkAutofillSuggestions: VinylAutofillSuggestions;
  availableJobs: JobSuggestion[];
  bulkLoadingSuggestions: boolean;
  widthSuggestions: string[];
  lengthSuggestions: string[];
  canDelete: boolean;
  onUpdateEntry: (updates: Partial<BulkEntry>) => void;
  onRemoveEntry: () => void;
  onFieldChange: (field: keyof BulkEntry, value: string) => void;
  onVinylProductChange: (value: {
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  }) => void;
  onSpecificVinylSelect: (vinylItem: VinylItem) => void;
  onJobChange: (jobIndex: number, value: string) => void;
  onRemoveJob: (jobIndex: number) => void;
  onTabPress: (currentField: string) => void;
  onSuggestionsNeeded?: () => void;
}

/**
 * Individual row component for bulk entry table
 */
export const BulkEntryRow: React.FC<BulkEntryRowProps> = ({
  entry,
  vinylItems,
  bulkAutofillSuggestions,
  availableJobs,
  bulkLoadingSuggestions,
  widthSuggestions,
  lengthSuggestions,
  canDelete,
  onUpdateEntry,
  onRemoveEntry,
  onFieldChange,
  onVinylProductChange,
  onSpecificVinylSelect,
  onJobChange,
  onRemoveJob,
  onTabPress,
  onSuggestionsNeeded
}) => {
  const inventoryMatch = hasMatchingInventory(entry, vinylItems);
  const hasValidationError = entry.type === 'use' && inventoryMatch === false;
  const rowBgColor = getRowBackgroundColor(entry, hasValidationError);

  return (
    <tr className={`hover:bg-gray-50 ${rowBgColor}`}>
      {/* Type Field */}
      <td className="px-2 py-1 whitespace-nowrap">
        <select
          value={entry.type}
          onChange={(e) => onUpdateEntry({ type: e.target.value as BulkEntry['type'] })}
          data-field={`${entry.id}-type`}
          onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && (e.preventDefault(), onTabPress('type'))}
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

      {/* Vinyl Product Field */}
      <td className="px-2 py-1 whitespace-nowrap" style={{ minWidth: '280px' }}>
        <VinylProductSelector
          entry={entry}
          vinylItems={vinylItems}
          bulkAutofillSuggestions={bulkAutofillSuggestions}
          bulkLoadingSuggestions={bulkLoadingSuggestions}
          onChange={onVinylProductChange}
          onSpecificSelect={onSpecificVinylSelect}
          onTab={() => onTabPress('vinyl_product')}
          onSuggestionsNeeded={onSuggestionsNeeded}
        />
      </td>

      {/* Width Field */}
      <td className="px-2 py-1 whitespace-nowrap">
        <AutofillComboBox
          label=""
          value={entry.width}
          onChange={(value) => onFieldChange('width', value)}
          suggestions={widthSuggestions}
          placeholder="Width"
          className="w-20"
          name={`${entry.id}-width`}
          onTab={() => onTabPress('width')}
          onSuggestionsNeeded={onSuggestionsNeeded}
          disabled={USE_AUTOFILL_TYPES.has(entry.type)}
        />
      </td>

      {/* Length Field */}
      <td className="px-2 py-1 whitespace-nowrap">
        {USE_AUTOFILL_TYPES.has(entry.type) ? (
          <AutofillComboBox
            label=""
            value={entry.length_yards}
            onChange={(value) => onFieldChange('length_yards', value)}
            suggestions={lengthSuggestions}
            placeholder="Length"
            className="w-20"
            name={`${entry.id}-length_yards`}
            onTab={() => onTabPress('length_yards')}
            onSuggestionsNeeded={onSuggestionsNeeded}
            disabled={true}
          />
        ) : (
          <input
            type="number"
            value={entry.length_yards}
            onChange={(e) => onFieldChange('length_yards', e.target.value)}
            placeholder="Length"
            data-field={`${entry.id}-length_yards`}
            onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && (e.preventDefault(), onTabPress('length_yards'))}
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        )}
      </td>

      {/* Location Field */}
      <td className="px-2 py-1 whitespace-nowrap">
        <input
          type="text"
          value={entry.location || ''}
          onChange={(e) => onFieldChange('location', e.target.value)}
          placeholder="Location"
          data-field={`${entry.id}-location`}
          onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && (e.preventDefault(), onTabPress('location'))}
          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </td>

      {/* Jobs Field */}
      <td className="px-2 py-1" style={{ minWidth: '120px' }}>
        <div className="space-y-1">
          {entry.job_ids.map((jobId, jobIndex) => (
            <div key={jobIndex} className="flex items-center gap-1">
              <select
                value={jobId || ''}
                onChange={(e) => onJobChange(jobIndex, e.target.value)}
                className="flex-1 min-w-0 max-w-[250px] px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 truncate"
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
                  onClick={() => onRemoveJob(jobIndex)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </td>

      {/* Notes Field */}
      <td className="px-2 py-1 whitespace-nowrap">
        <input
          type="text"
          value={entry.notes || ''}
          onChange={(e) => onFieldChange('notes', e.target.value)}
          placeholder={entry.type ? `${getNotePlaceholder(entry.type)}Notes` : "Notes"}
          data-field={`${entry.id}-notes`}
          onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && (e.preventDefault(), onTabPress('notes'))}
          className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </td>

      {/* Actions Field */}
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
            onClick={onRemoveEntry}
            disabled={!canDelete || entry.submissionState === 'submitting'}
            className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default BulkEntryRow;