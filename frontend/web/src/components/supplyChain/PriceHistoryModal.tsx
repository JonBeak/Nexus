// Phase 4.c: Price History Modal Component
// Purpose: View and add pricing history for supplier products
// Created: 2025-12-19

import React, { useCallback, useEffect, useState } from 'react';
import { X, Plus, Loader, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { SupplierProduct, PricingHistory } from '../../types/supplyChain';
import { getTodayString } from '../../utils/dateUtils';

export interface PriceHistoryModalProps {
  product: SupplierProduct;
  onClose: () => void;
  onAddPrice?: () => void;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  product,
  onClose,
  onAddPrice
}) => {
  const [priceHistory, setPriceHistory] = useState<PricingHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    unit_price: '',
    cost_currency: product.cost_currency || 'CAD',
    effective_start_date: getTodayString(),
    notes: ''
  });

  // Load price history
  const loadPriceHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<PricingHistory[]>(
        `/supplier-products/${product.supplier_product_id}/prices/history`
      );

      setPriceHistory(response.data || []);
    } catch (err: any) {
      console.error('Error loading price history:', err);
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to load price history'
      );
    } finally {
      setLoading(false);
    }
  }, [product.supplier_product_id]);

  useEffect(() => {
    void loadPriceHistory();
  }, [loadPriceHistory]);

  // Handle add price
  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.unit_price) {
      setError('Unit price is required');
      return;
    }

    try {
      setSaving(true);

      await api.post(`/supplier-products/${product.supplier_product_id}/prices`, {
        unit_price: parseFloat(formData.unit_price),
        cost_currency: formData.cost_currency,
        effective_start_date: formData.effective_start_date,
        notes: formData.notes || undefined
      });

      setShowForm(false);
      setFormData({
        unit_price: '',
        cost_currency: product.cost_currency || 'CAD',
        effective_start_date: getTodayString(),
        notes: ''
      });

      await loadPriceHistory();
      onAddPrice?.();
    } catch (err: any) {
      console.error('Error adding price:', err);
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to add price'
      );
    } finally {
      setSaving(false);
    }
  };

  // Format price change display
  const getPriceChangeDisplay = (change: number | string | null) => {
    if (change === null || change === undefined || change === '') return null;

    const numChange = typeof change === 'string' ? parseFloat(change) : change;
    if (isNaN(numChange) || numChange === 0) return null;

    const isPositive = numChange > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? 'text-red-600' : 'text-green-600';
    const bgColor = isPositive ? 'bg-red-50' : 'bg-green-50';

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${bgColor} ${color}`}>
        <Icon className="w-3 h-3" />
        {numChange > 0 ? '+' : ''}{numChange.toFixed(2)}%
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Price History</h3>
              <p className="text-sm text-gray-600 mt-1">
                {product.supplier_name} - {product.brand_name || product.sku || 'Supplier Product'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

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

          {/* Loading state */}
          {loading && priceHistory.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
              <p className="mt-2 text-sm text-gray-600">Loading price history...</p>
            </div>
          ) : (
            <>
              {/* Price History Table */}
              {priceHistory.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg mb-4">
                  <p className="text-gray-500 mb-3">No price history yet</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add first price
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Effective Date
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          End Date
                        </th>
                        <th className="text-right px-4 py-2 font-medium text-gray-700">
                          Unit Price
                        </th>
                        <th className="text-center px-4 py-2 font-medium text-gray-700">
                          Change
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Notes
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Added By
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((entry) => {
                        const isCurrent = !entry.effective_end_date;
                        return (
                          <tr
                            key={entry.pricing_id}
                            className={`border-b ${isCurrent ? 'bg-blue-50' : ''}`}
                          >
                            <td className="px-4 py-2 font-mono text-xs text-gray-600">
                              {new Date(entry.effective_start_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-600">
                              {entry.effective_end_date
                                ? new Date(entry.effective_end_date).toLocaleDateString()
                                : isCurrent
                                  ? '✓ Current'
                                  : '-'}
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              ${parseFloat(String(entry.unit_price)).toFixed(4)} {entry.cost_currency}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {getPriceChangeDisplay(entry.price_change_percent)}
                            </td>
                            <td className="px-4 py-2 text-gray-600 max-w-xs truncate">
                              {entry.notes || '-'}
                            </td>
                            <td className="px-4 py-2 text-gray-600">
                              {entry.created_by_name || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Price Form */}
              {showForm ? (
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                  <h4 className="font-medium text-gray-900 mb-3">Add New Price</h4>

                  <form onSubmit={handleAddPrice} className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit Price *
                        </label>
                        <input
                          type="number"
                          placeholder="e.g., 1.35"
                          step="0.0001"
                          min="0"
                          value={formData.unit_price}
                          onChange={(e) =>
                            setFormData({ ...formData, unit_price: e.target.value })
                          }
                          disabled={saving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Currency
                        </label>
                        <select
                          value={formData.cost_currency}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              cost_currency: e.target.value
                            })
                          }
                          disabled={saving}
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
                          value={formData.effective_start_date}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              effective_start_date: e.target.value
                            })
                          }
                          disabled={saving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <input
                          type="text"
                          placeholder="Why the change?"
                          value={formData.notes}
                          onChange={(e) =>
                            setFormData({ ...formData, notes: e.target.value })
                          }
                          disabled={saving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        disabled={saving}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !formData.unit_price}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Add Price
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 px-3 py-1.5 rounded hover:bg-purple-50"
                >
                  <Plus className="w-4 h-4" />
                  Add New Price
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
