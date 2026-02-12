/**
 * RequirementTableRow Component
 *
 * Table row component for material requirements - desktop/tablet view
 * Extracted from AllOrdersMaterialRequirements to reduce file size
 * and enable responsive card/table switching
 */

import React from 'react';
import { Trash2 } from 'lucide-react';
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

export interface RequirementTableRowProps {
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

export const RequirementTableRow: React.FC<RequirementTableRowProps> = ({
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
  return (
    <tr
      className={`group hover:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.07)] border-b border-gray-100 ${getRowBgClass(autoStatus)}`}
      style={req.supplier_order_number ? {
        borderLeft: `3px solid ${getPOBorderColor(req.supplier_order_number)}`,
        borderRight: `3px solid ${getPOBorderColor(req.supplier_order_number)}`,
      } : undefined}
    >
      {/* Date */}
      <td className="px-1 py-0.5">
        <InlineEditableCell
          value={req.entry_date}
          onChange={(val) => onEdit(req.requirement_id, 'entry_date', val)}
          type="date"
        />
      </td>

      {/* Order Ref */}
      <td className="px-1 py-0.5">
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
      </td>

      {/* Product Type */}
      <td className="px-1 py-0.5">
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
      </td>

      {/* Unit */}
      <td className="px-1 py-0.5">
        <InlineEditableCell
          value={req.unit || ''}
          onChange={(val) => onEdit(req.requirement_id, 'unit', val)}
          type="text"
          placeholder="Unit"
        />
      </td>

      {/* Qty */}
      <td className="px-1 py-0.5 text-right font-medium">
        <InlineEditableCell
          value={req.quantity_ordered}
          onChange={(val) => onEdit(req.requirement_id, 'quantity_ordered', Number(val))}
          type="number"
          min={0}
          step={1}
          className="text-right"
        />
      </td>

      {/* Vendor */}
      <td className="px-1 py-0.5">
        <div className="flex flex-col gap-0.5">
          {/* Show HeldItemButton if item has a hold, otherwise show SupplierDropdown */}
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
          {/* Show CheckStockButton below when no vendor selected and no hold */}
          {!req.supplier_id && !req.held_vinyl_id && !req.held_supplier_product_id && (
            <CheckStockButton
              requirement={req}
              onCheckStock={(stockType) => onCheckStock(req, stockType)}
            />
          )}
        </div>
      </td>

      {/* Delivery */}
      <td className="px-1 py-0.5">
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
      </td>

      {/* Ordered Date */}
      <td className="px-1 py-0.5">
        <InlineEditableCell
          value={req.ordered_date || ''}
          onChange={(val) => onEdit(req.requirement_id, 'ordered_date', val || null)}
          type="date"
          placeholder="-"
          defaultToToday
        />
      </td>

      {/* PO# */}
      <td className="px-1 py-0.5">
        {req.supplier_order_number ? (
          <span className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
            {req.supplier_order_number}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Receiving Status */}
      <td className="px-1 py-0.5">
        <InlineEditableCell
          value={req.status === 'pending' || req.status === 'ordered' ? '' : req.status}
          onChange={(val) => {
            // If setting to received and has a vinyl hold, use special handler
            if (val === 'received' && req.held_vinyl_id) {
              handleReceiveWithHold(req);
            } else if ((val === 'received' || val === 'cancelled') && !req.received_date && (req.status === 'pending' || req.status === 'ordered')) {
              // Auto-fill received date with today when marking as received or cancelled
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
      </td>

      {/* Received Date */}
      <td className="px-1 py-0.5">
        <InlineEditableCell
          value={req.received_date || ''}
          onChange={(val) => onEdit(req.requirement_id, 'received_date', val || null)}
          type="date"
          placeholder="-"
          defaultToToday
        />
      </td>

      {/* Notes */}
      <td className="px-1 py-0.5">
        <InlineEditableCell
          value={req.notes || ''}
          onChange={(val) => onEdit(req.requirement_id, 'notes', val)}
          type="textarea"
          placeholder="Notes"
        />
      </td>

      {/* Auto Status Badge */}
      <td className="px-1 py-0.5">
        {getAutoStatusBadge(autoStatus)}
      </td>

      {/* Actions - Only visible on hover */}
      <td className="pr-1 py-0.5">
        <div className="flex items-center justify-center">
          {req.status !== 'received' && (
            <button
              onClick={() => onDelete(req.requirement_id)}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default RequirementTableRow;
