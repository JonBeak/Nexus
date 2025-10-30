import React from 'react';
import { BulkEntry } from '../../../hooks/useBulkEntries';
import { VinylItem, VinylAutofillSuggestions } from '../types';
import { CombinedVinylDropdown } from '../../common/CombinedVinylDropdown';
import { VinylSpecificSelector } from '../../common/VinylSpecificSelector';

interface VinylProductSelectorProps {
  entry: BulkEntry;
  vinylItems: VinylItem[];
  bulkAutofillSuggestions: VinylAutofillSuggestions;
  bulkLoadingSuggestions: boolean;
  onChange: (value: {
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  }) => void;
  onSpecificSelect: (vinylItem: VinylItem) => void;
  onTab: () => void;
  onSuggestionsNeeded?: () => void;
}

/**
 * Vinyl product selection component with specific piece selector
 */
export const VinylProductSelector: React.FC<VinylProductSelectorProps> = ({
  entry,
  vinylItems,
  bulkAutofillSuggestions,
  bulkLoadingSuggestions,
  onChange,
  onSpecificSelect,
  onTab,
  onSuggestionsNeeded
}) => {
  const [specificSelectorOpen, setSpecificSelectorOpen] = React.useState(false);
  const prevSpecsRef = React.useRef({ brand: '', series: '', colour_number: '', colour_name: '' });

  // Auto-open specific selector when vinyl specifications are complete
  React.useEffect(() => {
    const shouldAutoOpen = ['use', 'waste', 'returned', 'damaged'].includes(entry.type) &&
      entry.brand && entry.series && (entry.colour_number || entry.colour_name);

    // Check if specifications have changed
    const specsChanged =
      prevSpecsRef.current.brand !== entry.brand ||
      prevSpecsRef.current.series !== entry.series ||
      prevSpecsRef.current.colour_number !== entry.colour_number ||
      prevSpecsRef.current.colour_name !== entry.colour_name;

    // Update ref
    prevSpecsRef.current = {
      brand: entry.brand || '',
      series: entry.series || '',
      colour_number: entry.colour_number || '',
      colour_name: entry.colour_name || ''
    };

    // Auto-open modal if conditions met and specs just changed
    if (shouldAutoOpen && specsChanged && !specificSelectorOpen) {
      setSpecificSelectorOpen(true);
    }
  }, [entry.type, entry.brand, entry.series, entry.colour_number, entry.colour_name, specificSelectorOpen]);

  const handleOpenSpecificSelector = () => {
    if (entry.brand && entry.series && (entry.colour_number || entry.colour_name)) {
      setSpecificSelectorOpen(true);
    }
  };

  const handleSpecificSelect = (vinylItem: VinylItem) => {
    onSpecificSelect(vinylItem);
    setSpecificSelectorOpen(false);
  };

  const shouldShowSpecificButton = ['use', 'waste', 'returned', 'damaged'].includes(entry.type) &&
    entry.brand && entry.series && (entry.colour_number || entry.colour_name);

  return (
    <div className="space-y-2">
      {/* Combined Vinyl Dropdown */}
      <CombinedVinylDropdown
        label=""
        value={{
          brand: entry.brand || '',
          series: entry.series || '',
          colour_number: entry.colour_number || '',
          colour_name: entry.colour_name || ''
        }}
        onChange={onChange}
        combinations={bulkAutofillSuggestions.combinations || []}
        placeholder="Search vinyl products..."
        className="w-full"
        name={`${entry.id}-vinyl_product`}
        loading={bulkLoadingSuggestions}
        onTab={onTab}
        onSuggestionsNeeded={onSuggestionsNeeded}
      />

      {/* Specific vinyl indicator */}
      {entry.specific_vinyl_id && (
        <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
          Specific vinyl #{entry.specific_vinyl_id} selected
        </div>
      )}

      {/* Specific selector button */}
      {shouldShowSpecificButton && (
        <button
          type="button"
          onClick={handleOpenSpecificSelector}
          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 w-full"
        >
          Choose Specific Piece
        </button>
      )}

      {/* Specific Vinyl Selector Modal */}
      <VinylSpecificSelector
        isOpen={specificSelectorOpen}
        onClose={() => setSpecificSelectorOpen(false)}
        onSelect={handleSpecificSelect}
        specifications={{
          brand: entry.brand || '',
          series: entry.series || '',
          colour_number: entry.colour_number || '',
          colour_name: entry.colour_name || ''
        }}
        vinylItems={vinylItems}
        title="Select Specific Vinyl Piece"
      />
    </div>
  );
};

export default VinylProductSelector;