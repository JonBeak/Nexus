/**
 * Supplier Orders List
 * Displays all supplier orders with filtering and status management
 * Created: 2026-02-02
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Package,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  Eye,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { supplierOrdersApi } from '../../services/api';
import type { SupplierOrder, SupplierOrderStatus, SupplierOrderSearchParams } from '../../types/supplierOrders';

interface SupplierOrdersListProps {
  showNotification: (message: string, type?: 'success' | 'error') => void;
  onViewOrder?: (orderId: number) => void;
}

const STATUS_OPTIONS: { value: SupplierOrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'partial_received', label: 'Partial' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const SupplierOrdersList: React.FC<SupplierOrdersListProps> = ({
  showNotification,
  onViewOrder,
}) => {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SupplierOrderStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params: SupplierOrderSearchParams = {};

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }

      const data = await supplierOrdersApi.getOrders(params);
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      showNotification('Failed to load supplier orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, showNotification]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const getStatusBadge = (status: SupplierOrderStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Draft
          </span>
        );
      case 'submitted':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Submitted
          </span>
        );
      case 'acknowledged':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-cyan-100 text-cyan-800 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Acknowledged
          </span>
        );
      case 'partial_received':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 flex items-center gap-1">
            <Package className="w-3 h-3" />
            Partial
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1">
            <Truck className="w-3 h-3" />
            Delivered
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const thClass = `px-4 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`;

  if (loading && orders.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        <p className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>Loading orders...</p>
      </div>
    );
  }

  return (
    <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b flex items-center justify-between ${PAGE_STYLES.header.background}`}>
        <div>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Supplier Orders</h3>
          <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            {orders.length} orders
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-9 pr-3 py-1.5 text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md focus:ring-purple-500 focus:border-purple-500 w-48`}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SupplierOrderStatus | 'all')}
            className={`text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md px-2 py-1.5`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={() => void loadOrders()}
            className={`p-1.5 rounded-md ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border}`}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
            <tr>
              <th className={thClass}>Order #</th>
              <th className={thClass}>Supplier</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Order Date</th>
              <th className={thClass}>Expected</th>
              <th className={`${thClass} text-center`}>Items</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={`${thClass} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className={PAGE_STYLES.panel.divider}>
            {orders.map((order) => (
              <tr key={order.order_id} className="hover:bg-[var(--theme-hover-bg)]">
                <td className={`px-4 py-3 text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                  {order.order_number}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.text}`}>
                  {order.supplier_name || '-'}
                </td>
                <td className="px-4 py-3">
                  {getStatusBadge(order.status)}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {formatDate(order.order_date)}
                </td>
                <td className={`px-4 py-3 text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                  {formatDate(order.expected_delivery_date)}
                </td>
                <td className={`px-4 py-3 text-sm text-center ${PAGE_STYLES.panel.text}`}>
                  {order.item_count || 0}
                  {order.items_received_count !== undefined && order.item_count !== undefined && order.items_received_count > 0 && (
                    <span className="text-green-600 ml-1">
                      ({order.items_received_count}/{order.item_count})
                    </span>
                  )}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${PAGE_STYLES.panel.text}`}>
                  {formatCurrency(order.total_amount)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onViewOrder?.(order.order_id)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1 ml-auto"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orders.length === 0 && !loading && (
        <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">No supplier orders found</p>
          <p className="text-sm">Generate an order from pending requirements to get started</p>
        </div>
      )}
    </div>
  );
};

export default SupplierOrdersList;
