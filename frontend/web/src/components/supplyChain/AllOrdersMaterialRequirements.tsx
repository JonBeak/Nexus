/**
 * All Orders Material Requirements
 * Inline-editable table tracking all material requirements across orders and stock
 * Created: 2025-01-27
 * Updated: 2026-02-02 - Redesign with Product Type, cascading Product, Ordered date,
 *          Receiving Status dropdown, and computed Auto Status badge
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Package,
  Truck,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  Trash2,
  ShoppingCart,
  HandMetal,
} from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { materialRequirementsApi, ordersApi, supplierProductsApi, archetypesApi, vinylProductsApi, suppliersApi } from '../../services/api';
import { InlineEditableCell } from './components/InlineEditableCell';
import { SupplierDropdown, SUPPLIER_IN_STOCK } from './components/SupplierDropdown';
import { OrderDropdown } from './components/OrderDropdown';
import { ProductTypeDropdown } from './components/ProductTypeDropdown';
import { ProductDropdown } from './components/ProductDropdown';
import { getTodayString } from '../../utils/dateUtils';
import type {
  MaterialRequirement,
  MaterialRequirementStatus,
  MaterialRequirementFilters,
  CreateMaterialRequirementRequest,
  OrderDropdownOption,
  ComputedRequirementStatus,
} from '../../types/materialRequirements';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';

interface SupplierProduct {
  supplier_product_id: number;
  product_name: string | null;
  sku: string | null;
  supplier_id: number;
  supplier_name?: string;
}

interface AllOrdersMaterialRequirementsProps {
  user?: AccountUser;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}


const STATUS_OPTIONS: { value: MaterialRequirementStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'backordered', label: 'Backordered' },
  { value: 'partial_received', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DELIVERY_OPTIONS = [
  { value: 'shipping', label: 'Ship' },
  { value: 'pickup', label: 'Pickup' },
];

// Receiving Status dropdown options (replaces old status editing)
// When "Select..." (empty) is chosen, it maps to 'pending' status
const RECEIVING_STATUS_OPTIONS = [
  { value: 'received', label: 'Received' },
  { value: 'backordered', label: 'Backordered' },
  { value: 'partial_received', label: 'Partial' },
  { value: 'cancelled', label: 'Cancelled' },
];


/**
 * Compute auto status based on ORDERED (ordered_date) x RECEIVING (status)
 *
 * | Ordered Date | Receiving     | Auto Status           |
 * |--------------|---------------|-----------------------|
 * | No           | Select...     | Pending               |
 * | Yes          | Select...     | Ordered (Pickup/Ship) |
 * | Yes          | Backordered   | Backordered           |
 * | Yes          | Partial       | Partial               |
 * | Any          | Received      | Fulfilled             |
 * | Any          | Cancelled     | Cancelled             |
 * | In Stock     | Select...     | To Pick               |
 */
const computeAutoStatus = (req: MaterialRequirement): ComputedRequirementStatus => {
  // Fulfilled: received
  if (req.status === 'received') {
    return 'fulfilled';
  }

  // Cancelled
  if (req.status === 'cancelled') {
    return 'pending'; // Or could add 'cancelled' to ComputedRequirementStatus
  }

  // Backordered
  if (req.status === 'backordered') {
    return 'pending'; // Could add 'backordered' badge if needed
  }

  // Partial received
  if (req.status === 'partial_received') {
    return 'pending'; // Could add 'partial' badge if needed
  }

  // Not received yet (pending/ordered status) - check ordered_date and supplier
  // In Stock items → To Pick
  if (req.supplier_id === SUPPLIER_IN_STOCK) {
    return 'to_be_picked';
  }

  // Has ordered_date → Ordered for pickup/shipping
  if (req.ordered_date) {
    return req.delivery_method === 'pickup' ? 'ordered_pickup' : 'ordered_shipping';
  }

  // Default: pending (not ordered yet)
  return 'pending';
};

/**
 * Get badge for computed auto status
 */
const getAutoStatusBadge = (status: ComputedRequirementStatus) => {
  switch (status) {
    case 'pending':
      return (
        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1 whitespace-nowrap">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    case 'ordered_pickup':
      return (
        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1 whitespace-nowrap">
          <ShoppingCart className="w-3 h-3" />
          Pickup
        </span>
      );
    case 'ordered_shipping':
      return (
        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-100 text-indigo-800 flex items-center gap-1 whitespace-nowrap">
          <Truck className="w-3 h-3" />
          Shipping
        </span>
      );
    case 'to_be_picked':
      return (
        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 text-purple-800 flex items-center gap-1 whitespace-nowrap">
          <HandMetal className="w-3 h-3" />
          To Pick
        </span>
      );
    case 'fulfilled':
      return (
        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1 whitespace-nowrap">
          <CheckCircle className="w-3 h-3" />
          Fulfilled
        </span>
      );
    default:
      return null;
  }
};


export const AllOrdersMaterialRequirements: React.FC<AllOrdersMaterialRequirementsProps> = ({
  user,
  showNotification,
}) => {
  void user;
  const [requirements, setRequirements] = useState<MaterialRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MaterialRequirementFilters>({
    status: 'all',
    isStockItem: 'all',
    supplierId: null,
    search: '',
    dateRange: { from: null, to: null },
  });
  const [showFilters, setShowFilters] = useState(false);


  // Orders for dropdown
  const [availableOrders, setAvailableOrders] = useState<OrderDropdownOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Supplier products for vendor filtering
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);

  // Load all dropdown data ONCE in parent (prevents API spam)
  // Initialize as undefined so dropdowns know data hasn't loaded yet
  const [archetypes, setArchetypes] = useState<any[] | undefined>(undefined);
  const [vinylProducts, setVinylProducts] = useState<any[] | undefined>(undefined);
  const [suppliers, setSuppliers] = useState<any[] | undefined>(undefined);

  const loadRequirements = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (filters.status !== 'all') {
        params.status = filters.status;
      }
      if (filters.isStockItem !== 'all') {
        params.is_stock_item = filters.isStockItem;
      }
      if (filters.supplierId) {
        params.supplier_id = filters.supplierId;
      }
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.dateRange.from) {
        params.entry_date_from = filters.dateRange.from;
      }
      if (filters.dateRange.to) {
        params.entry_date_to = filters.dateRange.to;
      }

      const data = await materialRequirementsApi.getRequirements(params);
      setRequirements(data);
    } catch (error) {
      console.error('Error loading requirements:', error);
      showNotification('Failed to load material requirements', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, showNotification]);

  useEffect(() => {
    void loadRequirements();
  }, [loadRequirements]);

  // Load all orders for dropdown
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoadingOrders(true);
        const orders = await ordersApi.getOrders({}); // Load all orders
        setAvailableOrders(orders.map((o: any) => ({
          order_id: o.order_id,
          order_number: String(o.order_number),
          order_name: o.order_name || '',
          customer_name: o.customer_name || ''
        })));
      } catch (error) {
        console.error('Failed to load orders:', error);
      } finally {
        setLoadingOrders(false);
      }
    };
    void loadOrders();
  }, []);

  // Load supplier products for vendor filtering
  useEffect(() => {
    const loadSupplierProducts = async () => {
      try {
        const products = await supplierProductsApi.getSupplierProducts({ active_only: true });
        setSupplierProducts(products);
      } catch (error) {
        console.error('Failed to load supplier products:', error);
      }
    };
    void loadSupplierProducts();
  }, []);

  // Load archetypes ONCE for all ProductTypeDropdowns
  useEffect(() => {
    const loadArchetypes = async () => {
      try {
        const data = await archetypesApi.getArchetypes({ active_only: true });
        setArchetypes(data);
      } catch (error) {
        console.error('Failed to load archetypes:', error);
      }
    };
    void loadArchetypes();
  }, []);

  // Load vinyl products ONCE for all ProductDropdowns
  useEffect(() => {
    const loadVinylProducts = async () => {
      try {
        const data = await vinylProductsApi.getVinylProducts({ active_only: true });
        setVinylProducts(data);
      } catch (error) {
        console.error('Failed to load vinyl products:', error);
      }
    };
    void loadVinylProducts();
  }, []);

  // Load suppliers ONCE for all SupplierDropdowns
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await suppliersApi.getSuppliers({ active_only: true });
        setSuppliers(data);
      } catch (error) {
        console.error('Failed to load suppliers:', error);
      }
    };
    void loadSuppliers();
  }, []);



  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return;

    try {
      await materialRequirementsApi.deleteRequirement(id);
      showNotification('Requirement deleted', 'success');
      void loadRequirements();
    } catch (error) {
      console.error('Error deleting requirement:', error);
      showNotification('Failed to delete requirement', 'error');
    }
  };

  const handleInlineEdit = async (id: number, field: string, value: any) => {
    console.log('handleInlineEdit called:', { id, field, value });
    try {
      await materialRequirementsApi.updateRequirement(id, { [field]: value });
      console.log('API call succeeded, updating local state');
      // Update local state without full reload for smoother UX
      setRequirements(prev => prev.map(req =>
        req.requirement_id === id ? { ...req, [field]: value } : req
      ));
    } catch (error) {
      console.error('Error updating requirement:', error);
      showNotification('Failed to update', 'error');
      void loadRequirements();
    }
  };

  // Handle multiple field updates at once (for cascading dropdowns)
  const handleMultiFieldEdit = async (id: number, updates: Record<string, any>) => {
    try {
      await materialRequirementsApi.updateRequirement(id, updates);
      setRequirements(prev => prev.map(req =>
        req.requirement_id === id ? { ...req, ...updates } : req
      ));
    } catch (error) {
      console.error('Error updating requirement:', error);
      showNotification('Failed to update', 'error');
      void loadRequirements();
    }
  };

  /**
   * Vinyl product selection - no auto-assignment, no clearing
   * Just update vinyl product field independently
   */
  const handleVinylProductSelect = async (requirementId: number, productId: number | null) => {
    // Just update vinyl product - don't auto-assign vendor, don't clear supplier product
    await handleInlineEdit(requirementId, 'vinyl_product_id', productId);
  };

  /**
   * Supplier product selection with auto-vendor assignment
   * Keeps auto-assignment for convenience, but doesn't clear vinyl product
   */
  const handleSupplierProductSelect = async (requirementId: number, productId: number | null) => {
    if (productId === null) {
      // Just clear supplier product - don't auto-clear vendor
      await handleInlineEdit(requirementId, 'supplier_product_id', null);
      return;
    }

    const selectedProduct = supplierProducts.find(p => p.supplier_product_id === productId);
    const autoSupplierId = selectedProduct?.supplier_id ?? null;

    // Update supplier product AND auto-assign vendor (but don't clear vinyl product)
    await handleMultiFieldEdit(requirementId, {
      supplier_product_id: productId,
      supplier_id: autoSupplierId,  // ✓ Keep auto-assignment for convenience
    });
  };

  // Add new requirement handler
  const handleAddNewRequirement = async () => {
    try {
      const createData: CreateMaterialRequirementRequest = {
        is_stock_item: true,  // Default to Stock
        order_id: null,
        archetype_id: null,
        vinyl_product_id: null,
        supplier_product_id: null,
        custom_product_type: undefined,
        size_description: undefined,
        quantity_ordered: 0,  // Start with 0 to bypass validation until product type is selected
        supplier_id: null,
        delivery_method: 'shipping',
        notes: undefined,
        entry_date: getTodayString(),
      };

      const newRequirement = await materialRequirementsApi.createRequirement(createData);
      showNotification('Requirement added', 'success');
      // Add new row to local state instead of full reload
      setRequirements(prev => [...prev, newRequirement]);
    } catch (error) {
      console.error('Error creating requirement:', error);
      showNotification('Failed to add requirement', 'error');
    }
  };


  const thClass = `px-1 py-1 text-left text-[10px] font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`;

  if (loading && requirements.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        <p className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>Loading requirements...</p>
      </div>
    );
  }

  return (
    <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b flex items-center justify-between ${PAGE_STYLES.header.background}`}>
        <div>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>All Material Requirements</h3>
          <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            {requirements.length} requirements
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`pl-9 pr-3 py-1.5 text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md focus:ring-purple-500 focus:border-purple-500 w-48`}
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border} flex items-center gap-1`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Refresh */}
          <button
            onClick={() => void loadRequirements()}
            className={`p-1.5 rounded-md ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border}`}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Add Button */}
          <button
            onClick={handleAddNewRequirement}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={`px-4 py-3 ${PAGE_STYLES.header.background} border-b ${PAGE_STYLES.panel.border} flex flex-wrap gap-4`}>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className={`text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md px-2 py-1`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Type</label>
            <select
              value={filters.isStockItem === 'all' ? 'all' : filters.isStockItem ? 'stock' : 'order'}
              onChange={(e) => setFilters({
                ...filters,
                isStockItem: e.target.value === 'all' ? 'all' : e.target.value === 'stock'
              })}
              className={`text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md px-2 py-1`}
            >
              <option value="all">All Types</option>
              <option value="order">Orders Only</option>
              <option value="stock">Stock Only</option>
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>From Date</label>
            <input
              type="date"
              value={filters.dateRange.from || ''}
              onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, from: e.target.value || null } })}
              className={`text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md px-2 py-1`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>To Date</label>
            <input
              type="date"
              value={filters.dateRange.to || ''}
              onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, to: e.target.value || null } })}
              className={`text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md px-2 py-1`}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
            <tr>
              <th className={thClass} style={{ width: '95px' }}>Date</th>
              <th className={thClass} style={{ width: '120px' }}>Order Ref</th>
              <th className={thClass} style={{ width: '130px' }}>Product Type</th>
              <th className={thClass} style={{ width: '160px' }}>Product</th>
              <th className={thClass} style={{ width: '90px' }}>Size</th>
              <th className={`${thClass} text-right`} style={{ width: '65px' }}>Qty</th>
              <th className={thClass} style={{ width: '130px' }}>Vendor</th>
              <th className={thClass} style={{ width: '70px' }}>Delivery</th>
              <th className={thClass} style={{ width: '95px' }}>Ordered</th>
              <th className={thClass} style={{ width: '100px' }}>Receiving</th>
              <th className={thClass} style={{ width: '180px' }}>Notes</th>
              <th className={`${thClass} text-center`} style={{ width: '60px' }}>Actions</th>
              <th className={thClass} style={{ width: '80px' }}>Status</th>
            </tr>
          </thead>
          <tbody className={PAGE_STYLES.panel.divider}>
            {/* All Rows */}
            {requirements.map((req) => {
              const autoStatus = computeAutoStatus(req);
              return (
                <tr key={req.requirement_id} className="hover:bg-[var(--theme-hover-bg)] border-b border-gray-100">
                  {/* Date */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.entry_date}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'entry_date', val)}
                      type="date"
                    />
                  </td>

                  {/* Order Ref */}
                  <td className="px-1 py-0.5">
                    <OrderDropdown
                      value={req.order_id}
                      onChange={(orderId) => {
                        handleMultiFieldEdit(req.requirement_id, {
                          is_stock_item: false,
                          order_id: orderId
                        });
                      }}
                      orders={availableOrders}
                      loading={loadingOrders}
                      placeholder="Select..."
                      showClear={false}
                      includeStockOption={true}
                      isStockSelected={req.is_stock_item}
                      onStockSelect={() => {
                        handleMultiFieldEdit(req.requirement_id, {
                          is_stock_item: true,
                          order_id: null
                        });
                      }}
                    />
                  </td>

                  {/* Product Type */}
                  <td className="px-1 py-0.5">
                    <ProductTypeDropdown
                      value={req.archetype_id}
                      onChange={(val) => handleMultiFieldEdit(req.requirement_id, {
                        archetype_id: val,
                        vinyl_product_id: null,
                        supplier_product_id: null,
                        supplier_id: null,
                      })}
                      archetypes={archetypes}
                      placeholder="Type..."
                    />
                  </td>

                  {/* Product */}
                  <td className="px-1 py-0.5">
                    {req.archetype_id !== null ? (
                      <ProductDropdown
                        archetypeId={req.archetype_id}
                        vinylProductId={req.vinyl_product_id}
                        supplierProductId={req.supplier_product_id}
                        supplierId={req.supplier_id}
                        supplierProducts={supplierProducts}
                        vinylProducts={vinylProducts}
                        onVinylProductChange={(val) => handleVinylProductSelect(req.requirement_id, val)}
                        onSupplierProductChange={(val) => handleSupplierProductSelect(req.requirement_id, val)}
                        placeholder="Product..."
                      />
                    ) : (
                      <InlineEditableCell
                        value={req.custom_product_type || ''}
                        onChange={(val) => handleInlineEdit(req.requirement_id, 'custom_product_type', val)}
                        type="text"
                        placeholder="Custom..."
                      />
                    )}
                  </td>

                  {/* Size */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.size_description || ''}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'size_description', val)}
                      type="text"
                      placeholder="Size"
                    />
                  </td>

                  {/* Qty */}
                  <td className="px-1 py-0.5 text-right font-medium">
                    <InlineEditableCell
                      value={req.quantity_ordered}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'quantity_ordered', Number(val))}
                      type="number"
                      min={0}
                      step={1}
                      className="text-right"
                    />
                  </td>

                  {/* Vendor */}
                  <td className="px-1 py-0.5">
                    <SupplierDropdown
                      value={req.supplier_id}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'supplier_id', val)}
                      suppliers={suppliers}
                      placeholder="Vendor..."
                    />
                  </td>

                  {/* Delivery */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.delivery_method}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'delivery_method', val)}
                      type="select"
                      options={DELIVERY_OPTIONS}
                    />
                  </td>

                  {/* Ordered Date */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.ordered_date || ''}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'ordered_date', val || null)}
                      type="date"
                      placeholder="-"
                    />
                  </td>

                  {/* Receiving Status */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.status === 'pending' || req.status === 'ordered' ? '' : req.status}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'status', val || 'pending')}
                      type="select"
                      options={RECEIVING_STATUS_OPTIONS}
                    />
                  </td>

                  {/* Notes */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.notes || ''}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'notes', val)}
                      type="textarea"
                      placeholder="Notes"
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-1 py-0.5">
                    <div className="flex items-center justify-center">
                      {req.status !== 'received' && (
                        <button
                          onClick={() => handleDelete(req.requirement_id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Auto Status Badge */}
                  <td className="px-1 py-0.5">
                    {getAutoStatusBadge(autoStatus)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {requirements.length === 0 && !loading && (
        <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">No material requirements found</p>
          <p className="text-sm">Click "Add" to create one</p>
        </div>
      )}
    </div>
  );
};

export default AllOrdersMaterialRequirements;
