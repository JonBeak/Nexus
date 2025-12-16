import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building, DollarSign, Calendar, CreditCard, FileText, CheckCircle, AlertCircle, Loader2, X, Home } from 'lucide-react';
import { customerApi } from '../services/api';
import { paymentsApi, OpenInvoice, MultiPaymentInput } from '../services/api/paymentsApi';

interface Customer {
  customer_id: number;
  company_name: string;
  contact_name: string;
}

interface InvoiceAllocation {
  invoiceId: string;
  amount: string; // String for input handling
}

export const PaymentsPage: React.FC = () => {
  const navigate = useNavigate();

  // Customer selection state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Invoice state
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [qbCustomerId, setQbCustomerId] = useState<string | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  // Allocations state
  const [allocations, setAllocations] = useState<Map<string, string>>(new Map());

  // Payment form state
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [memo, setMemo] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ paymentId: string; totalAmount: number; invoicesUpdated: number } | null>(null);

  // Load all customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const response = await customerApi.getCustomers({
          limit: 1000,
          include_inactive: false
        });
        setCustomers(response.customers || []);
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  // Frontend filtering of customers
  const filteredCustomers = customers.filter(customer =>
    customer.company_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (customer.contact_name && customer.contact_name.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  // Load open invoices when customer is selected
  const loadOpenInvoices = useCallback(async (customerId: number) => {
    setLoadingInvoices(true);
    setInvoiceError(null);
    setOpenInvoices([]);
    setQbCustomerId(null);
    setAllocations(new Map());

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
  }, []);

  // Handle customer selection
  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSubmitSuccess(null);
    setSubmitError(null);
    loadOpenInvoices(customer.customer_id);
  };

  // Clear customer selection
  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setOpenInvoices([]);
    setQbCustomerId(null);
    setAllocations(new Map());
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  // Update allocation for an invoice
  const handleAllocationChange = (invoiceId: string, value: string) => {
    const newAllocations = new Map(allocations);
    if (value === '' || value === '0') {
      newAllocations.delete(invoiceId);
    } else {
      newAllocations.set(invoiceId, value);
    }
    setAllocations(newAllocations);
  };

  // Apply full balance to an invoice
  const handleApplyFullBalance = (invoice: OpenInvoice) => {
    const newAllocations = new Map(allocations);
    newAllocations.set(invoice.invoiceId, invoice.balance.toFixed(2));
    setAllocations(newAllocations);
  };

  // Apply full balance to all invoices
  const handleApplyAllBalances = () => {
    const newAllocations = new Map<string, string>();
    openInvoices.forEach(inv => {
      newAllocations.set(inv.invoiceId, inv.balance.toFixed(2));
    });
    setAllocations(newAllocations);
  };

  // Clear all allocations
  const handleClearAllocations = () => {
    setAllocations(new Map());
  };

  // Calculate total payment amount
  const totalPaymentAmount = Array.from(allocations.values()).reduce((sum, val) => {
    const num = parseFloat(val);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Submit payment
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

      // Clear form and reload invoices
      setAllocations(new Map());
      setPaymentMethod('');
      setReferenceNumber('');
      setMemo('');

      // Reload invoices to show updated balances
      if (selectedCustomer) {
        loadOpenInvoices(selectedCustomer.customer_id);
      }
    } catch (error: any) {
      console.error('Error recording payment:', error);
      setSubmitError(error.response?.data?.message || error.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <Home className="w-7 h-7" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-green-600" />
              Record Payment
            </h1>
            <p className="text-gray-600 mt-1">Record a payment against multiple QuickBooks invoices</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Customer Selection Panel */}
          <div className="col-span-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
              <div className="flex items-center mb-4">
                <Building className="w-5 h-5 text-purple-600 mr-2" />
                <h2 className="text-lg font-semibold">Select Customer</h2>
              </div>

              {selectedCustomer ? (
                <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-purple-900">{selectedCustomer.company_name}</div>
                      <div className="text-sm text-purple-700">{selectedCustomer.contact_name}</div>
                    </div>
                    <button
                      onClick={handleClearCustomer}
                      className="p-1 hover:bg-purple-200 rounded-full transition-colors"
                      title="Clear selection"
                    >
                      <X className="w-5 h-5 text-purple-600" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>

                  {loadingCustomers ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading customers...
                    </div>
                  ) : (
                    <div className="max-h-[calc(100vh-350px)] overflow-y-auto border rounded-lg">
                      {filteredCustomers.map((customer) => (
                        <div
                          key={customer.customer_id}
                          className="p-3 cursor-pointer hover:bg-gray-50 transition-all border-b last:border-b-0"
                          onClick={() => handleCustomerSelect(customer)}
                        >
                          <div className="text-sm font-medium">{customer.company_name}</div>
                          <div className="text-xs text-gray-500">{customer.contact_name}</div>
                        </div>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className="p-6 text-center text-gray-500 text-sm">
                          No customers found
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Invoices and Payment Form */}
          <div className="col-span-8">
            {!selectedCustomer ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a customer to view their open invoices</p>
              </div>
            ) : loadingInvoices ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                <p className="text-gray-500">Loading open invoices...</p>
              </div>
            ) : invoiceError ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-600 font-medium">Error Loading Invoices</p>
                <p className="text-gray-500 mt-2">{invoiceError}</p>
              </div>
            ) : openInvoices.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-green-600 font-medium">No Open Invoices</p>
                <p className="text-gray-500 mt-2">This customer has no unpaid invoices</p>
              </div>
            ) : (
              <>
                {/* Success Message */}
                {submitSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">Payment Recorded Successfully!</p>
                      <p className="text-sm text-green-700">
                        Payment #{submitSuccess.paymentId} for {formatCurrency(submitSuccess.totalAmount)} applied to {submitSuccess.invoicesUpdated} invoice(s)
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Failed to Record Payment</p>
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  </div>
                )}

                {/* Open Invoices Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-blue-600 mr-2" />
                      <h2 className="text-lg font-semibold">Open Invoices</h2>
                      <span className="ml-2 text-sm text-gray-500">({openInvoices.length} invoice{openInvoices.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleApplyAllBalances}
                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Apply All Balances
                      </button>
                      <button
                        onClick={handleClearAllocations}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount to Apply</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {openInvoices.map((invoice) => {
                          const allocationValue = allocations.get(invoice.invoiceId) || '';
                          const isOverBalance = parseFloat(allocationValue) > invoice.balance;

                          return (
                            <tr key={invoice.invoiceId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {invoice.docNumber}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {formatDate(invoice.txnDate)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                {formatCurrency(invoice.totalAmt)}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-right text-red-600">
                                {formatCurrency(invoice.balance)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max={invoice.balance}
                                      value={allocationValue}
                                      onChange={(e) => handleAllocationChange(invoice.invoiceId, e.target.value)}
                                      className={`w-28 pl-6 pr-2 py-1.5 text-right border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                                        isOverBalance ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                      }`}
                                      placeholder="0.00"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleApplyFullBalance(invoice)}
                                    className="px-2 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                    title="Apply full balance"
                                  >
                                    Full
                                  </button>
                                </div>
                                {isOverBalance && (
                                  <p className="text-xs text-red-600 mt-1">Exceeds balance</p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Form */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center mb-4">
                    <CreditCard className="w-5 h-5 text-green-600 mr-2" />
                    <h2 className="text-lg font-semibold">Payment Details</h2>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Date *
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      >
                        <option value="">Select method...</option>
                        <option value="1">Cash</option>
                        <option value="2">Check</option>
                        <option value="3">Credit Card</option>
                        <option value="4">E-Transfer</option>
                        <option value="5">Wire Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reference Number
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="Check #, Trans ID, etc."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Memo
                      </label>
                      <input
                        type="text"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        placeholder="Optional note"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>

                  {/* Total and Submit */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-lg">
                      <span className="text-gray-600">Total Payment: </span>
                      <span className="font-bold text-green-600">{formatCurrency(totalPaymentAmount)}</span>
                      {allocations.size > 0 && (
                        <span className="text-sm text-gray-500 ml-2">
                          ({allocations.size} invoice{allocations.size !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleSubmitPayment}
                      disabled={submitting || allocations.size === 0 || totalPaymentAmount <= 0}
                      className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                        submitting || allocations.size === 0 || totalPaymentAmount <= 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Recording Payment...
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4" />
                          Record Payment
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;
