/**
 * All Orders Material Requirements
 * Unified table tracking all material requirements across orders and stock
 * Created: 2025-01-27
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Package,
  Truck,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { materialRequirementsApi } from '../../services/api';
import type {
  MaterialRequirement,
  MaterialRequirementStatus,
  MaterialRequirementFilters,
  CreateMaterialRequirementRequest,
} from '../../types/materialRequirements';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';

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
  { value: 'shipping', label: 'Shipping' },
  { value: 'pickup', label: 'Pickup' },
];

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [receiveModalId, setReceiveModalId] = useState<number | null>(null);
  const [receiveQuantity, setReceiveQuantity] = useState<number>(0);

  // New requirement form state
  const [newRequirement, setNewRequirement] = useState<CreateMaterialRequirementRequest>({
    quantity_ordered: 0,
    delivery_method: 'shipping',
  });

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

  const getStatusBadge = (status: MaterialRequirementStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'ordered':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
            <Truck className="w-3 h-3" />
            Ordered
          </span>
        );
      case 'backordered':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Backordered
          </span>
        );
      case 'partial_received':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 flex items-center gap-1">
            <Package className="w-3 h-3" />
            Partial
          </span>
        );
      case 'received':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Received
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleReceive = async () => {
    if (!receiveModalId || receiveQuantity <= 0) return;

    try {
      await materialRequirementsApi.receiveQuantity(receiveModalId, {
        quantity: receiveQuantity,
        received_date: new Date().toISOString().split('T')[0],
      });
      showNotification('Quantity received successfully', 'success');
      setReceiveModalId(null);
      setReceiveQuantity(0);
      void loadRequirements();
    } catch (error) {
      console.error('Error receiving quantity:', error);
      showNotification('Failed to receive quantity', 'error');
    }
  };

  const handleCreate = async () => {
    try {
      if (!newRequirement.order_id && !newRequirement.is_stock_item) {
        showNotification('Please select an order or mark as stock item', 'error');
        return;
      }
      if (newRequirement.quantity_ordered <= 0) {
        showNotification('Quantity must be greater than 0', 'error');
        return;
      }

      await materialRequirementsApi.createRequirement({
        ...newRequirement,
        entry_date: new Date().toISOString().split('T')[0],
      });
      showNotification('Material requirement created', 'success');
      setShowAddModal(false);
      setNewRequirement({ quantity_ordered: 0, delivery_method: 'shipping' });
      void loadRequirements();
    } catch (error) {
      console.error('Error creating requirement:', error);
      showNotification('Failed to create requirement', 'error');
    }
  };

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
    try {
      await materialRequirementsApi.updateRequirement(id, { [field]: value });
      void loadRequirements();
    } catch (error) {
      console.error('Error updating requirement:', error);
      showNotification('Failed to update', 'error');
    }
  };

  const thClass = `px-4 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`;

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
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Requirement
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
        <table className="w-full">
          <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
            <tr>
              <th className={thClass}>Date</th>
              <th className={thClass}>Job/Stock</th>
              <th className={thClass}>Product Type</th>
              <th className={thClass}>Size</th>
              <th className={`${thClass} text-right`}>Qty</th>
              <th className={thClass}>Vendor</th>
              <th className={thClass}>Ordered</th>
              <th className={thClass}>Delivery</th>
              <th className={`${thClass} text-right`}>Received</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Notes</th>
              <th className={`${thClass} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className={PAGE_STYLES.panel.divider}>
            {requirements.map((req) => (
              <tr key={req.requirement_id} className="hover:bg-[var(--theme-hover-bg)]">
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {formatDate(req.entry_date)}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.text}`}>
                  {req.is_stock_item ? (
                    <span className="text-purple-600 font-medium">Stock</span>
                  ) : (
                    <span className="text-blue-600">{req.order_number || '-'}</span>
                  )}
                </td>
                <td className={`px-4 py-3 text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                  {req.archetype_name || req.custom_product_type || '-'}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {req.size_description || '-'}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.text} text-right`}>
                  {req.quantity_ordered} {req.unit_of_measure || ''}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {req.supplier_name || '-'}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {formatDate(req.ordered_date)}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {req.delivery_method === 'pickup' ? 'Pickup' : 'Ship'}
                </td>
                <td className={`px-4 py-3 text-sm text-right ${req.quantity_received > 0 ? 'text-green-600 font-medium' : PAGE_STYLES.panel.textMuted}`}>
                  {req.quantity_received || 0}
                </td>
                <td className="px-4 py-3">
                  {getStatusBadge(req.status)}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textMuted} max-w-[200px] truncate`}>
                  {req.notes || '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {['pending', 'ordered', 'backordered', 'partial_received'].includes(req.status) && (
                      <button
                        onClick={() => {
                          setReceiveModalId(req.requirement_id);
                          setReceiveQuantity(Number(req.quantity_ordered) - Number(req.quantity_received));
                        }}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Receive
                      </button>
                    )}
                    {req.status !== 'received' && (
                      <button
                        onClick={() => handleDelete(req.requirement_id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {requirements.length === 0 && !loading && (
        <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">No material requirements found</p>
          <p className="text-sm">Click "Add Requirement" to create one</p>
        </div>
      )}

      {/* Receive Modal */}
      {receiveModalId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-md w-full mx-4`}>
            <div className="p-6">
              <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text} mb-4`}>Receive Quantity</h2>
              <div className="mb-4">
                <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>
                  Quantity Received
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={receiveQuantity}
                  onChange={(e) => setReceiveQuantity(Number(e.target.value))}
                  className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md`}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setReceiveModalId(null); setReceiveQuantity(0); }}
                  className={`px-4 py-2 ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.header.background} rounded hover:opacity-80`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReceive}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Receive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto`}>
            <div className="p-6">
              <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text} mb-4`}>Add Material Requirement</h2>

              <div className="space-y-4">
                {/* Type Selection */}
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!newRequirement.is_stock_item}
                        onChange={() => setNewRequirement({ ...newRequirement, is_stock_item: false })}
                      />
                      <span className={`text-sm ${PAGE_STYLES.panel.text}`}>Order</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!!newRequirement.is_stock_item}
                        onChange={() => setNewRequirement({ ...newRequirement, is_stock_item: true, order_id: undefined })}
                      />
                      <span className={`text-sm ${PAGE_STYLES.panel.text}`}>Stock</span>
                    </label>
                  </div>
                </div>

                {/* Order ID (if not stock) */}
                {!newRequirement.is_stock_item && (
                  <div>
                    <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>Order ID</label>
                    <input
                      type="number"
                      value={newRequirement.order_id || ''}
                      onChange={(e) => setNewRequirement({ ...newRequirement, order_id: Number(e.target.value) || undefined })}
                      className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md`}
                      placeholder="Enter order ID"
                    />
                  </div>
                )}

                {/* Custom Product Type */}
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>Product Type</label>
                  <input
                    type="text"
                    value={newRequirement.custom_product_type || ''}
                    onChange={(e) => setNewRequirement({ ...newRequirement, custom_product_type: e.target.value })}
                    className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md`}
                    placeholder="e.g., LED Strip, Vinyl, Power Supply"
                  />
                </div>

                {/* Size Description */}
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>Size/Description</label>
                  <input
                    type="text"
                    value={newRequirement.size_description || ''}
                    onChange={(e) => setNewRequirement({ ...newRequirement, size_description: e.target.value })}
                    className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md`}
                    placeholder="e.g., 24 inch width, 5m roll"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newRequirement.quantity_ordered || ''}
                    onChange={(e) => setNewRequirement({ ...newRequirement, quantity_ordered: Number(e.target.value) })}
                    className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md`}
                    placeholder="Enter quantity"
                  />
                </div>

                {/* Delivery Method */}
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>Delivery Method</label>
                  <select
                    value={newRequirement.delivery_method || 'shipping'}
                    onChange={(e) => setNewRequirement({ ...newRequirement, delivery_method: e.target.value as any })}
                    className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md`}
                  >
                    {DELIVERY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>Notes</label>
                  <textarea
                    value={newRequirement.notes || ''}
                    onChange={(e) => setNewRequirement({ ...newRequirement, notes: e.target.value })}
                    className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md`}
                    rows={2}
                    placeholder="Optional notes"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowAddModal(false); setNewRequirement({ quantity_ordered: 0, delivery_method: 'shipping' }); }}
                  className={`px-4 py-2 ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.header.background} rounded hover:opacity-80`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllOrdersMaterialRequirements;
