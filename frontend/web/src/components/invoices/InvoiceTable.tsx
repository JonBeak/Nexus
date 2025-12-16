import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronUp, ChevronDown, Loader2, Check, Mail, MailX, Clock } from 'lucide-react';
import { InvoiceListingOrder, InvoiceFilters, invoicesApi } from '../../services/api/invoicesApi';

interface Props {
  orders: InvoiceListingOrder[];
  loading: boolean;
  filters: InvoiceFilters;
  onFiltersChange: (filters: InvoiceFilters) => void;
  onRefresh: () => void;
}

export const InvoiceTable: React.FC<Props> = ({
  orders,
  loading,
  filters,
  onFiltersChange,
  onRefresh
}) => {
  const navigate = useNavigate();
  const [syncingOrderIds, setSyncingOrderIds] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSort = (column: InvoiceFilters['sortBy']) => {
    if (filters.sortBy === column) {
      onFiltersChange({
        ...filters,
        sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc'
      });
    } else {
      onFiltersChange({
        ...filters,
        sortBy: column,
        sortOrder: 'desc'
      });
    }
  };

  const handleSyncBalance = async (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncingOrderIds(prev => new Set(prev).add(orderId));
    try {
      await invoicesApi.syncBalance(orderId);
      onRefresh();
    } catch (error) {
      console.error('Failed to sync balance:', error);
    } finally {
      setSyncingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const invoicedOrderIds = orders
        .filter(o => o.qb_invoice_id)
        .map(o => o.order_id);
      if (invoicedOrderIds.length > 0) {
        await invoicesApi.syncBalancesBatch(invoicedOrderIds);
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to sync balances:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleRowClick = (orderNumber: number) => {
    navigate(`/orders/${orderNumber}`);
  };

  const SortIcon = ({ column }: { column: InvoiceFilters['sortBy'] }) => {
    if (filters.sortBy !== column) return null;
    return filters.sortOrder === 'asc'
      ? <ChevronUp className="w-4 h-4" />
      : <ChevronDown className="w-4 h-4" />;
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      job_details_setup: 'bg-gray-100 text-gray-800',
      pending_confirmation: 'bg-yellow-100 text-yellow-800',
      production_queue: 'bg-blue-100 text-blue-800',
      in_production: 'bg-indigo-100 text-indigo-800',
      qc_packing: 'bg-purple-100 text-purple-800',
      shipping: 'bg-cyan-100 text-cyan-800',
      pick_up: 'bg-teal-100 text-teal-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      on_hold: 'bg-orange-100 text-orange-800',
      overdue: 'bg-red-100 text-red-800'
    };

    const displayName = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {displayName}
      </span>
    );
  };

  const getDepositBadge = (order: InvoiceListingOrder) => {
    if (!order.deposit_required) {
      return <span className="text-gray-400 text-xs">N/A</span>;
    }
    if (order.deposit_paid) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Paid</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">Required</span>;
  };

  const getSentIcon = (sentAt: string | null) => {
    if (sentAt) {
      return (
        <div className="flex items-center text-green-600" title={`Sent ${formatDate(sentAt)}`}>
          <Mail className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="text-gray-400" title="Not sent">
        <MailX className="w-4 h-4" />
      </div>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="text-sm text-gray-600">
          {orders.length} orders
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync All Balances
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('order_number')}
              >
                <div className="flex items-center gap-1">
                  Order # <SortIcon column="order_number" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('customer_name')}
              >
                <div className="flex items-center gap-1">
                  Customer <SortIcon column="customer_name" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('invoice_number')}
              >
                <div className="flex items-center gap-1">
                  Invoice # <SortIcon column="invoice_number" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('total')}
              >
                <div className="flex items-center justify-end gap-1">
                  Total <SortIcon column="total" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('balance')}
              >
                <div className="flex items-center justify-end gap-1">
                  Balance <SortIcon column="balance" />
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sent
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deposit
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                Sync
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map(order => {
              const total = order.cached_invoice_total ?? order.calculated_total;
              const isSyncing = syncingOrderIds.has(order.order_id);

              return (
                <tr
                  key={order.order_id}
                  onClick={() => handleRowClick(order.order_number)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm font-medium text-indigo-600">
                    #{order.order_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {order.customer_name}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {order.qb_invoice_doc_number || (
                      <span className="text-gray-400">Not Invoiced</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                    {formatCurrency(total)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {order.cached_balance !== null ? (
                      <span className={order.cached_balance === 0 ? 'text-green-600' : 'text-red-600'}>
                        {order.cached_balance === 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            <Check className="w-4 h-4" /> Paid
                          </span>
                        ) : (
                          formatCurrency(order.cached_balance)
                        )}
                      </span>
                    ) : order.qb_invoice_id ? (
                      <span className="text-gray-400 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getSentIcon(order.invoice_sent_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getDepositBadge(order)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {order.qb_invoice_id && (
                      <button
                        onClick={(e) => handleSyncBalance(order.order_id, e)}
                        disabled={isSyncing}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                        title="Sync balance from QuickBooks"
                      >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {orders.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          No orders found matching your filters
        </div>
      )}
    </div>
  );
};

export default InvoiceTable;
