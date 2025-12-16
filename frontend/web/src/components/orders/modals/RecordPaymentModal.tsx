/**
 * Record Payment Modal
 * Phase 2.e: QuickBooks Invoice Automation
 *
 * Modal for recording payments against an invoice:
 * - Shows invoice total and current balance (fetched from QB)
 * - Amount input with "Pay Full Balance" button
 * - Payment date, method, reference, and notes
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, CreditCard, Check, AlertCircle } from 'lucide-react';
import { qbInvoiceApi, InvoiceDetails, PaymentResult } from '../../../services/api/orders/qbInvoiceApi';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  onSuccess: (newBalance: number) => void;
}

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Check', label: 'Check' },
  { value: 'Credit Card', label: 'Credit Card' },
  { value: 'E-Transfer', label: 'E-Transfer' },
  { value: 'Wire', label: 'Wire Transfer' },
];

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  onSuccess
}) => {
  // Invoice data
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Check');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [memo, setMemo] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ newBalance: number } | null>(null);

  // Fetch invoice details on open
  useEffect(() => {
    if (isOpen) {
      fetchInvoiceDetails();
      resetForm();
    }
  }, [isOpen, orderNumber]);

  const fetchInvoiceDetails = async () => {
    try {
      setLoadingInvoice(true);
      setInvoiceError(null);
      const details = await qbInvoiceApi.getInvoice(orderNumber);
      setInvoiceDetails(details);
      // Set default amount to full balance
      setAmount(details.balance.toFixed(2));
    } catch (err) {
      console.error('Failed to fetch invoice details:', err);
      setInvoiceError('Failed to load invoice details');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Check');
    setReferenceNumber('');
    setMemo('');
    setError(null);
    setSuccess(null);
  };

  const handlePayFullBalance = () => {
    if (invoiceDetails) {
      setAmount(invoiceDetails.balance.toFixed(2));
    }
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    if (invoiceDetails && amountNum > invoiceDetails.balance) {
      setError('Payment amount cannot exceed the current balance');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const result = await qbInvoiceApi.recordPayment(orderNumber, {
        amount: amountNum,
        paymentDate,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        memo: memo || undefined
      });

      setSuccess({ newBalance: result.newBalance });
      setInvoiceDetails(prev => prev ? { ...prev, balance: result.newBalance } : null);

      // If balance is 0, close modal after showing success
      if (result.newBalance === 0) {
        setTimeout(() => {
          onSuccess(result.newBalance);
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to record payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordAnother = () => {
    setSuccess(null);
    setAmount(invoiceDetails?.balance.toFixed(2) || '');
    setReferenceNumber('');
    setMemo('');
  };

  const handleDone = () => {
    if (success) {
      onSuccess(success.newBalance);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-6 h-6 text-green-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
                <p className="text-sm text-gray-600">Order #{orderNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Invoice Summary */}
          {loadingInvoice ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading invoice details...</span>
            </div>
          ) : invoiceError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{invoiceError}</span>
            </div>
          ) : invoiceDetails ? (
            <>
              {/* Invoice Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Invoice #:</span>
                    <span className="ml-2 font-medium">{invoiceDetails.docNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Customer:</span>
                    <span className="ml-2 font-medium">{invoiceDetails.customerName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total:</span>
                    <span className="ml-2 font-semibold">${invoiceDetails.total.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Balance:</span>
                    <span className={`ml-2 font-semibold ${
                      invoiceDetails.balance === 0 ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      ${invoiceDetails.balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Success Message */}
              {success ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Check className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Payment recorded successfully!</p>
                      <p className="text-sm text-green-700">
                        New balance: ${success.newBalance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Amount
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={invoiceDetails.balance}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="0.00"
                        />
                      </div>
                      <button
                        onClick={handlePayFullBalance}
                        className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium whitespace-nowrap"
                      >
                        Pay Full Balance
                      </button>
                    </div>
                  </div>

                  {/* Payment Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <CreditCard className="w-4 h-4 inline-block mr-1" />
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reference Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reference Number <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Check #, Transaction ID, etc."
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                      placeholder="Add any notes about this payment..."
                    />
                  </div>
                </>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>

          {success ? (
            <div className="flex gap-3">
              {invoiceDetails && invoiceDetails.balance > 0 && (
                <button
                  onClick={handleRecordAnother}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Record Another
                </button>
              )}
              <button
                onClick={handleDone}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !amount || loadingInvoice}
              className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
                submitting || !amount || loadingInvoice
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
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
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordPaymentModal;
