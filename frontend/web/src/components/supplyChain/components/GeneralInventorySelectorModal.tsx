/**
 * General Inventory Selector Modal
 * Select supplier products to place holds on
 * Created: 2026-02-04
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { SupplierProductWithHolds } from '../../../types/materialRequirements';
import { materialRequirementsApi } from '../../../services/api/materialRequirementsApi';

interface GeneralInventorySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (supplierProductId: number, quantity: string) => void;
  archetypeId: number;
  archetypeName?: string;
  title?: string;
}

export const GeneralInventorySelectorModal: React.FC<GeneralInventorySelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  archetypeId,
  archetypeName,
  title = 'Select from Inventory',
}) => {
  const [products, setProducts] = useState<SupplierProductWithHolds[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SupplierProductWithHolds | null>(null);
  const [quantityType, setQuantityType] = useState<'whole' | 'custom'>('whole');
  const [customQuantity, setCustomQuantity] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Load products when modal opens
  useEffect(() => {
    if (isOpen && archetypeId) {
      loadProducts();
    }
  }, [isOpen, archetypeId]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await materialRequirementsApi.getSupplierProductsWithHolds(archetypeId);
      setProducts(items);
    } catch (err) {
      console.error('Error loading supplier products:', err);
      setError('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (locationFilter) {
      filtered = filtered.filter((p) =>
        p.location?.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.product_name?.toLowerCase().includes(search) ||
          p.sku?.toLowerCase().includes(search) ||
          p.supplier_name?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [products, locationFilter, searchFilter]);

  // Parse holds summary into array
  const parseHoldsSummary = (summary: string | null): string[] => {
    if (!summary) return [];
    return summary.split('|').filter(Boolean);
  };

  // Handle selection confirmation
  const handleConfirm = () => {
    if (!selectedProduct) return;
    const quantity = quantityType === 'whole' ? 'Whole' : customQuantity;
    if (!quantity) {
      alert('Please specify a quantity');
      return;
    }
    onSelect(selectedProduct.supplier_product_id, quantity);
    onClose();
  };

  // Reset state on close
  const handleClose = () => {
    setSelectedProduct(null);
    setQuantityType('whole');
    setCustomQuantity('');
    setLocationFilter('');
    setSearchFilter('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-4 border w-11/12 max-w-4xl shadow-lg rounded bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-600 mt-1">
              {archetypeName
                ? `Select a ${archetypeName} item to place on hold`
                : 'Select an item to place on hold for this requirement'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search Products
            </label>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Name, SKU, or supplier..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
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
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No available products found</p>
            <p className="text-xs">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[28rem] overflow-y-auto mb-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.supplier_product_id}
                product={product}
                isSelected={selectedProduct?.supplier_product_id === product.supplier_product_id}
                onSelect={() => setSelectedProduct(product)}
                holds={parseHoldsSummary(product.holds_summary)}
              />
            ))}
          </div>
        )}

        {/* Quantity Selector */}
        {selectedProduct && (
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
                <span className="text-xs">Whole unit</span>
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
                  placeholder="e.g., 5 units"
                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 w-32"
                />
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center border-t pt-4">
          <div className="text-xs text-gray-600">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} available
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
              disabled={!selectedProduct}
              className="px-3 py-1.5 border border-transparent rounded shadow-sm text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Place Hold
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PRODUCT CARD SUBCOMPONENT
// ============================================================================

interface ProductCardProps {
  product: SupplierProductWithHolds;
  isSelected: boolean;
  onSelect: () => void;
  holds: string[];
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isSelected, onSelect, holds }) => {
  const availableQty = product.quantity_on_hand - product.quantity_reserved;

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
        {/* Left: Product details */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className={`h-4 w-4 ${isSelected ? 'text-purple-600' : 'text-green-500'}`} />
            <span className="font-medium text-sm">{product.product_name || 'Unnamed Product'}</span>
            {product.sku && (
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {product.sku}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div>
              <span className="font-medium text-purple-600">{availableQty}</span>
              <span className="text-gray-400"> available</span>
              {product.quantity_reserved > 0 && (
                <span className="text-orange-500 ml-1">
                  ({product.quantity_reserved} reserved)
                </span>
              )}
            </div>
            {product.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{product.location}</span>
              </div>
            )}
            <div className="text-gray-500">
              Supplier: {product.supplier_name}
            </div>
          </div>
        </div>

        {/* Right: Holds info */}
        <div className="text-right">
          {holds.length > 0 ? (
            <div className="text-xs">
              <div className="font-medium text-orange-600 mb-1">
                {holds.length} hold{holds.length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-0.5 max-w-[180px]">
                {holds.slice(0, 3).map((hold, idx) => (
                  <div key={idx} className="text-blue-600 truncate text-right">
                    {hold}
                  </div>
                ))}
                {holds.length > 3 && (
                  <div className="text-gray-400">+{holds.length - 3} more</div>
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

export default GeneralInventorySelectorModal;
