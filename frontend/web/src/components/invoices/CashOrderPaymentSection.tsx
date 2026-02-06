import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Calendar, CreditCard, ShoppingBag, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { paymentsApi, OpenCashOrder, MultiCashPaymentInput } from '../../services/api';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { getTodayString, formatDateWithYear } from '../../utils/dateUtils';
import { formatCurrency, CASH_PAYMENT_METHODS } from './paymentUtils';

interface CashOrderPaymentSectionProps {
  customerId: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  in_production: 'In Production',
  shipped: 'Shipped',
  awaiting_payment: 'Awaiting Payment',
};

export const CashOrderPaymentSection: React.FC<CashOrderPaymentSectionProps> = ({ customerId }) => {
  const [openOrders, setOpenOrders] = useState<OpenCashOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [allocations, setAllocations] = useState<Map<number, string>>(new Map());

  const [paymentDate, setPaymentDate] = useState(getTodayString());
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [memo, setMemo] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ totalAmount: number; ordersUpdated: number; autoCompletedOrders: number[] } | null>(null);

  const loadOpenOrders = useCallback(async () => {
    setLoadingOrders(true);
    setOrderError(null);
    setOpenOrders([]);
    setAllocations(new Map());
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      const orders = await paymentsApi.getOpenCashOrders(customerId);
      setOpenOrders(orders || []);
    } catch (error: any) {
      console.error('Error fetching open cash orders:', error);
      setOrderError(error.response?.data?.message || error.message || 'Failed to fetch cash orders');
    } finally {
      setLoadingOrders(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadOpenOrders();
  }, [loadOpenOrders]);

  const handleAllocationChange = (orderId: number, value: string) => {
    const newAllocations = new Map(allocations);
    if (value === '' || value === '0') {
      newAllocations.delete(orderId);
    } else {
      newAllocations.set(orderId, value);
    }
    setAllocations(newAllocations);
  };

  const handleApplyFullBalance = (order: OpenCashOrder) => {
    const newAllocations = new Map(allocations);
    newAllocations.set(order.order_id, order.balance.toFixed(2));
    setAllocations(newAllocations);
  };

  const handleApplyAllBalances = () => {
    const newAllocations = new Map<number, string>();
    openOrders.forEach(order => {
      newAllocations.set(order.order_id, order.balance.toFixed(2));
    });
    setAllocations(newAllocations);
  };

  const handleClearAllocations = () => {
    setAllocations(new Map());
  };

  const totalPaymentAmount = Array.from(allocations.values()).reduce((sum, val) => {
    const num = parseFloat(val);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const handleSubmitPayment = async () => {
    if (allocations.size === 0 || !paymentMethod) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const input: MultiCashPaymentInput = {
        allocations: Array.from(allocations.entries()).map(([order_id, amount]) => ({
          order_id,
          amount: parseFloat(amount)
        })),
        payment_method: paymentMethod as 'cash' | 'e_transfer' | 'check',
        payment_date: paymentDate,
        reference_number: referenceNumber || undefined,
        memo: memo || undefined
      };

      const result = await paymentsApi.recordCashPayment(input);
      setSubmitSuccess(result);

      setAllocations(new Map());
      setPaymentMethod('');
      setReferenceNumber('');
      setMemo('');

      loadOpenOrders();
    } catch (error: any) {
      console.error('Error recording cash payment:', error);
      setSubmitError(error.response?.data?.message || error.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingOrders) {
    return (
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border p-12 text-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-4" />
        <p className={PAGE_STYLES.panel.textMuted}>Loading cash orders...</p>
      </div>
    );
  }

  if (orderError) {
    return (
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border p-8 text-center`}>
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 font-medium text-sm">Error Loading Cash Orders</p>
        <p className={`${PAGE_STYLES.panel.textMuted} mt-1 text-xs`}>{orderError}</p>
      </div>
    );
  }

  if (openOrders.length === 0) {
    return (
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border p-8 text-center`}>
        <CheckCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-amber-600 font-medium text-sm">No Open Cash Orders</p>
        <p className={`${PAGE_STYLES.panel.textMuted} mt-1 text-xs`}>This customer has no unpaid cash orders</p>
      </div>
    );
  }

  return (
    <>
      {submitSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-green-800">Cash Payment Recorded!</p>
            <p className="text-green-700">
              {formatCurrency(submitSuccess.totalAmount)} applied to {submitSuccess.ordersUpdated} order(s)
            </p>
            {submitSuccess.autoCompletedOrders.length > 0 && (
              <p className="text-green-600 text-xs mt-1">
                Auto-completed: Order(s) #{submitSuccess.autoCompletedOrders.join(', #')}
              </p>
            )}
          </div>
        </div>
      )}

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-red-800">Payment Failed</p>
            <p className="text-red-700">{submitError}</p>
          </div>
        </div>
      )}

      {/* Cash Orders Table */}
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border mb-3`}>
        <div className={`p-3 ${PAGE_STYLES.panel.border} border-b flex items-center justify-between`}>
          <div className="flex items-center">
            <ShoppingBag className="w-4 h-4 text-amber-600 mr-2" />
            <h3 className={`text-sm font-semibold ${PAGE_STYLES.panel.text}`}>Cash Orders</h3>
            <span className={`ml-2 text-xs ${PAGE_STYLES.panel.textMuted}`}>({openOrders.length})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleApplyAllBalances} className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors">
              Apply All
            </button>
            <button onClick={handleClearAllocations} className={`px-2 py-1 text-xs ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} rounded hover:bg-gray-500 transition-colors`}>
              Clear
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={PAGE_STYLES.header.background}>
              <tr>
                <th className={`px-3 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Order #</th>
                <th className={`px-3 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Name</th>
                <th className={`px-3 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Status</th>
                <th className={`px-3 py-2 text-right text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Total</th>
                <th className={`px-3 py-2 text-right text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Balance</th>
                <th className={`px-3 py-2 text-right text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Apply</th>
              </tr>
            </thead>
            <tbody className={PAGE_STYLES.panel.divider}>
              {openOrders.map((order) => {
                const allocationValue = allocations.get(order.order_id) || '';
                const isOverBalance = parseFloat(allocationValue) > order.balance;

                return (
                  <tr key={order.order_id} className="hover:bg-[var(--theme-hover-bg)]">
                    <td className={`px-3 py-2 text-sm font-medium ${PAGE_STYLES.panel.text}`}>#{order.order_number}</td>
                    <td className={`px-3 py-2 text-xs ${PAGE_STYLES.panel.textSecondary} max-w-[120px] truncate`} title={order.order_name}>{order.order_name || '-'}</td>
                    <td className={`px-3 py-2 text-xs ${PAGE_STYLES.panel.textSecondary}`}>{STATUS_LABELS[order.status] || order.status}</td>
                    <td className={`px-3 py-2 text-xs ${PAGE_STYLES.panel.textSecondary} text-right`}>{formatCurrency(order.total)}</td>
                    <td className="px-3 py-2 text-xs font-medium text-right text-red-600">{formatCurrency(order.balance)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)] text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={order.balance}
                            value={allocationValue}
                            onChange={(e) => handleAllocationChange(order.order_id, e.target.value)}
                            className={`w-24 pl-5 pr-1 py-1 text-right border rounded text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent ${PAGE_STYLES.input.placeholder} ${
                              isOverBalance ? 'border-red-300 bg-red-50' : `${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border}`
                            }`}
                            placeholder="0.00"
                          />
                        </div>
                        <button
                          onClick={() => handleApplyFullBalance(order)}
                          className={`px-1.5 py-1 text-xs ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textSecondary} rounded hover:bg-gray-500 transition-colors`}
                          title="Apply full balance"
                        >
                          Full
                        </button>
                      </div>
                      {isOverBalance && <p className="text-xs text-red-600 mt-0.5">Exceeds balance</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={`${PAGE_STYLES.header.background} border-t ${PAGE_STYLES.panel.border}`}>
                <td colSpan={3} className={`px-3 py-2 text-xs font-semibold ${PAGE_STYLES.panel.text} text-right`}>
                  Total:
                </td>
                <td className={`px-3 py-2 text-xs ${PAGE_STYLES.panel.textSecondary} text-right`}>
                  {formatCurrency(openOrders.reduce((sum, o) => sum + o.total, 0))}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-right text-red-600">
                  {formatCurrency(openOrders.reduce((sum, o) => sum + o.balance, 0))}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Payment Form */}
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border p-3`}>
        <div className="flex items-center mb-3">
          <CreditCard className="w-4 h-4 text-amber-600 mr-2" />
          <h3 className={`text-sm font-semibold ${PAGE_STYLES.panel.text}`}>Cash Payment Details</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Payment Date *</label>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--theme-text-muted)]" />
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={`w-full pl-8 pr-2 py-1.5 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-xs ${PAGE_STYLES.input.text}`}
              />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={`w-full px-2 py-1.5 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-xs ${PAGE_STYLES.input.text}`}
            >
              <option value="">Select...</option>
              {CASH_PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Reference #</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Check #, Trans ID..."
              className={`w-full px-2 py-1.5 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-xs ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Memo</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Optional note"
              className={`w-full px-2 py-1.5 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-xs ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}`}
            />
          </div>
        </div>

        <div className={`flex items-center justify-between pt-3 ${PAGE_STYLES.panel.border} border-t`}>
          <div className="text-sm">
            <span className={PAGE_STYLES.panel.textSecondary}>Total: </span>
            <span className="font-bold text-amber-600">{formatCurrency(totalPaymentAmount)}</span>
            {allocations.size > 0 && (
              <span className={`text-xs ${PAGE_STYLES.panel.textMuted} ml-1`}>({allocations.size} order{allocations.size !== 1 ? 's' : ''})</span>
            )}
          </div>
          <button
            onClick={handleSubmitPayment}
            disabled={submitting || allocations.size === 0 || totalPaymentAmount <= 0 || !paymentMethod}
            className={`px-4 py-1.5 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors ${
              submitting || allocations.size === 0 || totalPaymentAmount <= 0 || !paymentMethod
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <DollarSign className="w-3.5 h-3.5" />
                Record Cash Payment
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default CashOrderPaymentSection;
