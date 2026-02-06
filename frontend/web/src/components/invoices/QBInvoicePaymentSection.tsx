import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Calendar, CreditCard, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { paymentsApi, OpenInvoice, MultiPaymentInput } from '../../services/api';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { getTodayString, formatDateWithYear } from '../../utils/dateUtils';
import { formatCurrency, QB_PAYMENT_METHODS } from './paymentUtils';

interface QBInvoicePaymentSectionProps {
  customerId: number;
}

export const QBInvoicePaymentSection: React.FC<QBInvoicePaymentSectionProps> = ({ customerId }) => {
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [qbCustomerId, setQbCustomerId] = useState<string | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [allocations, setAllocations] = useState<Map<string, string>>(new Map());

  const [paymentDate, setPaymentDate] = useState(getTodayString());
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [memo, setMemo] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ paymentId: string; totalAmount: number; invoicesUpdated: number } | null>(null);

  const loadOpenInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    setInvoiceError(null);
    setOpenInvoices([]);
    setQbCustomerId(null);
    setAllocations(new Map());
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      const response = await paymentsApi.getOpenInvoices(customerId);
      setOpenInvoices(response.invoices);
      setQbCustomerId(response.qbCustomerId);
    } catch (error: any) {
      console.error('Error fetching open invoices:', error);
      setInvoiceError(error.response?.data?.message || error.message || 'Failed to fetch open invoices');
    } finally {
      setLoadingInvoices(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadOpenInvoices();
  }, [loadOpenInvoices]);

  const handleAllocationChange = (invoiceId: string, value: string) => {
    const newAllocations = new Map(allocations);
    if (value === '' || value === '0') {
      newAllocations.delete(invoiceId);
    } else {
      newAllocations.set(invoiceId, value);
    }
    setAllocations(newAllocations);
  };

  const handleApplyFullBalance = (invoice: OpenInvoice) => {
    const newAllocations = new Map(allocations);
    newAllocations.set(invoice.invoiceId, invoice.balance.toFixed(2));
    setAllocations(newAllocations);
  };

  const handleApplyAllBalances = () => {
    const newAllocations = new Map<string, string>();
    openInvoices.forEach(inv => {
      newAllocations.set(inv.invoiceId, inv.balance.toFixed(2));
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
    if (!qbCustomerId || allocations.size === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const input: MultiPaymentInput = {
        qbCustomerId,
        allocations: Array.from(allocations.entries()).map(([invoiceId, amount]) => ({
          invoiceId,
          amount: parseFloat(amount)
        })),
        paymentDate,
        paymentMethod: paymentMethod || undefined,
        referenceNumber: referenceNumber || undefined,
        memo: memo || undefined
      };

      const result = await paymentsApi.recordPayment(input);
      setSubmitSuccess(result);

      setAllocations(new Map());
      setPaymentMethod('');
      setReferenceNumber('');
      setMemo('');

      loadOpenInvoices();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      setSubmitError(error.response?.data?.message || error.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvoices) {
    return (
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border p-12 text-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
        <p className={PAGE_STYLES.panel.textMuted}>Loading QB invoices...</p>
      </div>
    );
  }

  if (invoiceError) {
    return (
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border p-8 text-center`}>
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 font-medium text-sm">Error Loading Invoices</p>
        <p className={`${PAGE_STYLES.panel.textMuted} mt-1 text-xs`}>{invoiceError}</p>
      </div>
    );
  }

  if (openInvoices.length === 0) {
    return (
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border p-8 text-center`}>
        <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <p className="text-green-600 font-medium text-sm">No Open QB Invoices</p>
        <p className={`${PAGE_STYLES.panel.textMuted} mt-1 text-xs`}>This customer has no unpaid QB invoices</p>
      </div>
    );
  }

  return (
    <>
      {submitSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-green-800">Payment Recorded!</p>
            <p className="text-green-700">
              #{submitSuccess.paymentId} — {formatCurrency(submitSuccess.totalAmount)} applied to {submitSuccess.invoicesUpdated} invoice(s)
            </p>
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

      {/* Invoices Table */}
      <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm ${PAGE_STYLES.panel.border} border mb-3`}>
        <div className={`p-3 ${PAGE_STYLES.panel.border} border-b flex items-center justify-between`}>
          <div className="flex items-center">
            <FileText className="w-4 h-4 text-green-600 mr-2" />
            <h3 className={`text-sm font-semibold ${PAGE_STYLES.panel.text}`}>QB Invoices</h3>
            <span className={`ml-2 text-xs ${PAGE_STYLES.panel.textMuted}`}>({openInvoices.length})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleApplyAllBalances} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors">
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
                <th className={`px-3 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Invoice #</th>
                <th className={`px-3 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Date</th>
                <th className={`px-3 py-2 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Due Date</th>
                <th className={`px-3 py-2 text-right text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Total</th>
                <th className={`px-3 py-2 text-right text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Balance</th>
                <th className={`px-3 py-2 text-right text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>Apply</th>
              </tr>
            </thead>
            <tbody className={PAGE_STYLES.panel.divider}>
              {openInvoices.map((invoice) => {
                const allocationValue = allocations.get(invoice.invoiceId) || '';
                const isOverBalance = parseFloat(allocationValue) > invoice.balance;

                return (
                  <tr key={invoice.invoiceId} className="hover:bg-[var(--theme-hover-bg)]">
                    <td className={`px-3 py-2 text-sm font-medium ${PAGE_STYLES.panel.text}`}>{invoice.docNumber}</td>
                    <td className={`px-3 py-2 text-xs ${PAGE_STYLES.panel.textSecondary}`}>{formatDateWithYear(invoice.txnDate)}</td>
                    <td className={`px-3 py-2 text-xs ${PAGE_STYLES.panel.textSecondary}`}>{invoice.dueDate ? formatDateWithYear(invoice.dueDate) : '-'}</td>
                    <td className={`px-3 py-2 text-xs ${PAGE_STYLES.panel.textSecondary} text-right`}>{formatCurrency(invoice.totalAmt)}</td>
                    <td className="px-3 py-2 text-xs font-medium text-right text-red-600">{formatCurrency(invoice.balance)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)] text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={invoice.balance}
                            value={allocationValue}
                            onChange={(e) => handleAllocationChange(invoice.invoiceId, e.target.value)}
                            className={`w-24 pl-5 pr-1 py-1 text-right border rounded text-xs focus:ring-2 focus:ring-green-500 focus:border-transparent ${PAGE_STYLES.input.placeholder} ${
                              isOverBalance ? 'border-red-300 bg-red-50' : `${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border}`
                            }`}
                            placeholder="0.00"
                          />
                        </div>
                        <button
                          onClick={() => handleApplyFullBalance(invoice)}
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
                  {formatCurrency(openInvoices.reduce((sum, inv) => sum + inv.totalAmt, 0))}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-right text-red-600">
                  {formatCurrency(openInvoices.reduce((sum, inv) => sum + inv.balance, 0))}
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
          <CreditCard className="w-4 h-4 text-green-600 mr-2" />
          <h3 className={`text-sm font-semibold ${PAGE_STYLES.panel.text}`}>QB Payment Details</h3>
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
                className={`w-full pl-8 pr-2 py-1.5 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs ${PAGE_STYLES.input.text}`}
              />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={`w-full px-2 py-1.5 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs ${PAGE_STYLES.input.text}`}
            >
              <option value="">Select...</option>
              {QB_PAYMENT_METHODS.map(m => (
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
              className={`w-full px-2 py-1.5 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Memo</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Optional note"
              className={`w-full px-2 py-1.5 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}`}
            />
          </div>
        </div>

        <div className={`flex items-center justify-between pt-3 ${PAGE_STYLES.panel.border} border-t`}>
          <div className="text-sm">
            <span className={PAGE_STYLES.panel.textSecondary}>Total: </span>
            <span className="font-bold text-green-600">{formatCurrency(totalPaymentAmount)}</span>
            {allocations.size > 0 && (
              <span className={`text-xs ${PAGE_STYLES.panel.textMuted} ml-1`}>({allocations.size} inv.)</span>
            )}
          </div>
          <button
            onClick={handleSubmitPayment}
            disabled={submitting || allocations.size === 0 || totalPaymentAmount <= 0}
            className={`px-4 py-1.5 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors ${
              submitting || allocations.size === 0 || totalPaymentAmount <= 0
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
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
                Record QB Payment
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default QBInvoicePaymentSection;
