/**
 * Cash Payment Modal
 * Created: 2025-01-27
 *
 * Modal for recording cash/e-transfer/check payments for cash job orders.
 * Shows payment history and allows recording new payments.
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, Trash2, AlertCircle, Check, Calendar } from 'lucide-react';
import { cashPaymentApi, CashPayment, CashBalanceInfo, CashPaymentMethod } from '../../../services/api';
import { useModalBackdrop } from '../../../hooks/useModalBackdrop';

interface CashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  orderNumber: number;
  onSuccess?: () => void;
}

export const CashPaymentModal: React.FC<CashPaymentModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  onSuccess
}) => {
  // Balance info state
  const [balanceInfo, setBalanceInfo] = useState<CashBalanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CashPaymentMethod>('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [memo, setMemo] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [autoCompleted, setAutoCompleted] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Modal backdrop handling (ESC key, click-outside, scroll lock)
  const {
    modalContentRef,
    handleBackdropMouseDown,
    handleBackdropMouseUp,
    isMobile
  } = useModalBackdrop({ isOpen, onClose });

  // Load balance info
  const loadBalanceInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await cashPaymentApi.getBalance(orderId);
      setBalanceInfo(info);
    } catch (err) {
      console.error('Failed to load balance info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payment info');
    } finally {
      setLoading(false);
    }
  };

  // Load on open
  useEffect(() => {
    if (isOpen) {
      resetForm();
      loadBalanceInfo();
    }
  }, [isOpen, orderId]);

  const resetForm = () => {
    setAmount('');
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber('');
    setMemo('');
    setSubmitError(null);
    setSuccess(false);
    setAutoCompleted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setSubmitError('Please enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const result = await cashPaymentApi.recordPayment(orderId, {
        amount: amountNum,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_number: referenceNumber || undefined,
        memo: memo || undefined
      });

      // Reload balance info
      await loadBalanceInfo();

      // Show success state
      setSuccess(true);
      setAutoCompleted(result.autoCompleted);

      // Reset form after delay
      setTimeout(() => {
        resetForm();
        if (result.autoCompleted) {
          onSuccess?.();
        }
      }, 2000);

    } catch (err) {
      console.error('Failed to record payment:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (paymentId: number) => {
    if (!confirm('Are you sure you want to delete this payment?')) {
      return;
    }

    try {
      setDeletingId(paymentId);
      await cashPaymentApi.deletePayment(orderId, paymentId);
      await loadBalanceInfo();
    } catch (err) {
      console.error('Failed to delete payment:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete payment');
    } finally {
      setDeletingId(null);
    }
  };

  const formatPaymentMethod = (method: CashPaymentMethod): string => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'e_transfer': return 'E-Transfer';
      case 'check': return 'Check';
      default: return method;
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile
          ? 'overflow-y-auto'
          : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className={`bg-white rounded-lg shadow-2xl flex flex-col ${
          isMobile
            ? 'w-full min-h-full'
            : 'w-[500px] max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-6 h-6 text-green-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
                <p className="text-sm text-gray-600">Order #{orderNumber} (Cash Job)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-green-600 mr-2" />
              <span className="text-gray-600">Loading payment info...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          ) : balanceInfo ? (
            <>
              {/* Balance Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Total</div>
                    <div className="text-lg font-bold text-gray-900">${balanceInfo.total.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Paid</div>
                    <div className="text-lg font-bold text-green-600">${balanceInfo.totalPaid.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Balance</div>
                    <div className={`text-lg font-bold ${balanceInfo.balance === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      ${balanceInfo.balance.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Success Message */}
              {success && (
                <div className={`mb-6 p-4 rounded-lg border ${autoCompleted ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center gap-2">
                    <Check className={`w-5 h-5 ${autoCompleted ? 'text-green-600' : 'text-blue-600'}`} />
                    <span className={`font-medium ${autoCompleted ? 'text-green-800' : 'text-blue-800'}`}>
                      {autoCompleted
                        ? 'Payment recorded! Order marked as completed.'
                        : 'Payment recorded successfully!'}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Form */}
              {balanceInfo.balance > 0 && (
                <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                  <h3 className="text-sm font-medium text-gray-700">Record New Payment</h3>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={balanceInfo.balance}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setAmount(balanceInfo.balance.toFixed(2))}
                        className="text-xs text-green-600 hover:text-green-700 mt-1"
                      >
                        Pay full balance (${balanceInfo.balance.toFixed(2)})
                      </button>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Method *
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as CashPaymentMethod)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      >
                        <option value="cash">Cash</option>
                        <option value="e_transfer">E-Transfer</option>
                        <option value="check">Check</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Payment Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date *
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Reference Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reference #
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="Check # / Transfer ID"
                      />
                    </div>
                  </div>

                  {/* Memo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Memo
                    </label>
                    <input
                      type="text"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Optional note"
                    />
                  </div>

                  {/* Submit Error */}
                  {submitError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {submitError}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting || !amount}
                    className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 ${
                      submitting || !amount
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4" />
                        Record Payment
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Paid in Full Message */}
              {balanceInfo.balance === 0 && (
                <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-center">
                  <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-800">Paid in Full</p>
                </div>
              )}

              {/* Payment History */}
              {balanceInfo.payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Payment History</h3>
                  <div className="space-y-2">
                    {balanceInfo.payments.map((payment: CashPayment) => (
                      <div
                        key={payment.payment_id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">${payment.amount.toFixed(2)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              payment.payment_method === 'cash'
                                ? 'bg-green-100 text-green-700'
                                : payment.payment_method === 'e_transfer'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                            }`}>
                              {formatPaymentMethod(payment.payment_method)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(payment.payment_date)}
                            {payment.reference_number && (
                              <span className="ml-2">• Ref: {payment.reference_number}</span>
                            )}
                          </div>
                          {payment.memo && (
                            <div className="text-xs text-gray-600 mt-1">{payment.memo}</div>
                          )}
                          {payment.created_by_name && (
                            <div className="text-xs text-gray-400 mt-1">
                              Recorded by {payment.created_by_name}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(payment.payment_id)}
                          disabled={deletingId === payment.payment_id}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete payment"
                        >
                          {deletingId === payment.payment_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
          <button
            onClick={onClose}
            className={`w-full py-2 text-gray-600 hover:text-gray-800 active:text-gray-900 rounded-lg ${
              isMobile ? 'min-h-[44px]' : ''
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashPaymentModal;
