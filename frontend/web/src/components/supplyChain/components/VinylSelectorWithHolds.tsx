/**
 * Vinyl Selector With Holds
 * Enhanced vinyl selector showing holds and allowing quantity selection
 * Now includes visual 2D selector for intuitive size-based selection
 * Created: 2026-02-04
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Package, MapPin, Calendar, CheckCircle, AlertCircle, Eye, List } from 'lucide-react';
import { VinylItemWithHolds, VinylHold } from '../../../types/materialRequirements';
import { materialRequirementsApi } from '../../../services/api/materialRequirementsApi';
import { VinylVisualSelector } from './VinylVisualSelector';

interface VinylSelectorWithHoldsProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (vinylId: number, quantity: string) => void;
  vinylProductId: number;
  title?: string;
  requirementSize?: string | null;
  requirementQty?: number;
}

export const VinylSelectorWithHolds: React.FC<VinylSelectorWithHoldsProps> = ({
  isOpen,
  onClose,
  onSelect,
  vinylProductId,
  title = 'Select Vinyl from Inventory',
  requirementSize,
  requirementQty,
}) => {
  const [vinylItems, setVinylItems] = useState<VinylItemWithHolds[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<VinylItemWithHolds | null>(null);
  const [quantityType, setQuantityType] = useState<'whole' | 'custom'>('whole');
  const [customQuantity, setCustomQuantity] = useState('');
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to selected item in list when selection changes
  useEffect(() => {
    if (selectedItem && listContainerRef.current && viewMode === 'visual') {
      const selectedElement = listContainerRef.current.querySelector(`[data-vinyl-id="${selectedItem.id}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedItem, viewMode]);

  // Load vinyl items when modal opens
  useEffect(() => {
    if (isOpen && vinylProductId) {
      loadVinylItems();
    }
  }, [isOpen, vinylProductId]);

  const loadVinylItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await materialRequirementsApi.getAvailableVinylWithHolds(vinylProductId);
      setVinylItems(items);
    } catch (err) {
      console.error('Error loading vinyl items:', err);
      setError('Failed to load vinyl inventory');
    } finally {
      setLoading(false);
    }
  };


  // Handle selection confirmation
  const handleConfirm = () => {
    if (!selectedItem) return;
    const quantity = quantityType === 'whole' ? 'Whole' : customQuantity;
    if (!quantity) {
      alert('Please specify a quantity');
      return;
    }
    onSelect(selectedItem.id, quantity);
    onClose();
  };

  // Reset state on close
  const handleClose = () => {
    setSelectedItem(null);
    setQuantityType('whole');
    setCustomQuantity('');
    setViewMode('visual');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-4 border w-11/12 max-w-6xl shadow-lg rounded bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-xs text-gray-600">
                Select a vinyl piece to place on hold for this requirement
              </p>
              {(requirementSize || requirementQty) && (
                <div className="flex items-center gap-2 text-xs">
                  {requirementSize && (
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                      Size: {requirementSize}
                    </span>
                  )}
                  {requirementQty !== undefined && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                      Qty: {requirementQty}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* View Mode Toggle */}
        {!loading && !error && vinylItems.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500">View:</span>
            <button
              onClick={() => setViewMode('visual')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'visual'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Eye className="h-3 w-3" />
              Visual
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <List className="h-3 w-3" />
              List
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        ) : vinylItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No available vinyl items found</p>
          </div>
        ) : viewMode === 'visual' ? (
          /* Two-panel layout: Visual selector left, compact list right */
          <div className="flex gap-4 mb-4">
            {/* Visual Selector - Left Panel */}
            <div className="flex-1 min-w-0">
              <VinylVisualSelector
                vinylItems={vinylItems}
                selectedItemId={selectedItem?.id ?? null}
                onSelect={setSelectedItem}
              />
            </div>
            {/* Compact List - Right Panel */}
            <div className="w-72 flex-shrink-0 border-l pl-4">
              <div className="text-xs font-medium text-gray-700 mb-2">
                Items ({vinylItems.length})
              </div>
              <div ref={listContainerRef} className="space-y-1.5 max-h-96 overflow-y-auto">
                {[...vinylItems].sort((a, b) => b.length_yards - a.length_yards).map((item) => (
                  <div
                    key={item.id}
                    data-vinyl-id={item.id}
                    onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                    className={`p-2 rounded cursor-pointer text-xs transition-all ${
                      selectedItem?.id === item.id
                        ? 'bg-purple-100 border border-purple-300'
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">#{item.id}</span>
                      <span className="text-gray-500">
                        {item.width}" × {item.length_yards}yd
                      </span>
                    </div>
                    {item.location && (
                      <div className="text-gray-400 mt-0.5 truncate">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        {item.location}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-gray-600 mt-0.5 italic truncate">
                        {item.notes}
                      </div>
                    )}
                    {item.holds.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-gray-200">
                        <div className="text-orange-600 font-medium">
                          {item.holds.length} hold{item.holds.length !== 1 ? 's' : ''}
                        </div>
                        <div className="space-y-0.5 mt-0.5">
                          {item.holds.slice(0, 2).map((hold) => (
                            <div key={hold.hold_id} className="text-blue-600 truncate">
                              {hold.quantity_held} - {hold.order_number || 'Stock'}: {hold.order_name || 'N/A'}
                            </div>
                          ))}
                          {item.holds.length > 2 && (
                            <div className="text-gray-400">+{item.holds.length - 2} more</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Full list view */
          <div className="space-y-2 max-h-[28rem] overflow-y-auto mb-4">
            {vinylItems.map((item) => (
              <VinylItemCard
                key={item.id}
                item={item}
                isSelected={selectedItem?.id === item.id}
                onSelect={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
              />
            ))}
          </div>
        )}

        {/* Quantity Selector */}
        {selectedItem && (
          <div className="border-t pt-4 mb-4">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-gray-700">Quantity to Hold:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="quantityType"
                  value="whole"
                  checked={quantityType === 'whole'}
                  onChange={() => setQuantityType('whole')}
                  className="text-purple-600"
                />
                <span className="text-xs">Whole piece</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="quantityType"
                  value="custom"
                  checked={quantityType === 'custom'}
                  onChange={() => setQuantityType('custom')}
                  className="text-purple-600"
                />
                <span className="text-xs">Custom:</span>
              </label>
              {quantityType === 'custom' && (
                <input
                  type="text"
                  value={customQuantity}
                  onChange={(e) => setCustomQuantity(e.target.value)}
                  placeholder="e.g., 50 sq ft"
                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
                />
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center border-t pt-4">
          <div className="text-xs text-gray-600">
            {vinylItems.length} item{vinylItems.length !== 1 ? 's' : ''} available
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedItem}
              className="px-3 py-1.5 border border-transparent rounded shadow-sm text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Place Hold {selectedItem ? `on #${selectedItem.id}` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// VINYL ITEM CARD SUBCOMPONENT
// ============================================================================

interface VinylItemCardProps {
  item: VinylItemWithHolds;
  isSelected: boolean;
  onSelect: () => void;
}

const VinylItemCard: React.FC<VinylItemCardProps> = ({ item, isSelected, onSelect }) => {
  return (
    <div
      onClick={onSelect}
      className={`border rounded p-3 cursor-pointer transition-all duration-200 hover:shadow-sm ${
        isSelected
          ? 'border-purple-500 bg-purple-50 shadow-sm'
          : 'border-gray-200 hover:border-purple-300'
      }`}
    >
      <div className="flex items-start justify-between">
        {/* Left: Item details */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className={`h-4 w-4 ${isSelected ? 'text-purple-600' : 'text-green-500'}`} />
            <span className="font-medium text-sm">#{item.id}</span>
            <span className="text-xs text-gray-500">
              {item.brand} {item.series}
            </span>
            {item.colour_number && (
              <span className="text-xs text-gray-600">
                - {item.colour_number} {item.colour_name || ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <span className="font-medium">{item.width}"</span>
              <span>×</span>
              <span className="font-medium text-purple-600">{item.length_yards} yds</span>
            </div>
            {item.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{item.location}</span>
              </div>
            )}
            {item.storage_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Stored: {new Date(item.storage_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Holds info */}
        <div className="text-right">
          {item.holds && item.holds.length > 0 ? (
            <div className="text-xs">
              <div className="font-medium text-orange-600 mb-1">
                {item.holds.length} hold{item.holds.length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-0.5 max-w-[200px]">
                {item.holds.slice(0, 3).map((hold) => (
                  <HoldBadge key={hold.hold_id} hold={hold} />
                ))}
                {item.holds.length > 3 && (
                  <div className="text-gray-400">+{item.holds.length - 3} more</div>
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs text-green-600">No holds</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// HOLD BADGE SUBCOMPONENT
// ============================================================================

interface HoldBadgeProps {
  hold: VinylHold;
}

const HoldBadge: React.FC<HoldBadgeProps> = ({ hold }) => {
  return (
    <div className="text-xs text-blue-600 truncate">
      {hold.quantity_held} - {hold.order_number || 'Stock'}: {hold.order_name || 'N/A'}
    </div>
  );
};

export default VinylSelectorWithHolds;
