/**
 * MaterialRequirementCard
 * Single material row card with supply-chain dropdown components.
 * Extracted from MaterialRequirementsConfirmationModal to stay under 500 lines.
 */

import React from 'react';
import { Trash2 } from 'lucide-react';
import { ProductTypeDropdown } from '../../supplyChain/components/ProductTypeDropdown';
import { ProductDropdown } from '../../supplyChain/components/ProductDropdown';
import { SupplierDropdown } from '../../supplyChain/components/SupplierDropdown';
import { CheckStockButton } from '../../supplyChain/components/CheckStockButton';
import { MaterialRequirement, ProductArchetype } from '../../../types/materialRequirements';
import { Supplier } from '../../../services/api/suppliersApi';
import type { MaterialRow, SupplierProduct } from './MaterialRequirementsConfirmationModal';

export interface MaterialRequirementCardProps {
  row: MaterialRow;
  index: number;
  archetypes: ProductArchetype[] | undefined;
  vinylProducts: any[] | undefined;
  suppliers: Supplier[] | undefined;
  supplierProducts: SupplierProduct[];
  onProductTypeChange: (localId: string, archetypeId: number | null) => void;
  onVinylProductChange: (localId: string, productId: number | null) => void;
  onSupplierProductChange: (localId: string, productId: number | null) => void;
  onFieldChange: (localId: string, field: string, value: any) => void;
  onRemove: (localId: string) => void;
  onCheckStock: (row: MaterialRow, stockType: 'vinyl' | 'general') => void;
}

/**
 * Build a minimal MaterialRequirement shape for CheckStockButton + useStockAvailability
 */
function rowToMaterialRequirement(row: MaterialRow): MaterialRequirement {
  return {
    requirement_id: row.requirement_id!,
    order_id: null,
    is_stock_item: false,
    archetype_id: row.archetype_id,
    custom_product_type: row.custom_product_type || null,
    supplier_product_id: row.supplier_product_id,
    vinyl_product_id: row.vinyl_product_id,
    held_vinyl_id: row.held_vinyl_id,
    held_supplier_product_id: row.held_supplier_product_id,
    size_description: row.size_description || null,
    quantity_ordered: row.quantity_ordered,
    quantity_received: 0,
    supplier_id: row.supplier_id,
    entry_date: '',
    ordered_date: null,
    expected_delivery_date: null,
    received_date: null,
    delivery_method: row.delivery_method,
    status: 'pending',
    notes: row.notes || null,
    cart_id: null,
    purchase_order_id: null,
    created_at: '',
    created_by: null,
    updated_at: null,
    updated_by: null,
  } as MaterialRequirement;
}

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-200 outline-none';

export const MaterialRequirementCard: React.FC<MaterialRequirementCardProps> = React.memo(({
  row,
  index,
  archetypes,
  vinylProducts,
  suppliers,
  supplierProducts,
  onProductTypeChange,
  onVinylProductChange,
  onSupplierProductChange,
  onFieldChange,
  onRemove,
  onCheckStock,
}) => {
  // Show CheckStockButton when: saved row + has archetype + no vendor + no holds
  const showCheckStock =
    row.requirement_id != null &&
    row.archetype_id != null &&
    row.supplier_id == null &&
    row.held_vinyl_id == null &&
    row.held_supplier_product_id == null;

  return (
    <div className="relative border border-gray-200 rounded-lg p-3 bg-white hover:border-purple-200 transition-colors">
      {/* Card number badge + delete */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
          #{index + 1}
        </span>
        <button
          onClick={() => onRemove(row._localId)}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Remove material"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Row 1: Product Type | Size | Qty */}
      <div className="grid grid-cols-[1fr_120px_70px] gap-2 mb-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Product Type</label>
          <ProductTypeDropdown
            value={row.archetype_id}
            onChange={(val) => onProductTypeChange(row._localId, val)}
            archetypes={archetypes}
            placeholder="Select type..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Size</label>
          <input
            type="text"
            value={row.size_description}
            onChange={(e) => onFieldChange(row._localId, 'size_description', e.target.value)}
            placeholder="e.g. 24x48"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Qty</label>
          <input
            type="number"
            min={0}
            value={row.quantity_ordered}
            onChange={(e) => onFieldChange(row._localId, 'quantity_ordered', parseInt(e.target.value) || 0)}
            className={`${inputClass} text-center`}
          />
        </div>
      </div>

      {/* Row 2: Product | Delivery */}
      <div className="grid grid-cols-[1fr_120px] gap-2 mb-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Product</label>
          {row.archetype_id ? (
            <ProductDropdown
              archetypeId={row.archetype_id}
              vinylProductId={row.vinyl_product_id}
              supplierProductId={row.supplier_product_id}
              onVinylProductChange={(val) => onVinylProductChange(row._localId, val)}
              onSupplierProductChange={(val) => onSupplierProductChange(row._localId, val)}
              supplierId={row.supplier_id}
              supplierProducts={supplierProducts}
              vinylProducts={vinylProducts}
              placeholder="Select product..."
            />
          ) : (
            <input
              type="text"
              value={row.custom_product_type}
              onChange={(e) => onFieldChange(row._localId, 'custom_product_type', e.target.value)}
              placeholder="Type product name..."
              className={inputClass}
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Delivery</label>
          <select
            value={row.delivery_method}
            onChange={(e) => onFieldChange(row._localId, 'delivery_method', e.target.value)}
            className={inputClass}
          >
            <option value="pickup">Pickup</option>
            <option value="shipping">Shipping</option>
          </select>
        </div>
      </div>

      {/* Row 3: Vendor + CheckStock | Notes */}
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Vendor</label>
          <div className="flex items-center gap-1">
            <div className="flex-1">
              <SupplierDropdown
                value={row.supplier_id}
                onChange={(val) => onFieldChange(row._localId, 'supplier_id', val)}
                suppliers={suppliers}
                placeholder="Select vendor..."
              />
            </div>
            {showCheckStock && (
              <CheckStockButton
                requirement={rowToMaterialRequirement(row)}
                onCheckStock={(stockType) => onCheckStock(row, stockType)}
              />
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">Notes</label>
          <input
            type="text"
            value={row.notes}
            onChange={(e) => onFieldChange(row._localId, 'notes', e.target.value)}
            placeholder="Optional notes..."
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
});

MaterialRequirementCard.displayName = 'MaterialRequirementCard';

export default MaterialRequirementCard;
