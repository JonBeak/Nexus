/**
 * Invoice Linking Panel
 *
 * Reusable component for selecting and linking existing QuickBooks invoices.
 * Used in:
 * - InvoiceActionModal (create mode - right panel)
 * - LinkInvoiceModal/LinkDocumentModal (standalone modal for reassignment)
 *
 * Features:
 * - Customer invoices list with pagination (open first, then closed)
 * - Search by Invoice # or Transaction ID
 * - Selection highlighting
 * - Optional compact mode for embedded use
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Search, FileText, AlertCircle, Check,
  ChevronLeft, ChevronRight, Link2, Eye
} from 'lucide-react';
import { qbInvoiceApi, CustomerInvoiceListItem, CustomerInvoiceListResult } from '../../../../services/api';

/** Order totals for comparison with QB invoices */
export interface OrderTotals {
  subtotal: number;
  taxName: string;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

export interface InvoiceLinkingPanelProps {
  /** Order number to load invoices for */
  orderNumber: number;
  /** Order totals for comparison display (optional) */
  orderTotals?: OrderTotals;
  /** Called when an invoice is selected/deselected */
  onSelect: (invoice: CustomerInvoiceListItem | null) => void;
  /** Currently selected invoice */
  selectedInvoice: CustomerInvoiceListItem | null;
  /** Whether mobile layout should be used */
  isMobile?: boolean;
  /** Compact mode removes headers/padding for embedded use */
  compact?: boolean;
  /** Whether the panel is visible (controls data loading) */
  isActive?: boolean;
  /** Disable all interactions (when another action is in progress) */
  disabled?: boolean;
  /** Called when user clicks to preview/expand an invoice (desktop only) */
  onPreview?: (invoice: CustomerInvoiceListItem | null) => void;
  /** Currently previewed invoice ID (for highlighting) */
  previewInvoiceId?: string | null;
}

type ViewMode = 'list' | 'search';

export const InvoiceLinkingPanel: React.FC<InvoiceLinkingPanelProps> = ({
  orderNumber,
  orderTotals,
  onSelect,
  selectedInvoice,
  isMobile = false,
  compact = false,
  isActive = true,
  disabled = false,
  onPreview,
  previewInvoiceId,
}) => {
  // View mode (list or search)
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Warning state for selecting linked invoices
  const [pendingLinkedInvoice, setPendingLinkedInvoice] = useState<CustomerInvoiceListItem | null>(null);

  // List state
  const [invoiceList, setInvoiceList] = useState<CustomerInvoiceListResult | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Search state
  const [searchValue, setSearchValue] = useState('');
  const [searchType, setSearchType] = useState<'id' | 'docNumber'>('docNumber');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<CustomerInvoiceListItem | null>(null);

  const PAGE_SIZE = 10;

  // Load customer invoices
  const loadInvoices = useCallback(async (page: number = 1) => {
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
  }, [orderNumber]);

  // Load invoices when panel becomes active
  useEffect(() => {
    if (isActive && !invoiceList && !loadingList) {
      loadInvoices(1);
    }
  }, [isActive, invoiceList, loadingList, loadInvoices]);

  // Reset state when order changes
  useEffect(() => {
    setInvoiceList(null);
    setCurrentPage(1);
    setSearchValue('');
    setSearchResult(null);
    setSearchError(null);
    setListError(null);
    setViewMode('list');
  }, [orderNumber]);

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

      const foundInvoice: CustomerInvoiceListItem = {
        invoiceId: result.invoiceId!,
        docNumber: result.docNumber!,
        customerName: result.customerName || null,
        total: result.total!,
        balance: result.balance!,
        txnDate: result.txnDate || null,
        isOpen: result.balance! > 0
      };

      setSearchResult(foundInvoice);
      // Auto-select the found invoice
      onSelect(foundInvoice);
    } catch (err) {
      console.error('Failed to search invoice:', err);
      setSearchError(err instanceof Error ? err.message : 'Failed to search invoice');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectInvoice = (invoice: CustomerInvoiceListItem) => {
    if (disabled) return;

    if (selectedInvoice?.invoiceId === invoice.invoiceId) {
      onSelect(null);
      setPendingLinkedInvoice(null);
    } else if (invoice.linkedToOrderNumber) {
      // Invoice is linked to another order - show warning
      setPendingLinkedInvoice(invoice);
    } else {
      onSelect(invoice);
      setPendingLinkedInvoice(null);
    }
  };

  const handleConfirmLinkedInvoice = () => {
    if (pendingLinkedInvoice) {
      onSelect(pendingLinkedInvoice);
      setPendingLinkedInvoice(null);
    }
  };

  const handleCancelLinkedInvoice = () => {
    setPendingLinkedInvoice(null);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (disabled) return;
    setViewMode(mode);
    setPendingLinkedInvoice(null);
    if (mode === 'list') {
      setSearchResult(null);
      setSearchError(null);
      // If we had a search result selected, clear it
      if (selectedInvoice && searchResult?.invoiceId === selectedInvoice.invoiceId) {
        onSelect(null);
      }
    } else {
      // Clear list selection when switching to search
      if (selectedInvoice && invoiceList?.invoices.some(inv => inv.invoiceId === selectedInvoice.invoiceId)) {
        onSelect(null);
      }
    }
  };

  // Format date helper
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`flex flex-col h-full ${compact ? '' : 'p-4'}`}>
      {/* Order Totals Reference (non-compact only) */}
      {!compact && orderTotals && (
        <div className={`mb-3 px-3 py-2 border rounded-lg flex items-center justify-between ${
          orderTotals.taxPercent < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Order #{orderNumber} Totals
          </div>
          <div className="flex items-center gap-5">
            <div className="text-center">
              <div className="text-xs text-gray-500">Subtotal</div>
              <div className="text-sm font-medium text-gray-700">${orderTotals.subtotal.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className={`text-xs ${orderTotals.taxPercent < 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {orderTotals.taxPercent < 0 ? orderTotals.taxName : `${orderTotals.taxName || 'Tax'} (${orderTotals.taxPercent.toFixed(0)}%)`}
              </div>
              <div className={`text-sm font-medium ${orderTotals.taxPercent < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                {orderTotals.taxPercent < 0 ? 'ERROR' : `$${orderTotals.taxAmount.toFixed(2)}`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-sm font-bold text-gray-900">${orderTotals.total.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Warning dialog for linked invoices */}
      {pendingLinkedInvoice && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-amber-800 text-sm">
                This invoice is already linked
              </div>
              <p className="text-sm text-amber-700 mt-1">
                Invoice #{pendingLinkedInvoice.docNumber} is linked to{' '}
                <span className="font-medium">
                  Order #{pendingLinkedInvoice.linkedToOrderNumber} - {pendingLinkedInvoice.linkedToOrderName}
                </span>.
                Selecting this invoice will unlink it from that order.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCancelLinkedInvoice}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLinkedInvoice}
                  className="px-3 py-1.5 text-sm text-white bg-amber-600 rounded hover:bg-amber-700"
                >
                  Select Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        <button
          onClick={() => handleViewModeChange('list')}
          disabled={disabled}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${
            viewMode === 'list'
              ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          Customer Invoices
        </button>
        <button
          onClick={() => handleViewModeChange('search')}
          disabled={disabled}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${
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
        <div className="flex-1 flex flex-col min-h-0">
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
            <div className="flex-1 flex flex-col min-h-0">
              {/* Invoice List */}
              <div className={`space-y-2 flex-1 overflow-y-auto ${isMobile ? '' : 'min-h-0'}`}>
                {invoiceList.invoices.map((invoice) => {
                  const isLinked = !!invoice.linkedToOrderNumber;
                  const isSelected = selectedInvoice?.invoiceId === invoice.invoiceId;
                  const isPreviewing = previewInvoiceId === invoice.invoiceId;
                  return (
                    <div
                      key={invoice.invoiceId}
                      className={`flex items-stretch rounded-lg border transition-colors ${
                        disabled ? 'opacity-50' : ''
                      } ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : isPreviewing
                            ? 'border-blue-400 bg-blue-50/50'
                            : isLinked
                              ? 'border-amber-300 bg-amber-50/50'
                              : 'border-gray-200'
                      }`}
                    >
                      {/* Main clickable area for selection */}
                      <button
                        onClick={() => handleSelectInvoice(invoice)}
                        disabled={disabled}
                        className={`flex-1 text-left ${
                          isMobile ? 'p-4 min-h-[72px]' : 'p-3'
                        } ${
                          disabled ? 'cursor-not-allowed' : isLinked ? 'hover:bg-amber-50' : 'hover:bg-gray-50 active:bg-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
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
                              {isLinked && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                                  <Link2 className="w-3 h-3" />
                                  Linked
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(invoice.txnDate)}
                            </div>
                            {isLinked && (
                              <div className="text-xs text-amber-600 mt-0.5">
                                → Order #{invoice.linkedToOrderNumber} - {invoice.linkedToOrderName}
                              </div>
                            )}
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
                      {/* Preview/expand button (desktop only) */}
                      {!isMobile && onPreview && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreview(isPreviewing ? null : invoice);
                          }}
                          disabled={disabled}
                          className={`px-2 flex items-center justify-center border-l transition-colors ${
                            disabled ? 'cursor-not-allowed' : 'hover:bg-gray-100'
                          } ${
                            isPreviewing ? 'bg-blue-100 border-blue-300' : 'border-gray-200'
                          }`}
                          title={isPreviewing ? 'Close preview' : 'Preview invoice details'}
                        >
                          <Eye className={`w-4 h-4 ${isPreviewing ? 'text-blue-600' : 'text-gray-400'}`} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {invoiceList.totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 flex-shrink-0 mt-2">
                  <button
                    onClick={() => loadInvoices(currentPage - 1)}
                    disabled={currentPage === 1 || loadingList || disabled}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                      isMobile ? 'min-h-[44px]' : ''
                    } ${
                      currentPage === 1 || loadingList || disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {!isMobile && 'Previous'}
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {invoiceList.totalPages}
                  </span>
                  <button
                    onClick={() => loadInvoices(currentPage + 1)}
                    disabled={currentPage === invoiceList.totalPages || loadingList || disabled}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                      isMobile ? 'min-h-[44px]' : ''
                    } ${
                      currentPage === invoiceList.totalPages || loadingList || disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                  >
                    {!isMobile && 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        /* Search View */
        <div className={`space-y-4 ${disabled ? 'opacity-50' : ''}`}>
          {/* Search Type Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { if (!disabled) { setSearchType('docNumber'); setSearchResult(null); setSearchError(null); } }}
              disabled={disabled}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                disabled ? 'cursor-not-allowed' : ''
              } ${
                searchType === 'docNumber'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
              }`}
            >
              Invoice #
            </button>
            <button
              onClick={() => { if (!disabled) { setSearchType('id'); setSearchResult(null); setSearchError(null); } }}
              disabled={disabled}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                disabled ? 'cursor-not-allowed' : ''
              } ${
                searchType === 'id'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
              }`}
              title="Unique QuickBooks Transaction ID - use this if Invoice # is duplicated"
            >
              Transaction ID
            </button>
          </div>
          {searchType === 'id' && (
            <p className="text-xs text-gray-500">
              Use Transaction ID when Invoice # may be duplicated in QuickBooks
            </p>
          )}

          {/* Search Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={searchType === 'docNumber' ? 'e.g., 1234' : 'e.g., 12345'}
              disabled={disabled}
              className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                disabled ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !disabled) handleSearch();
              }}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchValue.trim() || disabled}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                searching || !searchValue.trim() || disabled
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
            <div className={`rounded-lg p-4 ${
              selectedInvoice?.invoiceId === searchResult.invoiceId
                ? 'bg-blue-50 border-2 border-blue-500'
                : 'bg-green-50 border border-green-200'
            }`}>
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
                    <span>{formatDate(searchResult.txnDate)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoiceLinkingPanel;
