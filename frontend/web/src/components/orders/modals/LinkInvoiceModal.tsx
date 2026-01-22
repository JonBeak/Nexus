/**
 * Link Invoice Modal
 * Phase 2.e: QuickBooks Invoice Automation
 *
 * Modal for linking an existing QuickBooks invoice to an order:
 * - Shows list of customer's QB invoices (open first, then closed)
 * - Supports pagination (10 per page)
 * - Allows search by Invoice # or Transaction ID (unique QB identifier)
 * - Supports reassigning invoices (unlinks old, links new)
 * - Handles deleted invoices gracefully
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Link, Search, FileText, AlertCircle, Check, ChevronLeft, ChevronRight, Unlink, AlertTriangle } from 'lucide-react';
import { qbInvoiceApi, CustomerInvoiceListItem, CustomerInvoiceListResult, InvoiceLineItem } from '../../../services/api';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

/** Order totals for comparison with QB invoices */
export interface OrderTotals {
  subtotal: number;
  taxName: string;
  taxPercent: number;  // e.g., 13 for 13%
  taxAmount: number;
  total: number;
}

interface LinkInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  onSuccess: () => void;
  /** Current invoice info if one is already linked */
  currentInvoice?: {
    invoiceId: string | null;
    invoiceNumber: string | null;
  };
  /** Invoice status if known (from InvoiceButton check) */
  invoiceStatus?: 'exists' | 'not_found' | 'error' | 'not_linked';
  /** Order totals for comparison display */
  orderTotals?: OrderTotals;
}

type ViewMode = 'list' | 'search';

export const LinkInvoiceModal: React.FC<LinkInvoiceModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  onSuccess,
  currentInvoice,
  invoiceStatus,
  orderTotals
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

  // Unlink state
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [unlinkSuccess, setUnlinkSuccess] = useState(false);

  // Preview panel state
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<CustomerInvoiceListItem | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<Record<string, InvoiceLineItem[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Refs for backdrop click handling
  const modalContentRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);

  // Mobile detection
  const isMobile = useIsMobile();
  useBodyScrollLock(isOpen && isMobile);

  const PAGE_SIZE = 10;

  // Check if there's a current invoice linked (even if deleted)
  const hasCurrentInvoice = !!(currentInvoice?.invoiceId || currentInvoice?.invoiceNumber);
  const isCurrentInvoiceDeleted = invoiceStatus === 'not_found';

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

  // Handle ESC key - stop propagation to prevent parent modals from closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click - only close if both mousedown and mouseup are outside modal content
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    const target = e.target as Node;
    const isInsideModal = modalContentRef.current?.contains(target);
    const isInsidePreview = previewPanelRef.current?.contains(target);
    mouseDownOutsideRef.current = !isInsideModal && !isInsidePreview;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    const target = e.target as Node;
    const isInsideModal = modalContentRef.current?.contains(target);
    const isInsidePreview = previewPanelRef.current?.contains(target);
    if (mouseDownOutsideRef.current && !isInsideModal && !isInsidePreview) {
      onClose();
    }
    mouseDownOutsideRef.current = false;
  };

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

      // If reassigning, unlink first (backend handles this, but we do it explicitly for clarity)
      if (hasCurrentInvoice) {
        console.log('Reassigning invoice - unlinking previous...');
        await qbInvoiceApi.unlinkInvoice(orderNumber);
      }

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

  const handleUnlink = async () => {
    try {
      setUnlinking(true);
      setUnlinkError(null);

      await qbInvoiceApi.unlinkInvoice(orderNumber);

      setUnlinkSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Failed to unlink invoice:', err);
      setUnlinkError(err instanceof Error ? err.message : 'Failed to unlink invoice');
    } finally {
      setUnlinking(false);
    }
  };

  // Open preview panel for invoice
  const openPreview = async (invoice: CustomerInvoiceListItem) => {
    const invoiceId = invoice.invoiceId;

    if (previewInvoiceId === invoiceId) {
      // Close if same invoice clicked
      setPreviewInvoiceId(null);
      setPreviewInvoice(null);
      return;
    }

    setPreviewInvoiceId(invoiceId);
    setPreviewInvoice(invoice);

    // Fetch details if not cached
    if (!invoiceDetails[invoiceId]) {
      setLoadingDetails(prev => new Set(prev).add(invoiceId));
      try {
        const details = await qbInvoiceApi.getInvoiceDetails(invoiceId);
        const lineItems = details?.lineItems || [];
        setInvoiceDetails(prev => ({ ...prev, [invoiceId]: lineItems }));
      } catch (err) {
        console.error('Failed to load invoice details:', err);
        setInvoiceDetails(prev => ({ ...prev, [invoiceId]: [] }));
      } finally {
        setLoadingDetails(prev => {
          const next = new Set(prev);
          next.delete(invoiceId);
          return next;
        });
      }
    }
  };

  const closePreview = () => {
    setPreviewInvoiceId(null);
    setPreviewInvoice(null);
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
    setUnlinkError(null);
    setUnlinkSuccess(false);
    setPreviewInvoiceId(null);
    setPreviewInvoice(null);
    setInvoiceDetails({});
    setLoadingDetails(new Set());
  };

  if (!isOpen) return null;

  const activeInvoice = viewMode === 'list' ? selectedInvoice : searchResult;

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
      <div className={`flex ${isMobile ? '' : 'gap-3'}`}>
        {/* Main Modal */}
        <div ref={modalContentRef} className={`bg-white rounded-lg shadow-2xl flex flex-col flex-shrink-0 ${
          isMobile
            ? 'w-full min-h-full'
            : 'w-[576px] max-h-[90vh]'
        }`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Link className={`w-6 h-6 ${isCurrentInvoiceDeleted ? 'text-red-600' : 'text-blue-600'}`} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {isCurrentInvoiceDeleted
                    ? 'Reassign or Unlink Invoice'
                    : hasCurrentInvoice
                      ? 'Reassign Invoice'
                      : 'Link Existing Invoice'
                  }
                </h2>
                <p className="text-sm text-gray-600">Order #{orderNumber}</p>
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
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="font-medium text-green-800">
                {hasCurrentInvoice ? 'Invoice reassigned successfully!' : 'Invoice linked successfully!'}
              </p>
              <p className="text-sm text-green-700 mt-1">
                This order is now connected to the QuickBooks invoice.
              </p>
            </div>
          ) : unlinkSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <Unlink className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="font-medium text-green-800">Invoice unlinked successfully!</p>
              <p className="text-sm text-green-700 mt-1">
                This order is no longer connected to a QuickBooks invoice.
              </p>
            </div>
          ) : (
            <>
              {/* Order Totals Reference */}
              {orderTotals && (
                <div className="mb-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Order #{orderNumber} Totals
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Subtotal</div>
                      <div className="text-sm font-medium text-gray-700">${orderTotals.subtotal.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">{orderTotals.taxName || 'Tax'} ({orderTotals.taxPercent.toFixed(0)}%)</div>
                      <div className="text-sm font-medium text-gray-700">${orderTotals.taxAmount.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="text-sm font-bold text-gray-900">${orderTotals.total.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Current Invoice Status Banner */}
              {hasCurrentInvoice && (
                <div className={`mb-4 p-4 rounded-lg border ${
                  isCurrentInvoiceDeleted
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {isCurrentInvoiceDeleted ? (
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className={`font-medium ${isCurrentInvoiceDeleted ? 'text-red-800' : 'text-blue-800'}`}>
                          {isCurrentInvoiceDeleted
                            ? 'Linked Invoice Deleted in QuickBooks'
                            : 'Currently Linked Invoice'
                          }
                        </p>
                        <div className="text-sm mt-1 space-y-0.5">
                          {currentInvoice?.invoiceNumber && (
                            <p className={isCurrentInvoiceDeleted ? 'text-red-700' : 'text-blue-700'}>
                              Invoice #: <span className="font-mono">{currentInvoice.invoiceNumber}</span>
                            </p>
                          )}
                          {currentInvoice?.invoiceId && (
                            <p className={isCurrentInvoiceDeleted ? 'text-red-600' : 'text-blue-600'}>
                              Transaction ID: <span className="font-mono text-xs">{currentInvoice.invoiceId}</span>
                            </p>
                          )}
                        </div>
                        {isCurrentInvoiceDeleted && (
                          <p className="text-sm text-red-600 mt-2">
                            You must unlink or reassign this invoice to continue.
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleUnlink}
                      disabled={unlinking}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 ${
                        isCurrentInvoiceDeleted
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      } disabled:opacity-50`}
                    >
                      {unlinking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlink className="w-4 h-4" />
                      )}
                      Unlink
                    </button>
                  </div>
                  {unlinkError && (
                    <div className="mt-2 text-sm text-red-600">{unlinkError}</div>
                  )}
                </div>
              )}
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
                        {invoiceList.invoices.map((invoice) => (
                          <div
                            key={invoice.invoiceId}
                            className={`rounded-lg border transition-colors ${
                              selectedInvoice?.invoiceId === invoice.invoiceId
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200'
                            }`}
                          >
                            {/* Main invoice row */}
                            <div className="flex items-stretch">
                              {/* Invoice info - clickable for selection */}
                              <button
                                onClick={() => setSelectedInvoice(
                                  selectedInvoice?.invoiceId === invoice.invoiceId ? null : invoice
                                )}
                                className={`flex-1 text-left transition-colors ${
                                  isMobile ? 'p-4 min-h-[72px]' : 'p-3'
                                } hover:bg-gray-50 active:bg-gray-100 rounded-l-lg`}
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

                              {/* Preview button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPreview(invoice);
                                }}
                                className={`flex-shrink-0 px-3 flex items-center justify-center hover:bg-gray-100 rounded-r-lg border-l border-gray-200 ${
                                  previewInvoiceId === invoice.invoiceId ? 'bg-blue-50' : ''
                                }`}
                                title="View line items"
                              >
                                <ChevronRight className={`w-4 h-4 ${previewInvoiceId === invoice.invoiceId ? 'text-blue-600' : 'text-gray-400'}`} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {invoiceList.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-3 border-t border-gray-200 flex-shrink-0">
                          <button
                            onClick={() => loadInvoices(currentPage - 1)}
                            disabled={currentPage === 1 || loadingList}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                              isMobile ? 'min-h-[44px]' : ''
                            } ${
                              currentPage === 1 || loadingList
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
                            disabled={currentPage === invoiceList.totalPages || loadingList}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                              isMobile ? 'min-h-[44px]' : ''
                            } ${
                              currentPage === invoiceList.totalPages || loadingList
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
        <div className={`px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex ${
          isMobile ? 'flex-col-reverse gap-2' : 'justify-between'
        } flex-shrink-0`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-gray-600 hover:text-gray-800 active:text-gray-900 rounded-lg ${
              isMobile ? 'min-h-[44px]' : ''
            }`}
          >
            {success || unlinkSuccess ? 'Close' : 'Cancel'}
          </button>

          {!success && !unlinkSuccess && activeInvoice && (
            <button
              onClick={handleLink}
              disabled={linking}
              className={`px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                isMobile ? 'min-h-[44px]' : ''
              } ${
                linking
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : hasCurrentInvoice
                    ? 'bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {linking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {hasCurrentInvoice ? 'Reassigning...' : 'Linking...'}
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  {hasCurrentInvoice ? 'Reassign to' : 'Link'} #{activeInvoice.docNumber}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Preview Panel */}
      {previewInvoiceId && previewInvoice && !isMobile && (
        <div ref={previewPanelRef} className="bg-white rounded-lg shadow-2xl w-[450px] max-h-[90vh] flex flex-col flex-shrink-0">
          {/* Preview Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="text-sm font-medium text-gray-900">Invoice #{previewInvoice.docNumber}</div>
              <div className="text-xs text-gray-500">{previewInvoice.txnDate}</div>
            </div>
            <button
              onClick={closePreview}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Invoice Summary */}
            <div className="mb-4 pb-3 border-b border-gray-200">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Total:</span>
                <span className="font-medium">${previewInvoice.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Balance:</span>
                <span className={`font-medium ${previewInvoice.balance === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  ${previewInvoice.balance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Line Items */}
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Line Items
            </div>
            {loadingDetails.has(previewInvoiceId) ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                <span className="text-sm text-gray-500">Loading...</span>
              </div>
            ) : invoiceDetails[previewInvoiceId] && invoiceDetails[previewInvoiceId].length > 0 ? (
              <div className="space-y-3">
                {invoiceDetails[previewInvoiceId].map((line, idx) => (
                  <div key={idx} className="text-sm border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900 flex-1">{line.itemName}</span>
                      <span className="text-gray-500 w-24 text-right">{line.quantity} × ${line.unitPrice?.toFixed(2) || '0.00'}</span>
                      <span className="font-medium text-gray-900 w-20 text-right">${line.amount.toFixed(2)}</span>
                    </div>
                    {line.description && (
                      <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                        {line.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                No line items found
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default LinkInvoiceModal;
