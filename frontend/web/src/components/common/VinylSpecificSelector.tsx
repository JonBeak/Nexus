import React, { useState, useEffect } from 'react';
import { X, Package, MapPin, Calendar, User, CheckCircle } from 'lucide-react';
import { VinylItem } from '../inventory/types';

interface VinylSpecificSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (vinylItem: VinylItem) => void;
  specifications: {
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
  };
  vinylItems: VinylItem[];
  title?: string;
}

interface VinylItemWithJobs extends VinylItem {
  jobDetails?: string[];
  availabilityStatus: 'available' | 'insufficient';
  remainingQuantity: number;
}

export const VinylSpecificSelector: React.FC<VinylSpecificSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  specifications,
  vinylItems,
  title = "Select Specific Vinyl Item"
}) => {
  const [matchingItems, setMatchingItems] = useState<VinylItemWithJobs[]>([]);
  const [filteredItems, setFilteredItems] = useState<VinylItemWithJobs[]>([]);
  const [dispositionFilter, setDispositionFilter] = useState<string>('in_stock');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<VinylItemWithJobs | null>(null);

  useEffect(() => {
    if (isOpen && specifications.brand && specifications.series) {
      const matching = vinylItems.filter(item => {
        // Basic specification matching
        const brandMatch = item.brand === specifications.brand;
        const seriesMatch = item.series === specifications.series;
        
        // Color matching - flexible to handle partial matches
        let colorMatch = true;
        if (specifications.colour_number || specifications.colour_name) {
          const numberMatch = specifications.colour_number 
            ? item.colour_number === specifications.colour_number
            : true;
          const nameMatch = specifications.colour_name
            ? item.colour_name?.toLowerCase() === specifications.colour_name.toLowerCase()
            : true;
          colorMatch = numberMatch && nameMatch;
        }

        return brandMatch && seriesMatch && colorMatch;
      }).map(item => {
        // Calculate availability status and remaining quantity
        const currentLength = parseFloat(item.length_yards?.toString() || '0');
        let availabilityStatus: 'available' | 'partial' | 'insufficient' = 'available';
        let remainingQuantity = currentLength;

        if (item.disposition !== 'in_stock') {
          availabilityStatus = 'insufficient';
          remainingQuantity = 0;
        } else if (currentLength <= 0) {
          // Only mark as insufficient if there's actually no material left
          availabilityStatus = 'insufficient';
        }
        // Remove the < 1 yard = partial logic since small pieces are still usable

        // Format order details using unified order_associations
        const jobDetails: string[] = [];
        if (item.order_associations?.length) {
          jobDetails.push(`Associated with: ${item.order_associations.map(o => `${o.order_number} - ${o.customer_name}`).join(', ')}`);
        }

        return {
          ...item,
          jobDetails,
          availabilityStatus,
          remainingQuantity
        } as VinylItemWithJobs;
      }).sort((a, b) => {
        // Sort by availability first, then by remaining quantity descending
        if (a.availabilityStatus !== b.availabilityStatus) {
          const order = { 'available': 0, 'insufficient': 1 };
          return order[a.availabilityStatus] - order[b.availabilityStatus];
        }
        return b.remainingQuantity - a.remainingQuantity;
      });

      setMatchingItems(matching);
      setFilteredItems(matching);
    }
  }, [isOpen, specifications, vinylItems]);

  useEffect(() => {
    let filtered = matchingItems;

    // Filter by disposition
    if (dispositionFilter !== 'all') {
      filtered = filtered.filter(item => item.disposition === dispositionFilter);
    }

    // Filter by location
    if (locationFilter) {
      filtered = filtered.filter(item => 
        item.location?.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  }, [matchingItems, dispositionFilter, locationFilter]);

  const handleItemSelect = (item: VinylItemWithJobs) => {
    setSelectedItem(item);
  };

  const handleConfirmSelection = () => {
    if (selectedItem) {
      onSelect(selectedItem);
      onClose();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'insufficient':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'border-green-200 bg-green-50';
      case 'insufficient':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200';
    }
  };

  const getDispositionBadgeColor = (disposition: string) => {
    switch (disposition) {
      case 'in_stock':
        return 'bg-green-100 text-green-800';
      case 'used':
        return 'bg-gray-100 text-gray-800';
      case 'waste':
        return 'bg-orange-100 text-orange-800';
      case 'returned':
        return 'bg-blue-100 text-blue-800';
      case 'damaged':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-4 border w-11/12 max-w-5xl shadow-lg rounded bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-600 mt-1">
              {specifications.brand} {specifications.series} - {specifications.colour_number} {specifications.colour_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              value={dispositionFilter}
              onChange={(e) => setDispositionFilter(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="all">All Items</option>
              <option value="in_stock">In Stock</option>
              <option value="used">Used</option>
              <option value="waste">Waste</option>
              <option value="returned">Returned</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filter by Location
            </label>
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Enter location..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-2 max-h-[32rem] overflow-y-auto mb-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No matching vinyl items found</p>
              <p className="text-xs">Try adjusting your filters or check if items exist for this specification</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`border rounded p-3 cursor-pointer transition-all duration-200 hover:shadow-sm ${
                  selectedItem?.id === item.id 
                    ? 'border-purple-500 bg-purple-50 shadow-sm' 
                    : `${getStatusColor(item.availabilityStatus)} hover:border-purple-300`
                }`}
                onClick={() => handleItemSelect(item)}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Item Details - ~17% */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(item.availabilityStatus)}
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">ID #{item.id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${getDispositionBadgeColor(item.disposition)}`}>
                          {item.disposition}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
                      {item.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{item.location}</span>
                        </div>
                      )}
                      {item.supplier_name && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>Supplier: {item.supplier_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Size Column - ~33% */}
                  <div className="lg:col-span-4 p-2">
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex items-baseline gap-1">
                        <div className="text-lg font-bold text-gray-900">
                          {item.width}"
                        </div>
                        <div className="text-xs text-gray-600">width</div>
                      </div>
                      <div className="text-gray-400">×</div>
                      <div className="flex items-baseline gap-1">
                        <div className="text-lg font-bold text-purple-600">
                          {item.remainingQuantity}
                        </div>
                        <div className="text-xs text-gray-600">yards</div>
                      </div>
                    </div>
                  </div>

                  {/* Dates - ~17% */}
                  <div className="lg:col-span-2 text-xs text-gray-600">
                    <div className="space-y-1">
                      {item.storage_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Stored: {new Date(item.storage_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {item.usage_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Used: {new Date(item.usage_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Associations - ~33% */}
                  <div className="lg:col-span-4 text-xs text-gray-600">
                    {item.jobDetails && item.jobDetails.length > 0 ? (
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Associated Orders:</div>
                        <div className="space-y-0.5">
                          {item.order_associations?.map((order, index) => (
                            <div key={index} className="text-xs text-blue-600">
                              {order.order_number} - {order.customer_name} - {order.order_name}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">No order associations</span>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {item.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Notes:</span> {item.notes}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-600">
            {filteredItems.length} of {matchingItems.length} items shown
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSelection}
              disabled={!selectedItem}
              className="px-3 py-1.5 border border-transparent rounded shadow-sm text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select Item {selectedItem ? `#${selectedItem.id}` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
