/**
 * RequirementCard Component
 *
 * Mobile-optimized card view for material requirements
 * Displays all 15 fields in a vertical, scannable layout
 * Maintains 100% feature parity with table view
 */

import React, { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { formatMonthDay } from '../../../utils/dateUtils';
import { InlineEditableCell } from './InlineEditableCell';
import { SupplierDropdown, SUPPLIER_IN_STOCK } from './SupplierDropdown';
import { OrderDropdown } from './OrderDropdown';
import { ProductTypeDropdown } from './ProductTypeDropdown';
import { ProductDropdown } from './ProductDropdown';
import { CheckStockButton } from './CheckStockButton';
import { HeldItemButton } from './HeldItemButton';
import type {
  MaterialRequirement,
  OrderDropdownOption,
  ComputedRequirementStatus,
} from '../../../types/materialRequirements';

interface SupplierProduct {
  supplier_product_id: number;
  product_name: string | null;
  sku: string | null;
  supplier_id: number;
  supplier_name?: string;
  archetype_id?: number;
}

const DELIVERY_OPTIONS = [
  { value: 'shipping', label: 'Ship' },
  { value: 'pickup', label: 'Pickup' },
];

const RECEIVING_STATUS_OPTIONS = [
  { value: 'received', label: 'Received' },
  { value: 'backordered', label: 'Backordered' },
  { value: 'partial_received', label: 'Partial' },
  { value: 'cancelled', label: 'Cancelled' },
];

export interface RequirementCardProps {
  requirement: MaterialRequirement;
  autoStatus: ComputedRequirementStatus;

  // Data for dropdowns
  availableOrders: OrderDropdownOption[];
  archetypes: any[];
  vinylProducts: any[];
  suppliers: any[];
  supplierProducts: SupplierProduct[];

  // Loading states
  loadingOrders: boolean;

  // Handlers
  onEdit: (id: number, field: string, value: any) => Promise<void>;
  onMultiFieldEdit: (id: number, updates: Record<string, any>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onCheckStock: (req: MaterialRequirement, stockType: 'vinyl' | 'general') => void;
  onEditHold: (req: MaterialRequirement) => void;
  onReleaseHold: (req: MaterialRequirement) => void;

  // Product-specific handlers
  onVinylProductSelect: (id: number, productId: number | null) => Promise<void>;
  onSupplierProductSelect: (id: number, productId: number | null) => Promise<void>;
  onCustomProductTypeChange: (id: number, text: string) => Promise<void>;

  // Utility functions
  getPOBorderColor: (poNumber: string) => string;
  getRowBgClass: (status: ComputedRequirementStatus) => string;
  getAutoStatusBadge: (status: ComputedRequirementStatus) => React.ReactNode;
  handleReceiveWithHold: (req: MaterialRequirement) => Promise<void>;
}

export const RequirementCard: React.FC<RequirementCardProps> = ({
  requirement: req,
  autoStatus,
  availableOrders,
  archetypes,
  vinylProducts,
  suppliers,
  supplierProducts,
  loadingOrders,
  onEdit,
  onMultiFieldEdit,
  onDelete,
  onCheckStock,
  onEditHold,
  onReleaseHold,
  onVinylProductSelect,
  onSupplierProductSelect,
  onCustomProductTypeChange,
  getPOBorderColor,
  getRowBgClass,
  getAutoStatusBadge,
  handleReceiveWithHold,
}) => {
  const [notesExpanded, setNotesExpanded] = useState(!!req.notes);
  const [isExpanded, setIsExpanded] = useState(false);

  // Get background color (convert table bg class to inline style)
  const getBgColor = (status: ComputedRequirementStatus): string => {
    switch (status) {
      case 'ordered_pickup': return '#93C5FD'; // bg-blue-400
      case 'ordered_shipping': return '#FDE047'; // bg-yellow-400
      case 'to_be_picked': return '#C084FC'; // bg-purple-400
      case 'fulfilled': return '#86EFAC'; // bg-green-400
      case 'cancelled': return '#FCA5A5'; // bg-red-400
      default: return 'transparent';
    }
  };

  // Get order display text
  const getOrderDisplay = () => {
    if (req.is_stock_item) return 'Stock';
    if (!req.order_id) return 'No Order';
    const order = availableOrders.find(o => o.order_id === req.order_id);
    if (!order) return `Order #${req.order_id}`;
    return `#${order.order_number} - ${order.customer_name}`;
  };

  // Get product type display text
  const getProductTypeDisplay = () => {
    if (!req.archetype_id) return req.custom_product_type || 'No Type';
    const arch = archetypes.find(a => a.archetype_id === req.archetype_id);
    return arch?.archetype_name || 'Unknown Type';
  };

  // Get product display text
  const getProductDisplay = () => {
    if (req.vinyl_product_id) {
      const vinyl = vinylProducts.find(v => v.vinyl_product_id === req.vinyl_product_id);
      return vinyl ? `${vinyl.product_name}${vinyl.color_name ? ` - ${vinyl.color_name}` : ''}` : 'Unknown Vinyl';
    }
    if (req.supplier_product_id) {
      const product = supplierProducts.find(p => p.supplier_product_id === req.supplier_product_id);
      return product?.product_name || 'Unknown Product';
    }
    if (req.custom_product_type) {
      return req.custom_product_type;
    }
    return 'No Product';
  };

  // Get vendor display text
  const getVendorDisplay = () => {
    if (req.held_vinyl_id || req.held_supplier_product_id) {
      return 'Held Item';
    }
    if (!req.supplier_id) return 'No Vendor';
    if (req.supplier_id === SUPPLIER_IN_STOCK) return 'In Stock';
    const supplier = suppliers.find(s => s.supplier_id === req.supplier_id);
    return supplier?.supplier_name || 'Unknown Vendor';
  };

  return (
    <div
      className={`rounded-lg border ${PAGE_STYLES.panel.border} ${getRowBgClass(autoStatus)} shadow-sm overflow-hidden`}
      style={{
        borderLeft: req.supplier_order_number ? `3px solid ${getPOBorderColor(req.supplier_order_number)}` : undefined,
        backgroundColor: getBgColor(autoStatus),
      }}
    >
      {/* Header: Status + Delete */}
      <div className={`flex items-center justify-between px-3 py-2 ${PAGE_STYLES.header.background} border-b ${PAGE_STYLES.panel.border}`}>
        <div className="flex-shrink-0">
          {getAutoStatusBadge(autoStatus)}
        </div>
        {req.status !== 'received' && (
          <button
            onClick={() => onDelete(req.requirement_id)}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
            title="Delete requirement"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Collapsed View - Compact Read-Only Summary */}
      {!isExpanded && (
        <div className="px-3 py-3 space-y-2">
          {/* Line 1: Order + Product/Type Priority */}
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-bold ${PAGE_STYLES.panel.text} truncate`}>
              {getOrderDisplay()}
            </div>
            <div className={`text-xs ${PAGE_STYLES.panel.textSecondary} truncate`}>
              {/* Show Product first, then Type, then fallback */}
              {(req.vinyl_product_id || req.supplier_product_id) ? (
                getProductDisplay()
              ) : req.archetype_id || req.custom_product_type ? (
                getProductTypeDisplay()
              ) : (
                'No product selection'
              )}
            </div>
          </div>

          {/* Line 3: Quantity + Unit + Vendor + Expand Button */}
          <div className="flex items-center gap-3 text-xs">
            <span className={`font-medium ${PAGE_STYLES.panel.text}`}>
              {req.quantity_ordered} {req.unit}
            </span>
            <span className={`${PAGE_STYLES.panel.textMuted}`}>•</span>
            <span className={`${PAGE_STYLES.panel.textSecondary} truncate flex-1 min-w-0`}>
              {getVendorDisplay()}
            </span>
            <button
              onClick={() => setIsExpanded(true)}
              className={`flex-shrink-0 px-2 py-1 flex items-center gap-1 rounded border ${PAGE_STYLES.input.border} ${PAGE_STYLES.panel.background} hover:bg-gray-100 transition-colors`}
            >
              <ChevronDown className="w-3 h-3" />
              <span className={`text-[10px] ${PAGE_STYLES.panel.textMuted}`}>Edit</span>
            </button>
          </div>

          {/* Line 4: Status Badges (conditional - only if relevant data exists) */}
          {(req.delivery_method || req.ordered_date || (req.status !== 'pending' && req.status !== 'ordered')) && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {req.delivery_method && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  req.delivery_method === 'pickup'
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                }`}>
                  {req.delivery_method === 'pickup' ? 'Pickup' : 'Ship'}
                </span>
              )}
              {req.ordered_date && (
                <span className={PAGE_STYLES.panel.textMuted}>
                  Ordered: {formatMonthDay(req.ordered_date)}
                </span>
              )}
              {req.status !== 'pending' && req.status !== 'ordered' && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  req.status === 'received' ? 'bg-green-100 text-green-700 border border-green-300' :
                  req.status === 'backordered' ? 'bg-orange-100 text-orange-700 border border-orange-300' :
                  req.status === 'partial_received' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                  req.status === 'cancelled' ? 'bg-red-100 text-red-700 border border-red-300' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {req.status === 'partial_received' ? 'Partial' :
                   req.status === 'backordered' ? 'Backordered' :
                   req.status === 'received' ? 'Received' :
                   req.status === 'cancelled' ? 'Cancelled' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expanded View - Full Edit Mode */}
      {isExpanded && (
        <>
          {/* Primary Info */}
      <div className="px-3 py-3 space-y-1.5">
        <div className={`text-base font-bold ${PAGE_STYLES.panel.text}`}>
          {getOrderDisplay()}
        </div>
        <div className={`text-sm font-medium ${PAGE_STYLES.panel.textSecondary}`}>
          {getProductTypeDisplay()}
        </div>
        <div className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
          {req.quantity_ordered} {req.unit} - {getVendorDisplay()}
        </div>
      </div>

      {/* Detail Grid */}
      <div className={`px-3 pb-3 space-y-2 text-xs ${PAGE_STYLES.panel.background}`}>
        {/* Date & Order Ref */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
              Date
            </label>
            <InlineEditableCell
              value={req.entry_date}
              onChange={(val) => onEdit(req.requirement_id, 'entry_date', val)}
              type="date"
            />
          </div>
          <div>
            <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
              Order Ref
            </label>
            <OrderDropdown
              value={req.order_id}
              onChange={(orderId) => {
                onMultiFieldEdit(req.requirement_id, {
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
                onMultiFieldEdit(req.requirement_id, {
                  is_stock_item: true,
                  order_id: null
                });
              }}
            />
          </div>
        </div>

        {/* Product Type */}
        <div>
          <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
            Product Type
          </label>
          <ProductTypeDropdown
            value={req.archetype_id}
            onChange={(val) => {
              const arch = archetypes.find(a => a.archetype_id === val);
              onMultiFieldEdit(req.requirement_id, {
                archetype_id: val,
                vinyl_product_id: null,
                supplier_product_id: null,
                supplier_id: null,
                custom_product_type: null,
                unit: arch?.unit_of_measure || 'each',
              });
            }}
            archetypes={archetypes}
            placeholder="Type..."
          />
        </div>

        {/* Product */}
        <div>
          <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
            Product
          </label>
          {req.archetype_id !== null ? (
            <ProductDropdown
              archetypeId={req.archetype_id}
              vinylProductId={req.vinyl_product_id}
              supplierProductId={req.supplier_product_id}
              supplierId={req.supplier_id}
              supplierProducts={supplierProducts}
              vinylProducts={vinylProducts}
              onVinylProductChange={(val) => onVinylProductSelect(req.requirement_id, val)}
              onSupplierProductChange={(val) => onSupplierProductSelect(req.requirement_id, val)}
              customProductType={req.custom_product_type}
              onCustomProductTypeChange={(text) => onCustomProductTypeChange(req.requirement_id, text)}
              placeholder="Product..."
            />
          ) : (
            <InlineEditableCell
              value={req.custom_product_type || ''}
              onChange={(val) => onEdit(req.requirement_id, 'custom_product_type', val)}
              type="text"
              placeholder="Custom..."
            />
          )}
        </div>

        {/* Unit & Qty */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
              Unit
            </label>
            <InlineEditableCell
              value={req.unit || ''}
              onChange={(val) => onEdit(req.requirement_id, 'unit', val)}
              type="text"
              placeholder="Unit"
            />
          </div>
          <div>
            <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
              Quantity
            </label>
            <InlineEditableCell
              value={req.quantity_ordered}
              onChange={(val) => onEdit(req.requirement_id, 'quantity_ordered', Number(val))}
              type="number"
              min={0}
              step={1}
            />
          </div>
        </div>

        {/* Vendor */}
        <div>
          <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
            Vendor
          </label>
          <div className="flex flex-col gap-1">
            {(req.held_vinyl_id || req.held_supplier_product_id) ? (
              <HeldItemButton
                requirement={req}
                onEditHold={() => onEditHold(req)}
                onReleaseHold={() => onReleaseHold(req)}
              />
            ) : (
              <SupplierDropdown
                value={req.supplier_id}
                onChange={(val) => onEdit(req.requirement_id, 'supplier_id', val)}
                suppliers={suppliers}
                placeholder="Vendor..."
              />
            )}
            {!req.supplier_id && !req.held_vinyl_id && !req.held_supplier_product_id && (
              <CheckStockButton
                requirement={req}
                onCheckStock={(stockType) => onCheckStock(req, stockType)}
              />
            )}
          </div>
        </div>

        {/* Delivery & Ordered Date */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
              Delivery
            </label>
            <InlineEditableCell
              value={req.delivery_method || ''}
              onChange={(val) => onEdit(req.requirement_id, 'delivery_method', val || null)}
              type="select"
              options={DELIVERY_OPTIONS}
              placeholder="Delivery..."
              className={
                req.delivery_method === 'pickup' ? '!bg-blue-100 !text-blue-700 !border-blue-300 font-medium' :
                req.delivery_method === 'shipping' ? '!bg-yellow-100 !text-yellow-700 !border-yellow-300 font-medium' :
                'text-gray-300'
              }
            />
          </div>
          <div>
            <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
              Ordered
            </label>
            <InlineEditableCell
              value={req.ordered_date || ''}
              onChange={(val) => onEdit(req.requirement_id, 'ordered_date', val || null)}
              type="date"
              placeholder="-"
              defaultToToday
            />
          </div>
        </div>

        {/* PO# & Receiving Status */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
              PO#
            </label>
            <div className={`px-1.5 py-1.5 text-xs border rounded ${PAGE_STYLES.input.border} ${PAGE_STYLES.panel.background}`}>
              {req.supplier_order_number ? (
                <span className="font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                  {req.supplier_order_number}
                </span>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </div>
          </div>
          <div>
            <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
              Receiving
            </label>
            <InlineEditableCell
              value={req.status === 'pending' || req.status === 'ordered' ? '' : req.status}
              onChange={(val) => {
                if (val === 'received' && req.held_vinyl_id) {
                  handleReceiveWithHold(req);
                } else if ((val === 'received' || val === 'cancelled') && !req.received_date && (req.status === 'pending' || req.status === 'ordered')) {
                  const today = new Date().toISOString().split('T')[0];
                  onMultiFieldEdit(req.requirement_id, { status: val, received_date: today });
                } else {
                  onEdit(req.requirement_id, 'status', val || 'pending');
                }
              }}
              type="select"
              options={RECEIVING_STATUS_OPTIONS}
              className={
                req.status === 'pending' || req.status === 'ordered' ? 'text-gray-300 [&>option]:text-black' : ''
              }
            />
          </div>
        </div>

        {/* Received Date */}
        <div>
          <label className={`block text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide`}>
            Received Date
          </label>
          <InlineEditableCell
            value={req.received_date || ''}
            onChange={(val) => onEdit(req.requirement_id, 'received_date', val || null)}
            type="date"
            placeholder="-"
            defaultToToday
          />
        </div>

        {/* Notes - Collapsible */}
        <div>
          <button
            onClick={() => setNotesExpanded(!notesExpanded)}
            className={`flex items-center justify-between w-full text-[10px] font-medium ${PAGE_STYLES.panel.textMuted} mb-1 uppercase tracking-wide hover:${PAGE_STYLES.panel.text} transition-colors`}
          >
            <span>Notes</span>
            {notesExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {notesExpanded && (
            <InlineEditableCell
              value={req.notes || ''}
              onChange={(val) => onEdit(req.requirement_id, 'notes', val)}
              type="textarea"
              placeholder="Add notes..."
            />
          )}
        </div>
      </div>

          {/* Collapse Button */}
          <div className="px-3 pb-3">
            <button
              onClick={() => setIsExpanded(false)}
              className={`w-full py-2 flex items-center justify-center gap-2 rounded border ${PAGE_STYLES.input.border} ${PAGE_STYLES.panel.background} hover:bg-gray-100 transition-colors`}
            >
              <ChevronUp className="w-4 h-4" />
              <span className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>Collapse</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RequirementCard;
