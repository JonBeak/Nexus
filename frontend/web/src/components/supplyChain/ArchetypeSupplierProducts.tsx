// Phase 4.c: Archetype Supplier Products Component
// Purpose: Display and manage supplier products for an archetype (inline in ProductArchetypesManager)
// Created: 2025-12-19

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Edit, Trash2, TrendingUp, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { SupplierProduct, Supplier } from '../../types/supplyChain';
import { SupplierProductEditor } from './SupplierProductEditor';
import { PriceHistoryModal } from './PriceHistoryModal';

export interface ArchetypeSupplierProductsProps {
  archetypeId: number;
  onUpdate?: () => void;
}

export const ArchetypeSupplierProducts: React.FC<ArchetypeSupplierProductsProps> = ({
  archetypeId,
  onUpdate
}) => {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor/Modal state
  const [showEditor, setShowEditor] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);

  // Load products and suppliers
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [productsRes, suppliersRes] = await Promise.all([
        api.get<SupplierProduct[]>('/supplier-products/archetype/' + archetypeId),
        api.get<Supplier[]>('/suppliers')
      ]);

      setProducts(productsRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (err: any) {
      console.error('Error loading supplier products:', err);
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to load supplier products'
      );
    } finally {
      setLoading(false);
    }
  }, [archetypeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle create/update product
  const handleSave = async (data: any) => {
    try {
      if (editingProduct) {
        await api.put(`/supplier-products/${editingProduct.supplier_product_id}`, data);
      } else {
        await api.post('/supplier-products', {
          ...data,
          archetype_id: archetypeId
        });
      }

      setShowEditor(false);
      setEditingProduct(null);
      void loadData();
      onUpdate?.();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to save supplier product'
      );
    }
  };

  // Handle delete product
  const handleDelete = async (product: SupplierProduct) => {
    if (!confirm(`Delete "${product.brand_name || product.sku || 'this product'}"?`)) return;

    try {
      await api.delete(`/supplier-products/${product.supplier_product_id}`);
      void loadData();
      onUpdate?.();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to delete supplier product'
      );
    }
  };

  // Handle edit
  const handleEdit = (product: SupplierProduct) => {
    setEditingProduct(product);
    setShowEditor(true);
  };

  // Handle view price history
  const handleViewPriceHistory = (product: SupplierProduct) => {
    setSelectedProduct(product);
    setShowPriceHistory(true);
  };

  if (loading && products.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
        <p className="text-sm text-gray-600 mt-1">Loading supplier products...</p>
      </div>
    );
  }

  return (
    <>
      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-600 hover:text-red-700 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Supplier Products Table */}
      {products.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm mb-3">No supplier products linked yet</p>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowEditor(true);
            }}
            className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
          >
            <Plus className="w-4 h-4" />
            Add first supplier product
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Supplier</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Brand</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">SKU</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">Current Price</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">Lead Time</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-700">MOQ</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.supplier_product_id}
                    className={`border-b ${!product.is_active ? 'bg-gray-50 opacity-50' : ''}`}
                  >
                    <td className="px-3 py-2">{product.supplier_name}</td>
                    <td className="px-3 py-2">{product.brand_name || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">
                      {product.sku || '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {product.current_price && product.current_price !== 0 ? (
                        <span className="font-medium">
                          ${parseFloat(String(product.current_price)).toFixed(4)} {product.cost_currency}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not priced</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {product.effective_lead_time || '-'} days
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {product.min_order_quantity ? (
                        <span>{parseFloat(String(product.min_order_quantity)).toFixed(2)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => handleViewPriceHistory(product)}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                          title="View price history"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                          title="Edit product"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Product Button */}
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowEditor(true);
            }}
            className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 px-3 py-1.5 rounded hover:bg-purple-50"
          >
            <Plus className="w-4 h-4" />
            Add Supplier Product
          </button>
        </>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <SupplierProductEditor
          archetypeId={archetypeId}
          product={editingProduct}
          suppliers={suppliers}
          onSave={handleSave}
          onCancel={() => {
            setShowEditor(false);
            setEditingProduct(null);
          }}
        />
      )}

      {/* Price History Modal */}
      {showPriceHistory && selectedProduct && (
        <PriceHistoryModal
          product={selectedProduct}
          onClose={() => {
            setShowPriceHistory(false);
            setSelectedProduct(null);
            void loadData();
          }}
        />
      )}
    </>
  );
};
