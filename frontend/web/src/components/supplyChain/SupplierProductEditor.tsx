// Phase 4.c: Supplier Product Editor Component
// Purpose: Modal form for creating/editing supplier products
// Created: 2025-12-19

import React, { useEffect, useState } from 'react';
import { X, Save, Loader } from 'lucide-react';
import { SupplierProduct, Supplier } from '../../types/supplyChain';
import { SpecificationEditor } from './SpecificationEditor';
import { apiClient } from '../../services/api';
import { getTodayString } from '../../utils/dateUtils';

export interface SupplierProductEditorProps {
  archetypeId: number;
  product?: SupplierProduct | null;
  suppliers: Supplier[];
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const SupplierProductEditor: React.FC<SupplierProductEditorProps> = ({
  archetypeId,
  product,
  suppliers,
  onSave,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    supplier_id: 0,
    brand_name: '',
    sku: '',
    product_name: '',
    min_order_quantity: '',
    lead_time_days: '',
    notes: '',
    is_preferred: false,
    specifications: {} as Record<string, any>,
    initial_price: {
      unit_price: '',
      cost_currency: 'CAD',
      effective_start_date: getTodayString(),
      notes: ''
    }
  });

  const [specRows, setSpecRows] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' }
  ]);

  const [archetypeTemplate, setArchetypeTemplate] = useState<string[] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load product data when editing or fetch archetype specs when creating
  useEffect(() => {
    if (product) {
      setFormData({
        supplier_id: product.supplier_id,
        brand_name: product.brand_name || '',
        sku: product.sku || '',
        product_name: product.product_name || '',
        min_order_quantity: product.min_order_quantity?.toString() || '',
        lead_time_days: product.lead_time_days?.toString() || '',
        notes: product.notes || '',
        is_preferred: product.is_preferred,
        specifications: product.specifications || {},
        initial_price: {
          unit_price: '',
          cost_currency: 'CAD',
          effective_start_date: getTodayString(),
          notes: ''
        }
      });

      // Load specs into rows
      if (product.specifications) {
        const rows = Object.entries(product.specifications).map(([key, value]) => ({
          key,
          value: String(value)
        }));
        setSpecRows(rows.length > 0 ? rows : [{ key: '', value: '' }]);
      }
    } else {
      // Fetch archetype specification template for auto-fill
      const fetchArchetypeTemplate = async () => {
        try {
          const response = await apiClient.get(`/product-types/${archetypeId}`);
          // Note: apiClient interceptor unwraps {success, data} so response.data is the archetype directly
          if (response.data && response.data.specifications) {
            // Extract keys from specifications object to use as template
            const specs = response.data.specifications;
            if (typeof specs === 'object' && specs !== null) {
              const templateKeys = Object.keys(specs);
              setArchetypeTemplate(templateKeys);

              // Auto-fill spec rows from template with default values from archetype
              const templateRows = Object.entries(specs).map(([key, value]) => ({
                key,
                value: String(value || '') // Use archetype's default value, or empty if null
              }));
              setSpecRows(templateRows.length > 0 ? templateRows : [{ key: '', value: '' }]);
            }
          }
        } catch (error) {
          console.error('Failed to fetch archetype template:', error);
        }
      };

      void fetchArchetypeTemplate();

      // Default supplier if available
      if (suppliers.length > 0) {
        setFormData((prev) => ({
          ...prev,
          supplier_id: suppliers[0].supplier_id
        }));
      }
    }
  }, [product, suppliers]);

  // Convert spec rows to object
  const rowsToSpecs = (rows: Array<{ key: string; value: string }>): Record<string, any> => {
    const specs: Record<string, any> = {};
    for (const row of rows) {
      if (row.key.trim()) {
        const numValue = parseFloat(row.value);
        specs[row.key.trim()] = !isNaN(numValue) && row.value.trim() === String(numValue)
          ? numValue
          : row.value.trim();
      }
    }
    return specs;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!formData.supplier_id) {
      setSaveError('Supplier is required');
      return;
    }

    try {
      const submitData = {
        supplier_id: formData.supplier_id,
        brand_name: formData.brand_name || undefined,
        sku: formData.sku || undefined,
        product_name: formData.product_name || undefined,
        min_order_quantity: formData.min_order_quantity
          ? parseFloat(formData.min_order_quantity)
          : undefined,
        lead_time_days: formData.lead_time_days
          ? parseInt(formData.lead_time_days)
          : undefined,
        notes: formData.notes || undefined,
        is_preferred: formData.is_preferred,
        specifications: Object.keys(rowsToSpecs(specRows)).length > 0
          ? rowsToSpecs(specRows)
          : undefined,
        ...(product
          ? {} // No initial price for updates
          : {
              // Include initial price for creates
              initial_price: formData.initial_price.unit_price
                ? {
                    unit_price: parseFloat(formData.initial_price.unit_price),
                    cost_currency: formData.initial_price.cost_currency,
                    effective_start_date: formData.initial_price.effective_start_date,
                    notes: formData.initial_price.notes || undefined
                  }
                : undefined
            })
      };

      await onSave(submitData);
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save supplier product');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {product ? 'Edit Supplier Product' : 'Add Supplier Product'}
            </h3>
            <button
              onClick={onCancel}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error message */}
          {saveError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{saveError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Supplier Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier *
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_id: parseInt(e.target.value) })
                }
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100"
              >
                <option value={0}>Select supplier...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand Name
              </label>
              <input
                type="text"
                placeholder="e.g., 3M, Avery"
                value={formData.brand_name}
                onChange={(e) =>
                  setFormData({ ...formData, brand_name: e.target.value })
                }
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100"
              />
            </div>

            {/* SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  placeholder="Supplier part number"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100"
                />
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name
                  <span className="text-gray-400 text-xs ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Custom display name"
                  value={formData.product_name}
                  onChange={(e) =>
                    setFormData({ ...formData, product_name: e.target.value })
                  }
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Leave blank to use archetype name</p>
              </div>
            </div>

            {/* MOQ and Lead Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Order Quantity
                </label>
                <input
                  type="number"
                  placeholder="Optional"
                  step="0.01"
                  min="0"
                  value={formData.min_order_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, min_order_quantity: e.target.value })
                  }
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Lead Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  placeholder="Override supplier default"
                  min="0"
                  value={formData.lead_time_days}
                  onChange={(e) =>
                    setFormData({ ...formData, lead_time_days: e.target.value })
                  }
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100"
                />
              </div>

              {/* Preferred Checkbox */}
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_preferred}
                    onChange={(e) =>
                      setFormData({ ...formData, is_preferred: e.target.checked })
                    }
                    disabled={loading}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Preferred for BOMs</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                placeholder="Additional notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                disabled={loading}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100"
              />
            </div>

            {/* Specifications */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specifications
              </label>
              <SpecificationEditor
                specRows={specRows}
                setSpecRows={setSpecRows}
                disabled={loading}
                archetypeTemplate={archetypeTemplate}
                mode="supplier"
              />
            </div>

            {/* Initial Price (only for create) */}
            {!product && (
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                <h4 className="font-medium text-gray-900 mb-3">Initial Price</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Price
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 1.25"
                      step="0.0001"
                      min="0"
                      value={formData.initial_price.unit_price}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          initial_price: {
                            ...formData.initial_price,
                            unit_price: e.target.value
                          }
                        })
                      }
                      disabled={loading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={formData.initial_price.cost_currency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          initial_price: {
                            ...formData.initial_price,
                            cost_currency: e.target.value
                          }
                        })
                      }
                      disabled={loading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="CAD">CAD</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effective Date
                    </label>
                    <input
                      type="date"
                      value={formData.initial_price.effective_start_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          initial_price: {
                            ...formData.initial_price,
                            effective_start_date: e.target.value
                          }
                        })
                      }
                      disabled={loading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Quoted price"
                      value={formData.initial_price.notes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          initial_price: {
                            ...formData.initial_price,
                            notes: e.target.value
                          }
                        })
                      }
                      disabled={loading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.supplier_id}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {product ? 'Update' : 'Create'} Product
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
