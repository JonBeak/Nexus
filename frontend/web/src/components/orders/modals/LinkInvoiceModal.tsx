/**
 * Link Invoice Modal
 * Phase 2.e: QuickBooks Invoice Automation
 *
 * Modal for linking an existing QuickBooks invoice to an order:
 * - Shows list of customer's QB invoices (open first, then closed)
 * - Supports pagination (10 per page)
 * - Allows search by Invoice # or QB ID as alternative
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, Link, Search, FileText, AlertCircle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { qbInvoiceApi, CustomerInvoiceListItem, CustomerInvoiceListResult } from '../../../services/api/orders/qbInvoiceApi';

interface LinkInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  onSuccess: () => void;
}

type ViewMode = 'list' | 'search';

export const LinkInvoiceModal: React.FC<LinkInvoiceModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  onSuccess
}) => {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // List state
  const [invoiceList, setInvoiceList] = useState<CustomerInvoiceListResult | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected invoice
  const [selectedInvoice, setSelectedInvoice] = useState<CustomerInvoiceListItem | null>(null);

  // Search state
  const [searchValue, setSearchValue] = useState('');
  const [searchType, setSearchType] = useState<'id' | 'docNumber'>('docNumber');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<CustomerInvoiceListItem | null>(null);

  // Link state
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const PAGE_SIZE = 10;

  // Load customer invoices
  const loadInvoices = async (page: number = 1) => {
    try {
      setLoadingList(true);
      setListError(null);
      const result = await qbInvoiceApi.listCustomerInvoices(orderNumber, page, PAGE_SIZE);
      setInvoiceList(result);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load customer invoices:', err);
      setListError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoadingList(false);
    }
  };

  // Load invoices when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      loadInvoices(1);
    }
  }, [isOpen, orderNumber]);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setSearchError('Please enter an invoice number or ID');
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      setSearchResult(null);

      const result = await qbInvoiceApi.searchInvoice(searchValue.trim(), searchType);

      if (!result.found) {
        setSearchError('Invoice not found. Please check the number/ID and try again.');
        return;
      }

      if (result.alreadyLinked) {
        setSearchError(`Invoice already linked to Order #${result.linkedOrderNumber}`);
        return;
      }

      setSearchResult({
        invoiceId: result.invoiceId!,
        docNumber: result.docNumber!,
        customerName: result.customerName,
        total: result.total!,
        balance: result.balance!,
        txnDate: result.txnDate,
        isOpen: result.balance! > 0
      });
    } catch (err) {
      console.error('Failed to search invoice:', err);
      setSearchError(err instanceof Error ? err.message : 'Failed to search invoice');
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async () => {
    const invoice = viewMode === 'list' ? selectedInvoice : searchResult;
    if (!invoice) return;

    try {
      setLinking(true);
      setLinkError(null);

      await qbInvoiceApi.linkInvoice(orderNumber, { qbInvoiceId: invoice.invoiceId });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Failed to link invoice:', err);
      setLinkError(err instanceof Error ? err.message : 'Failed to link invoice');
    } finally {
      setLinking(false);
    }
  };

  const resetForm = () => {
    setViewMode('list');
    setInvoiceList(null);
    setCurrentPage(1);
    setSelectedInvoice(null);
    setSearchValue('');
    setSearchResult(null);
    setSearchError(null);
    setListError(null);
    setLinkError(null);
    setSuccess(false);
  };

  if (!isOpen) return null;

  const activeInvoice = viewMode === 'list' ? selectedInvoice : searchResult;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Link className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Link Existing Invoice</h2>
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
        <div className="p-6 flex-1 overflow-auto">
          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="font-medium text-green-800">Invoice linked successfully!</p>
              <p className="text-sm text-green-700 mt-1">
                This order is now connected to the QuickBooks invoice.
              </p>
            </div>
          ) : (
            <>
              {/* View Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setViewMode('list'); setSearchResult(null); setSearchError(null); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  Customer Invoices
                </button>
                <button
                  onClick={() => { setViewMode('search'); setSelectedInvoice(null); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'search'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  Search by #
                </button>
              </div>

              {viewMode === 'list' ? (
                /* Invoice List View */
                <div className="space-y-4">
                  {loadingList ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                      <span className="text-gray-600">Loading invoices...</span>
                    </div>
                  ) : listError ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {listError}
                    </div>
                  ) : invoiceList && invoiceList.invoices.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No available invoices found for this customer.</p>
                      <p className="text-sm mt-1">Try searching by invoice number instead.</p>
                    </div>
                  ) : invoiceList ? (
                    <>
                      {/* Invoice List */}
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {invoiceList.invoices.map((invoice) => (
                          <button
                            key={invoice.invoiceId}
                            onClick={() => setSelectedInvoice(
                              selectedInvoice?.invoiceId === invoice.invoiceId ? null : invoice
                            )}
                            className={`w-full p-3 rounded-lg border text-left transition-colors ${
                              selectedInvoice?.invoiceId === invoice.invoiceId
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">
                                    #{invoice.docNumber}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    invoice.isOpen
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {invoice.isOpen ? 'Open' : 'Paid'}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {invoice.txnDate}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-gray-900">
                                  ${invoice.total.toFixed(2)}
                                </div>
                                {invoice.isOpen && (
                                  <div className="text-xs text-orange-600">
                                    Bal: ${invoice.balance.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Pagination */}
                      {invoiceList.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                          <button
                            onClick={() => loadInvoices(currentPage - 1)}
                            disabled={currentPage === 1 || loadingList}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                              currentPage === 1 || loadingList
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                          </button>
                          <span className="text-sm text-gray-600">
                            Page {currentPage} of {invoiceList.totalPages}
                          </span>
                          <button
                            onClick={() => loadInvoices(currentPage + 1)}
                            disabled={currentPage === invoiceList.totalPages || loadingList}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                              currentPage === invoiceList.totalPages || loadingList
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            Next
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Total count */}
                      <div className="text-xs text-gray-500 text-center">
                        {invoiceList.totalCount} invoice{invoiceList.totalCount !== 1 ? 's' : ''} available
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                /* Search View */
                <div className="space-y-4">
                  {/* Search Type Toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSearchType('docNumber'); setSearchResult(null); setSearchError(null); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                        searchType === 'docNumber'
                          ? 'bg-gray-200 text-gray-800'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                      }`}
                    >
                      Invoice #
                    </button>
                    <button
                      onClick={() => { setSearchType('id'); setSearchResult(null); setSearchError(null); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                        searchType === 'id'
                          ? 'bg-gray-200 text-gray-800'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                      }`}
                    >
                      QB Invoice ID
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder={searchType === 'docNumber' ? 'e.g., 1234' : 'e.g., 12345'}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch();
                      }}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching || !searchValue.trim()}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        searching || !searchValue.trim()
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {searching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Search Error */}
                  {searchError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {searchError}
                    </div>
                  )}

                  {/* Search Result */}
                  {searchResult && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-800">Invoice Found</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invoice #:</span>
                          <span className="font-medium">{searchResult.docNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">${searchResult.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Balance:</span>
                          <span className={`font-medium ${
                            searchResult.balance === 0 ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            ${searchResult.balance.toFixed(2)}
                          </span>
                        </div>
                        {searchResult.txnDate && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Date:</span>
                            <span>{searchResult.txnDate}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Link Error */}
              {linkError && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {linkError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            {success ? 'Close' : 'Cancel'}
          </button>

          {!success && activeInvoice && (
            <button
              onClick={handleLink}
              disabled={linking}
              className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
                linking
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {linking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  Link #{activeInvoice.docNumber}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkInvoiceModal;
