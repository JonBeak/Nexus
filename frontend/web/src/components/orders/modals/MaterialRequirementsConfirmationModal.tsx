/**
 * Material Requirements Confirmation Modal
 * Blocking step between file approval and production queue.
 * User reviews/edits material requirements before confirming move to production.
 * Uses supply-chain dropdown components for product type, product, and vendor selection.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Plus, Loader2, AlertCircle, Package, CheckCircle, FileText } from 'lucide-react';
import { materialRequirementsApi, archetypesApi, vinylProductsApi, suppliersApi, supplierProductsApi } from '../../../services/api';
import {
  MaterialRequirement,
  DeliveryMethod,
  ProductArchetype
} from '../../../types/materialRequirements';
import { Supplier } from '../../../services/api/suppliersApi';
import { buildPdfUrls } from '../../../utils/pdfUrls';
import { Order } from '../../../types/orders';
import OrderFormPdfPreview from './OrderFormPdfPreview';
import { MaterialRequirementCard } from './MaterialRequirementCard';
import { VinylInventorySelector } from '../../common/VinylInventorySelector';
import { GeneralInventorySelectorModal } from '../../supplyChain/components/GeneralInventorySelectorModal';
import { useModalBackdrop } from '../../../hooks/useModalBackdrop';

interface MaterialRequirementsConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  orderNumber: number;
  orderName: string;
  onConfirm: () => Promise<void>;
  order?: Order | null;
}

export interface MaterialRow {
  _localId: string;
  requirement_id: number | null;
  _deleted: boolean;
  custom_product_type: string;
  size_description: string;
  quantity_ordered: number;
  supplier_id: number | null;
  delivery_method: DeliveryMethod;
  notes: string;
  // Product identification
  archetype_id: number | null;
  vinyl_product_id: number | null;
  supplier_product_id: number | null;
  // Inventory holds
  held_vinyl_id: number | null;
  held_supplier_product_id: number | null;
  held_vinyl_quantity?: string | null;
  held_vinyl_width?: number | null;
  held_vinyl_length_yards?: number | null;
  held_general_quantity?: string | null;
  // Display-only from existing records
  archetype_name?: string;
  supplier_name?: string;
  vinyl_product_display?: string;
  supplier_product_name?: string;
}

export interface SupplierProduct {
  supplier_product_id: number;
  product_name: string | null;
  sku: string | null;
  supplier_id: number;
  supplier_name?: string;
  archetype_id?: number;
}

let localIdCounter = 0;
const generateLocalId = () => `local_${++localIdCounter}_${Date.now()}`;

const toRow = (req: MaterialRequirement): MaterialRow => ({
  _localId: generateLocalId(),
  requirement_id: req.requirement_id,
  _deleted: false,
  custom_product_type: req.custom_product_type || '',
  size_description: req.size_description || '',
  quantity_ordered: req.quantity_ordered || 0,
  supplier_id: req.supplier_id,
  delivery_method: req.delivery_method || 'pickup',
  notes: req.notes || '',
  archetype_id: req.archetype_id,
  vinyl_product_id: req.vinyl_product_id,
  supplier_product_id: req.supplier_product_id,
  held_vinyl_id: req.held_vinyl_id,
  held_supplier_product_id: req.held_supplier_product_id,
  held_vinyl_quantity: req.held_vinyl_quantity,
  held_vinyl_width: req.held_vinyl_width,
  held_vinyl_length_yards: req.held_vinyl_length_yards,
  held_general_quantity: req.held_general_quantity,
  archetype_name: req.archetype_name || undefined,
  supplier_name: req.supplier_name || undefined,
  vinyl_product_display: req.vinyl_product_display || undefined,
  supplier_product_name: req.supplier_product_name || undefined,
});

const emptyRow = (): MaterialRow => ({
  _localId: generateLocalId(),
  requirement_id: null,
  _deleted: false,
  custom_product_type: '',
  size_description: '',
  quantity_ordered: 1,
  supplier_id: null,
  delivery_method: 'pickup',
  notes: '',
  archetype_id: null,
  vinyl_product_id: null,
  supplier_product_id: null,
  held_vinyl_id: null,
  held_supplier_product_id: null,
});

export const MaterialRequirementsConfirmationModal: React.FC<MaterialRequirementsConfirmationModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  orderName,
  onConfirm,
  order
}) => {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [originalRows, setOriginalRows] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const supplierProductsRef = useRef<SupplierProduct[]>([]);
  const rowsRef = useRef<MaterialRow[]>([]);
  const originalRowsRef = useRef<MaterialRow[]>([]);

  // Dropdown data
  const [archetypes, setArchetypes] = useState<ProductArchetype[] | undefined>(undefined);
  const [vinylProducts, setVinylProducts] = useState<any[] | undefined>(undefined);
  const [suppliers, setSuppliers] = useState<Supplier[] | undefined>(undefined);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);

  // Inventory hold state
  const [showVinylSelector, setShowVinylSelector] = useState(false);
  const [showGeneralInventorySelector, setShowGeneralInventorySelector] = useState(false);
  const [selectedRowForHold, setSelectedRowForHold] = useState<MaterialRow | null>(null);

  const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp, isMobile } =
    useModalBackdrop({ isOpen, onClose, preventClose: showVinylSelector || showGeneralInventorySelector });

  supplierProductsRef.current = supplierProducts;
  rowsRef.current = rows;
  originalRowsRef.current = originalRows;

  // Load all dropdown data once on mount
  useEffect(() => {
    void archetypesApi.getArchetypes({ active_only: true })
      .then(setArchetypes).catch(e => console.error('Failed to load archetypes:', e));
    void vinylProductsApi.getVinylProducts({ active_only: true })
      .then(setVinylProducts).catch(e => console.error('Failed to load vinyl products:', e));
    void suppliersApi.getSuppliers({ active_only: true })
      .then(setSuppliers).catch(e => console.error('Failed to load suppliers:', e));
    void supplierProductsApi.getSupplierProducts({ active_only: true })
      .then(setSupplierProducts).catch(e => console.error('Failed to load supplier products:', e));
  }, []);

  const fetchRequirements = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const reqs = await materialRequirementsApi.getRequirementsByOrderId(orderId);
      if (reqs.length > 0) { setRows(reqs.map(toRow)); setOriginalRows(reqs.map(toRow)); }
      else { setRows([emptyRow()]); setOriginalRows([]); }
    } catch (err) {
      console.error('Error fetching material requirements:', err);
      setError('Failed to load material requirements. Click retry to try again.');
    } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { if (isOpen) fetchRequirements(); }, [isOpen, fetchRequirements]);

  const handleFieldChange = useCallback((localId: string, field: string, value: any) => {
    setRows(prev => prev.map(r => r._localId === localId ? { ...r, [field]: value } : r));
  }, []);
  // Cascading: Product Type changes → clear product + vendor
  const handleProductTypeChange = useCallback((localId: string, archetypeId: number | null) => {
    setRows(prev => prev.map(r => r._localId === localId ? { ...r, archetype_id: archetypeId, vinyl_product_id: null, supplier_product_id: null, supplier_id: null, custom_product_type: '' } : r));
  }, []);
  const handleVinylProductChange = useCallback((localId: string, productId: number | null) => {
    setRows(prev => prev.map(r => r._localId === localId ? { ...r, vinyl_product_id: productId } : r));
  }, []);
  // Supplier product selected → auto-assign vendor (ref avoids dep on supplierProducts)
  const handleSupplierProductChange = useCallback((localId: string, productId: number | null) => {
    if (productId === null) { setRows(prev => prev.map(r => r._localId === localId ? { ...r, supplier_product_id: null } : r)); return; }
    const sp = supplierProductsRef.current.find(p => p.supplier_product_id === productId);
    setRows(prev => prev.map(r => r._localId === localId ? { ...r, supplier_product_id: productId, supplier_id: sp?.supplier_id ?? null } : r));
  }, []);
  // Custom product type text (non-vinyl combobox)
  const handleCustomProductTypeChange = useCallback((localId: string, text: string) => {
    setRows(prev => prev.map(r => {
      if (r._localId !== localId) return r;
      const updates: Partial<MaterialRow> = { custom_product_type: text };
      if (text.trim() && r.supplier_product_id !== null) {
        updates.supplier_product_id = null;
      }
      return { ...r, ...updates };
    }));
  }, []);

  const addRow = useCallback(() => setRows(prev => [...prev, emptyRow()]), []);
  const removeRow = useCallback((localId: string) => {
    setRows(prev => {
      const row = prev.find(r => r._localId === localId);
      if (!row) return prev;
      if (row.requirement_id) return prev.map(r => r._localId === localId ? { ...r, _deleted: true } : r);
      return prev.filter(r => r._localId !== localId);
    });
  }, []);

  /**
   * Save all unsaved/changed rows to DB.
   * Returns updated rows array with requirement_ids populated.
   */
  const saveAllRows = useCallback(async (): Promise<MaterialRow[]> => {
    const currentRows = [...rowsRef.current];
    const currentOriginals = [...originalRowsRef.current];
    const updatedRows = [...currentRows];
    const updatedOriginals = [...currentOriginals];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      if (row._deleted) continue;

      if (!row.requirement_id) {
        // Skip completely empty rows
        if (!row.custom_product_type && !row.archetype_id && !row.size_description && row.quantity_ordered <= 0) {
          continue;
        }
        const created = await materialRequirementsApi.createRequirement({
          order_id: orderId,
          archetype_id: row.archetype_id,
          custom_product_type: row.archetype_id ? null : (row.custom_product_type || null),
          vinyl_product_id: row.vinyl_product_id,
          supplier_product_id: row.supplier_product_id,
          size_description: row.size_description || null,
          quantity_ordered: row.quantity_ordered || 1,
          supplier_id: row.supplier_id,
          delivery_method: row.delivery_method,
          notes: row.notes || null,
        });
        updatedRows[i] = { ...row, requirement_id: created.requirement_id };
        updatedOriginals.push({ ...updatedRows[i] });
      } else {
        const original = currentOriginals.find(o => o.requirement_id === row.requirement_id);
        if (original && hasRowChanged(original, row)) {
          await materialRequirementsApi.updateRequirement(row.requirement_id, {
            archetype_id: row.archetype_id,
            custom_product_type: row.archetype_id ? null : (row.custom_product_type || null),
            vinyl_product_id: row.vinyl_product_id,
            supplier_product_id: row.supplier_product_id,
            size_description: row.size_description || null,
            quantity_ordered: row.quantity_ordered,
            supplier_id: row.supplier_id,
            delivery_method: row.delivery_method,
            notes: row.notes || null,
          });
          const origIdx = updatedOriginals.findIndex(o => o.requirement_id === row.requirement_id);
          if (origIdx >= 0) updatedOriginals[origIdx] = { ...updatedRows[i] };
        }
      }
    }

    setRows(updatedRows);
    setOriginalRows(updatedOriginals);
    return updatedRows;
  }, [orderId]);

  const handleCheckStock = useCallback(async (row: MaterialRow, stockType: 'vinyl' | 'general') => {
    try {
      const savedRows = await saveAllRows();
      const savedRow = savedRows.find(r => r._localId === row._localId) || row;

      setSelectedRowForHold(savedRow);
      if (stockType === 'vinyl') setShowVinylSelector(true);
      else setShowGeneralInventorySelector(true);
    } catch (err) {
      console.error('Error saving rows before stock check:', err);
      setError('Failed to save requirements.');
    }
  }, [saveAllRows]);

  const handleVinylHoldSelect = async (vinylId: number, quantity: string) => {
    if (!selectedRowForHold?.requirement_id) return;
    try {
      await materialRequirementsApi.createVinylHold(selectedRowForHold.requirement_id, { vinyl_id: vinylId, quantity });
      setShowVinylSelector(false); setSelectedRowForHold(null); void fetchRequirements();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to create hold'); }
  };

  const handleReleaseHold = async (row: MaterialRow) => {
    if (!row.requirement_id) return;
    try {
      await materialRequirementsApi.releaseHold(row.requirement_id);
      void fetchRequirements();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to release hold'); }
  };

  const handleChangeHold = async (row: MaterialRow, stockType: 'vinyl' | 'general') => {
    if (!row.requirement_id) return;
    try {
      await materialRequirementsApi.releaseHold(row.requirement_id);
      void fetchRequirements();
      // Open selector immediately — row still has vinyl_product_id/archetype_id
      setSelectedRowForHold(row);
      if (stockType === 'vinyl') setShowVinylSelector(true);
      else setShowGeneralInventorySelector(true);
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to release hold'); }
  };

  const handleGeneralInventoryHoldSelect = async (supplierProductId: number, quantity: string) => {
    if (!selectedRowForHold?.requirement_id) return;
    try {
      await materialRequirementsApi.createGeneralInventoryHold(selectedRowForHold.requirement_id, { supplier_product_id: supplierProductId, quantity });
      setShowGeneralInventorySelector(false); setSelectedRowForHold(null); void fetchRequirements();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to create hold'); }
  };

  const handleConfirm = async () => {
    try {
      setSaving(true);
      setError(null);

      // Save all new/changed rows
      await saveAllRows();

      // Delete removed existing rows
      const deletedRows = rowsRef.current.filter(r => r._deleted && r.requirement_id);
      for (const row of deletedRows) {
        await materialRequirementsApi.deleteRequirement(row.requirement_id!);
      }

      await onConfirm();
    } catch (err) {
      console.error('Error saving material requirements:', err);
      setError('Failed to save material requirements. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const visibleRows = rows.filter(r => !r._deleted);

  // Memoize PDF URL — buildPdfUrls uses Date.now() cache buster, so without
  // memoization it produces a new string every render, defeating React.memo.
  const masterUrl = useMemo(() => {
    const urls = order ? buildPdfUrls(order) : null;
    return urls?.master || null;
  }, [order]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[65] p-4"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className={`bg-white rounded-lg shadow-2xl max-h-[85vh] flex flex-col ${masterUrl ? 'w-[1600px]' : 'w-[700px]'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-100">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Confirm Material Requirements
              </h2>
              <p className="text-sm text-gray-500">
                #{orderNumber} - {orderName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Split layout when PDF available */}
        <div className={`flex-1 overflow-hidden flex ${masterUrl ? 'flex-row' : ''}`}>
          {/* Left Panel: Materials cards */}
          <div className={`overflow-y-auto px-6 py-4 ${masterUrl ? 'w-[650px] flex-shrink-0 border-r border-gray-200' : 'flex-1'}`}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <span className="ml-2 text-sm text-gray-600">Loading requirements...</span>
              </div>
            ) : error && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                <p className="text-sm text-red-600 mb-3">{error}</p>
                <button
                  onClick={fetchRequirements}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Review and edit the material requirements before moving to production.
                </p>

                {/* Material Cards */}
                {visibleRows.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
                    No material requirements. Click "Add Material" to add one.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleRows.map((row, idx) => (
                      <MaterialRequirementCard
                        key={row._localId}
                        row={row}
                        index={idx}
                        archetypes={archetypes}
                        vinylProducts={vinylProducts}
                        suppliers={suppliers}
                        supplierProducts={supplierProducts}
                        onProductTypeChange={handleProductTypeChange}
                        onVinylProductChange={handleVinylProductChange}
                        onSupplierProductChange={handleSupplierProductChange}
                        onCustomProductTypeChange={handleCustomProductTypeChange}
                        onFieldChange={handleFieldChange}
                        onRemove={removeRow}
                        onCheckStock={handleCheckStock}
                        onReleaseHold={handleReleaseHold}
                        onChangeHold={handleChangeHold}
                      />
                    ))}
                  </div>
                )}

                {/* Add Material Button */}
                <button
                  onClick={addRow}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Material
                </button>

                {/* Inline error during save */}
                {error && rows.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Panel: PDF Preview */}
          {masterUrl && (
            <div className="flex-1 overflow-hidden p-4">
              <div className="h-full flex flex-col">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" />
                  Order Form Preview
                </h3>
                <div className="flex-1 overflow-hidden">
                  <OrderFormPdfPreview url={masterUrl} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirm & Move to Production
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Vinyl Selector Modal */}
      {selectedRowForHold?.vinyl_product_id && (
        <VinylInventorySelector
          mode="hold"
          isOpen={showVinylSelector}
          onClose={() => {
            setShowVinylSelector(false);
            setSelectedRowForHold(null);
          }}
          onSelect={handleVinylHoldSelect}
          vinylProductId={selectedRowForHold.vinyl_product_id}
          title="Select Vinyl from Inventory"
          requirementSize={selectedRowForHold.size_description || undefined}
          requirementQty={selectedRowForHold.quantity_ordered}
        />
      )}

      {/* General Inventory Selector Modal */}
      {selectedRowForHold?.archetype_id && !selectedRowForHold?.vinyl_product_id && (
        <GeneralInventorySelectorModal
          isOpen={showGeneralInventorySelector}
          onClose={() => {
            setShowGeneralInventorySelector(false);
            setSelectedRowForHold(null);
          }}
          onSelect={handleGeneralInventoryHoldSelect}
          archetypeId={selectedRowForHold.archetype_id}
          archetypeName={selectedRowForHold.archetype_name || undefined}
          title="Select from Inventory"
        />
      )}
    </div>
  );
};

function hasRowChanged(original: MaterialRow, current: MaterialRow): boolean {
  return (
    original.custom_product_type !== current.custom_product_type ||
    original.size_description !== current.size_description ||
    original.quantity_ordered !== current.quantity_ordered ||
    original.supplier_id !== current.supplier_id ||
    original.delivery_method !== current.delivery_method ||
    original.notes !== current.notes ||
    original.archetype_id !== current.archetype_id ||
    original.vinyl_product_id !== current.vinyl_product_id ||
    original.supplier_product_id !== current.supplier_product_id
  );
}

export default MaterialRequirementsConfirmationModal;
