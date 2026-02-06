/**
 * ProductDropdown Component
 *
 * Searchable product selection dropdown with grouping.
 * Shows different products based on the selected Product Type (archetype):
 * - If archetype_id = 131 (Vinyl): Shows vinyl products grouped by brand/series
 * - If archetype_id > 0: Shows supplier products grouped by supplier name
 *
 * Uses portal rendering to escape table overflow clipping.
 * Input box serves as both display and search field (combobox pattern).
 *
 * Features:
 * - Type to search/filter products
 * - Products grouped by supplier (or brand for vinyl)
 * - Portal rendering to escape table overflow
 * - Click-outside to close
 * - Auto-position on scroll/resize
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { vinylProductsApi, supplierProductsApi } from '../../../services/api';
import { ARCHETYPE_VINYL } from './ProductTypeDropdown';
import { SUPPLIER_IN_STOCK, SUPPLIER_IN_HOUSE, SUPPLIER_CUSTOMER_PROVIDED } from './SupplierDropdown';

interface VinylProduct {
  product_id: number;
  brand: string | null;
  series: string | null;
  colour_number: string | null;
  colour_name: string | null;
}

interface SupplierProduct {
  supplier_product_id: number;
  product_name: string | null;
  sku: string | null;
  supplier_id: number;
  supplier_name?: string;
  archetype_id?: number;
}

export interface ProductDropdownProps {
  /** Selected product type (archetype_id). Use -1 for vinyl. */
  archetypeId: number | null;
  /** Currently selected vinyl_product_id (when archetype = vinyl) */
  vinylProductId: number | null;
  /** Currently selected supplier_product_id (when archetype > 0) */
  supplierProductId: number | null;
  /** Called when vinyl product is selected */
  onVinylProductChange: (productId: number | null) => void;
  /** Called when supplier product is selected */
  onSupplierProductChange: (productId: number | null) => void;

  /** NEW: Vendor filtering - filters supplier products to only show this vendor's products */
  supplierId?: number | null;

  /** NEW: Pre-loaded products (optional - loads internally if not provided) */
  supplierProducts?: SupplierProduct[];
  vinylProducts?: VinylProduct[];

  /** Custom free-text product type (non-vinyl archetypes only) */
  customProductType?: string | null;
  /** Called when user types custom text and blurs (non-vinyl archetypes only) */
  onCustomProductTypeChange?: (text: string) => void;

  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const ProductDropdown: React.FC<ProductDropdownProps> = ({
  archetypeId,
  vinylProductId,
  supplierProductId,
  onVinylProductChange,
  onSupplierProductChange,
  supplierId,
  supplierProducts: externalSupplierProducts,
  vinylProducts: externalVinylProducts,
  customProductType = null,
  onCustomProductTypeChange,
  disabled = false,
  placeholder = 'Select product...',
  className = '',
}) => {
  // Internal state for when products not provided externally
  const [internalVinylProducts, setInternalVinylProducts] = useState<VinylProduct[]>([]);
  const [internalSupplierProducts, setInternalSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textChangedSinceOpenRef = useRef<boolean>(false);

  const isVinylMode = archetypeId === ARCHETYPE_VINYL;

  // Use external if provided, otherwise use internal
  const vinylProducts = externalVinylProducts ?? internalVinylProducts;
  const supplierProducts = externalSupplierProducts ?? internalSupplierProducts;

  // Build vinyl product display name
  const getVinylDisplayName = (vp: VinylProduct): string => {
    const parts = [];
    if (vp.series) parts.push(vp.series);
    if (vp.colour_number) parts.push(vp.colour_number);
    const prefix = parts.join('-');
    if (vp.colour_name) {
      return prefix ? `${prefix} ${vp.colour_name}` : vp.colour_name;
    }
    return prefix || `Product #${vp.product_id}`;
  };

  // Build supplier product display name
  const getSupplierDisplayName = (sp: SupplierProduct): string => {
    if (sp.product_name && sp.sku) {
      return `${sp.product_name} (${sp.sku})`;
    }
    return sp.product_name || sp.sku || `Product #${sp.supplier_product_id}`;
  };

  // Get current display name based on selection
  const getSelectedDisplayName = useCallback((): string => {
    if (isVinylMode && vinylProductId) {
      const vp = vinylProducts.find(p => p.product_id === vinylProductId);
      if (vp) return getVinylDisplayName(vp);
      // Fallback: show loading or ID if product not found yet
      return loading ? 'Loading...' : `Product #${vinylProductId}`;
    } else if (!isVinylMode && supplierProductId) {
      const sp = supplierProducts.find(p => p.supplier_product_id === supplierProductId);
      if (sp) return getSupplierDisplayName(sp);
      return loading ? 'Loading...' : `Product #${supplierProductId}`;
    }
    // Non-vinyl: show custom product type text if no supplier product selected
    if (!isVinylMode && customProductType) {
      return customProductType;
    }
    return '';
  }, [isVinylMode, vinylProductId, supplierProductId, vinylProducts, supplierProducts, loading, customProductType]);

  // Load products based on archetype selection (only if not provided externally)
  useEffect(() => {
    if (archetypeId === null) {
      setLoading(false);
      setInternalVinylProducts([]);
      setInternalSupplierProducts([]);
      return;
    }

    // Skip loading if external products are provided
    if (isVinylMode && externalVinylProducts) {
      setLoading(false);
      return;
    }
    if (!isVinylMode && externalSupplierProducts) {
      setLoading(false);
      return;
    }

    const loadProducts = async () => {
      try {
        setLoading(true);
        if (isVinylMode) {
          const data = await vinylProductsApi.getVinylProducts({ active_only: true });
          setInternalVinylProducts(data);
          setInternalSupplierProducts([]);
        } else if (archetypeId > 0) {
          const data = await supplierProductsApi.getSupplierProductsByArchetype(archetypeId);
          setInternalSupplierProducts(data);
          setInternalVinylProducts([]);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadProducts();
  }, [archetypeId, isVinylMode, externalVinylProducts, externalSupplierProducts]);

  // Sync input value with selected product when not open
  // Wait for data to load before syncing to prevent race condition
  useEffect(() => {
    if (!isOpen && !loading) {
      setInputValue(getSelectedDisplayName());
    }
  }, [isOpen, loading, getSelectedDisplayName]);

  // Calculate dropdown position relative to viewport
  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }, []);

  // Update position when dropdown opens and on scroll/resize
  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();

    const handleScroll = () => updateDropdownPosition();
    const handleResize = () => updateDropdownPosition();

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updateDropdownPosition]);

  // Handle outside clicks including portal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        // Non-vinyl combobox: save custom text on blur if user typed something
        if (!isVinylMode && textChangedSinceOpenRef.current && onCustomProductTypeChange) {
          onCustomProductTypeChange(inputValue.trim());
          // Clear supplier product if custom text is being set
          if (supplierProductId !== null) {
            onSupplierProductChange(null);
          }
        } else {
          // Vinyl or no text change: revert to selected value
          setInputValue(getSelectedDisplayName());
        }
        textChangedSinceOpenRef.current = false;
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, getSelectedDisplayName, isVinylMode, onCustomProductTypeChange, inputValue, supplierProductId, onSupplierProductChange]);

  // Filter term is the input value when dropdown is open
  const searchTerm = isOpen ? inputValue : '';

  // Group supplier products by supplier_name
  const groupedSupplierProducts = useMemo(() => {
    const groups: Record<string, SupplierProduct[]> = {};
    const term = searchTerm.toLowerCase();

    supplierProducts
      .filter(p => {
        // Existing search filter
        const name = getSupplierDisplayName(p).toLowerCase();
        const supplier = (p.supplier_name || '').toLowerCase();
        const matchesSearch = name.includes(term) || supplier.includes(term);

        // Archetype filter — when archetypeId is set, only show products for that archetype
        const matchesArchetype = !archetypeId || !p.archetype_id || p.archetype_id === archetypeId;

        // NEW: Vendor filter
        let matchesSupplier = true;
        if (supplierId !== undefined && supplierId !== null) {
          if (supplierId === SUPPLIER_IN_STOCK || supplierId === SUPPLIER_IN_HOUSE || supplierId === SUPPLIER_CUSTOMER_PROVIDED) {
            matchesSupplier = false;  // Special vendors don't show supplier products
          } else {
            matchesSupplier = p.supplier_id === supplierId;  // Filter to selected vendor
          }
        }

        return matchesSearch && matchesArchetype && matchesSupplier;
      })
      .forEach(product => {
        const supplierKey = product.supplier_name || 'Unknown Supplier';
        if (!groups[supplierKey]) groups[supplierKey] = [];
        groups[supplierKey].push(product);
      });

    // Sort groups alphabetically
    const sortedGroups: Record<string, SupplierProduct[]> = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [supplierProducts, searchTerm, supplierId, archetypeId]);

  // Group vinyl products by brand/series
  const groupedVinylProducts = useMemo(() => {
    const groups: Record<string, VinylProduct[]> = {};
    const term = searchTerm.toLowerCase();

    vinylProducts
      .filter(vp => getVinylDisplayName(vp).toLowerCase().includes(term))
      .forEach(product => {
        const brandKey = product.brand || product.series || 'Other';
        if (!groups[brandKey]) groups[brandKey] = [];
        groups[brandKey].push(product);
      });

    // Sort groups alphabetically
    const sortedGroups: Record<string, VinylProduct[]> = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });

    return sortedGroups;
  }, [vinylProducts, searchTerm]);

  const handleSelectVinyl = useCallback((productId: number | null) => {
    onVinylProductChange(productId);
    if (productId !== null) onCustomProductTypeChange?.('');
    textChangedSinceOpenRef.current = false;
    setIsOpen(false);
  }, [onVinylProductChange, onCustomProductTypeChange]);

  const handleSelectSupplier = useCallback((productId: number | null) => {
    onSupplierProductChange(productId);
    if (productId !== null) onCustomProductTypeChange?.('');
    textChangedSinceOpenRef.current = false;
    setIsOpen(false);
  }, [onSupplierProductChange, onCustomProductTypeChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVinylMode) {
      onVinylProductChange(null);
    } else {
      onSupplierProductChange(null);
    }
    onCustomProductTypeChange?.('');
    textChangedSinceOpenRef.current = false;
    setInputValue('');
    setIsOpen(false);
  }, [isVinylMode, onVinylProductChange, onSupplierProductChange, onCustomProductTypeChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!isVinylMode) {
      textChangedSinceOpenRef.current = true;
    }
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    textChangedSinceOpenRef.current = false;
    // Select all text for easy replacement
    inputRef.current?.select();
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      textChangedSinceOpenRef.current = false;
      setInputValue(getSelectedDisplayName());
      inputRef.current?.blur();
    }
  }, [getSelectedDisplayName]);

  // Disabled state or no archetype selected
  if (disabled || archetypeId === null) {
    const displayName = getSelectedDisplayName();
    return (
      <span className={`text-xs px-1 ${PAGE_STYLES.panel.textMuted}`}>
        {archetypeId === null ? '-' : (displayName || '-')}
      </span>
    );
  }

  const hasValue = isVinylMode
    ? vinylProductId !== null
    : (supplierProductId !== null || !!(customProductType && customProductType.trim()));
  const groupCount = isVinylMode
    ? Object.keys(groupedVinylProducts).length
    : Object.keys(groupedSupplierProducts).length;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input box - serves as both display and search */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading...' : placeholder}
          className={`w-full px-1.5 py-1.5 pr-8 text-xs border rounded-none
            ${PAGE_STYLES.input.text} bg-white border-gray-300 hover:border-gray-400
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          {hasValue && (
            <X
              className="w-3 h-3 text-gray-400 hover:text-gray-600 cursor-pointer"
              onClick={handleClear}
            />
          )}
          <ChevronDown
            className={`w-3 h-3 text-gray-400 cursor-pointer transition-transform ${isOpen ? 'rotate-180' : ''}`}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setInputValue(getSelectedDisplayName());
              } else {
                setIsOpen(true);
                inputRef.current?.focus();
              }
            }}
          />
        </div>
      </div>

      {/* Dropdown panel - rendered via portal */}
      {isOpen && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-md shadow-lg"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
        >
          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
            ) : groupCount === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">
                {searchTerm ? 'No matches' : 'No products available'}
              </div>
            ) : (
              <>
                {/* Clear option */}
                {hasValue && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isVinylMode) {
                        handleSelectVinyl(null);
                      } else {
                        handleSelectSupplier(null);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs text-left text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                  >
                    Clear selection
                  </button>
                )}

                {/* Vinyl products grouped by brand */}
                {isVinylMode && Object.entries(groupedVinylProducts).map(([brand, products]) => (
                  <div key={brand}>
                    {/* Brand header */}
                    <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                      {brand}
                    </div>
                    {/* Products in brand */}
                    {products.map((product) => (
                      <button
                        key={product.product_id}
                        type="button"
                        onClick={() => handleSelectVinyl(product.product_id)}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-blue-50
                          ${product.product_id === vinylProductId ? 'bg-blue-100 text-blue-700' : ''}`}
                      >
                        {getVinylDisplayName(product)}
                      </button>
                    ))}
                  </div>
                ))}

                {/* Supplier products grouped by supplier */}
                {!isVinylMode && Object.entries(groupedSupplierProducts).map(([supplier, products]) => (
                  <div key={supplier}>
                    {/* Supplier header */}
                    <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                      {supplier}
                    </div>
                    {/* Products from supplier */}
                    {products.map((product) => (
                      <button
                        key={product.supplier_product_id}
                        type="button"
                        onClick={() => handleSelectSupplier(product.supplier_product_id)}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-blue-50
                          ${product.supplier_product_id === supplierProductId ? 'bg-blue-100 text-blue-700' : ''}`}
                      >
                        {getSupplierDisplayName(product)}
                      </button>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProductDropdown;
