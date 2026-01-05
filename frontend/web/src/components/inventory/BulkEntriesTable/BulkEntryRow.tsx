import React from 'react';
import { Trash2, AlertTriangle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { BulkEntry } from '../../../hooks/useBulkEntries';
import { JobSuggestion, VinylItem, VinylAutofillSuggestions } from '../types';
import { AutofillComboBox } from '../../common/AutofillComboBox';
import { VinylProductSelector } from './VinylProductSelector';
import { TypeButtonGroup } from './TypeButtonGroup';
import {
  USE_AUTOFILL_TYPES,
  getNotePlaceholder,
  getRowBackgroundColor
} from '../../../services/bulkEntry/bulkEntryLogic';
import { hasMatchingInventory } from '../../../services/bulkEntry/bulkEntryValidation';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { ENTRY_TYPE_INPUT_STYLES, DISABLED_INPUT_STYLE } from '../../../constants/bulkEntryConstants';

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

  // Get type-based input background color
  const typeInputBg = entry.type ? ENTRY_TYPE_INPUT_STYLES[entry.type as keyof typeof ENTRY_TYPE_INPUT_STYLES] : '';

  // Input styling for dark theme compatibility
  const inputBaseClass = `px-2 py-1 text-sm border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.text} rounded focus:outline-none focus:ring-1 focus:ring-purple-500`;
  const inputClass = `${inputBaseClass} ${PAGE_STYLES.input.background}`;

  return (
    <tr className={`hover:bg-[var(--theme-hover-bg)] ${rowBgColor}`}>
      {/* Type Field */}
      <td className="px-2 py-1 whitespace-nowrap">
        <TypeButtonGroup
          selectedType={entry.type}
          onTypeChange={(type) => onUpdateEntry({ type })}
          variant="row"
          disabled={entry.submissionState === 'submitting'}
        />
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
          inputClassName={typeInputBg}
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
          inputClassName={USE_AUTOFILL_TYPES.has(entry.type) ? DISABLED_INPUT_STYLE : typeInputBg}
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
            inputClassName={DISABLED_INPUT_STYLE}
          />
        ) : (
          <input
            type="number"
            value={entry.length_yards}
            onChange={(e) => onFieldChange('length_yards', e.target.value)}
            placeholder="Length"
            data-field={`${entry.id}-length_yards`}
            onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && (e.preventDefault(), onTabPress('length_yards'))}
            className={`w-20 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 ${typeInputBg}`}
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
          className={`w-24 ${inputClass}`}
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
                className={`flex-1 min-w-0 max-w-[250px] truncate ${inputClass}`}
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
          className={`w-32 ${inputClass} ${entry.type !== 'store' ? typeInputBg : ''}`}
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

          {/* Validation Warning */}
          {!entry.submissionState && hasValidationError && (
            <AlertTriangle className="h-4 w-4 text-red-500" title="No matching inventory" />
          )}

          {/* Delete Button */}
          <button
            onClick={onRemoveEntry}
            disabled={!canDelete || entry.submissionState === 'submitting'}
            className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* Valid Entry Checkmark */}
          {!entry.submissionState && USE_AUTOFILL_TYPES.has(entry.type) && inventoryMatch === true && (
            <CheckCircle className="h-5 w-5 text-green-500" title="Matching inventory found" />
          )}
        </div>
      </td>
    </tr>
  );
};

export default BulkEntryRow;