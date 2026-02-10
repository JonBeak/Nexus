/**
 * Vinyl Inventory Selector
 * Unified modal for selecting vinyl from inventory.
 *
 * Two modes:
 * - 'hold': Supply Chain flow — selects vinyl + quantity for placing a hold (vinylProductId lookup)
 * - 'select': Bulk Entries flow — selects a specific vinyl piece (raw specs lookup)
 *
 * Features merged from VinylSelectorWithHolds + VinylSpecificSelector:
 * - Visual 2D selector + list toggle
 * - Holds display with badges
 * - Order associations on cards
 * - Availability color coding
 * - Supplier info, dates, notes
 * - Quantity selector (hold mode only)
 * - Loading/error/empty states
 * - State reset on close
 * - Scroll-to-selected in side panel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Package, AlertCircle, MapPin, Eye, List } from 'lucide-react';
import { VinylItemWithHolds } from '../../../types/materialRequirements';
import { materialRequirementsApi } from '../../../services/api/materialRequirementsApi';
import { VinylVisualSelector } from '../../supplyChain/components/VinylVisualSelector';
import { VinylSelectorItemCard } from './VinylSelectorItemCard';
import { VinylSelectorQuantityPicker } from './VinylSelectorQuantityPicker';
import { VinylInventorySelectorProps } from './types';

export const VinylInventorySelector: React.FC<VinylInventorySelectorProps> = (props) => {
  const { isOpen, onClose, title } = props;

  const [vinylItems, setVinylItems] = useState<VinylItemWithHolds[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<VinylItemWithHolds | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');

  // Hold mode state
  const [quantityType, setQuantityType] = useState<'whole' | 'custom'>('whole');
  const [customQuantity, setCustomQuantity] = useState('');

  const listContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to selected item in side panel
  useEffect(() => {
    if (selectedItem && listContainerRef.current && viewMode === 'visual') {
      const el = listContainerRef.current.querySelector(`[data-vinyl-id="${selectedItem.id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedItem, viewMode]);

  // Load vinyl items when modal opens
  useEffect(() => {
    if (!isOpen) return;
    loadVinylItems();
  }, [isOpen]);

  const loadVinylItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = props.mode === 'hold'
        ? { vinylProductId: props.vinylProductId }
        : {
            brand: props.specifications.brand,
            series: props.specifications.series,
            colour_number: props.specifications.colour_number,
            colour_name: props.specifications.colour_name,
          };
      const items = await materialRequirementsApi.getAvailableVinylWithHolds(params);
      setVinylItems(items);
    } catch (err) {
      console.error('Error loading vinyl items:', err);
      setError('Failed to load vinyl inventory');
    } finally {
      setLoading(false);
    }
  };

  // Confirm selection
  const handleConfirm = () => {
    if (!selectedItem) return;
    if (props.mode === 'hold') {
      const quantity = quantityType === 'whole' ? 'Whole' : customQuantity;
      if (!quantity) {
        alert('Please specify a quantity');
        return;
      }
      props.onSelect(selectedItem.id, quantity);
    } else {
      props.onSelect(selectedItem);
    }
    handleClose();
  };

  // Reset state on close
  const handleClose = () => {
    setSelectedItem(null);
    setQuantityType('whole');
    setCustomQuantity('');
    setViewMode('visual');
    onClose();
  };

  // Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Derive display info
  const modalTitle = title || (props.mode === 'hold' ? 'Select Vinyl from Inventory' : 'Select Specific Vinyl Piece');
  const confirmLabel = props.mode === 'hold'
    ? `Place Hold${selectedItem ? ` on #${selectedItem.id}` : ''}`
    : `Select Item${selectedItem ? ` #${selectedItem.id}` : ''}`;
  const subtitle = props.mode === 'hold'
    ? 'Select a vinyl piece to place on hold for this requirement'
    : `${(props as any).specifications?.brand} ${(props as any).specifications?.series}`;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="relative top-4 mx-auto p-4 border w-11/12 max-w-6xl shadow-lg rounded bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{modalTitle}</h3>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-xs text-gray-600">{subtitle}</p>
              {props.mode === 'hold' && (props.requirementSize || props.requirementQty) && (
                <div className="flex items-center gap-2 text-xs">
                  {props.requirementSize && (
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                      Size: {props.requirementSize}
                    </span>
                  )}
                  {props.requirementQty !== undefined && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                      Qty: {props.requirementQty}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
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
            <p className="text-xs mt-1">No in-stock items match this specification</p>
          </div>
        ) : viewMode === 'visual' ? (
          /* Two-panel layout: Visual selector left, compact list right */
          <div className="flex gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <VinylVisualSelector
                vinylItems={vinylItems}
                selectedItemId={selectedItem?.id ?? null}
                onSelect={setSelectedItem}
              />
            </div>
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
                        {item.width}" &times; {item.length_yards}yd ({Math.round(item.length_yards * 36)}")
                      </span>
                    </div>
                    {item.location && (
                      <div className="text-gray-400 mt-0.5 truncate">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        {item.location}
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-gray-600 mt-0.5 italic truncate">{item.notes}</div>
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
                    {item.order_associations && item.order_associations.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-gray-200">
                        {item.order_associations.slice(0, 2).map((o, i) => (
                          <div key={i} className="text-blue-600 truncate">
                            {o.order_number} - {o.customer_name}
                          </div>
                        ))}
                        {item.order_associations.length > 2 && (
                          <div className="text-gray-400">+{item.order_associations.length - 2} more</div>
                        )}
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
              <VinylSelectorItemCard
                key={item.id}
                item={item}
                isSelected={selectedItem?.id === item.id}
                onSelect={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
              />
            ))}
          </div>
        )}

        {/* Quantity Selector (hold mode only) */}
        {props.mode === 'hold' && selectedItem && (
          <VinylSelectorQuantityPicker
            quantityType={quantityType}
            customQuantity={customQuantity}
            onQuantityTypeChange={setQuantityType}
            onCustomQuantityChange={setCustomQuantity}
          />
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
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VinylInventorySelector;
