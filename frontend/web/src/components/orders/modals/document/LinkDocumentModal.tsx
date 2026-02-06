/**
 * Link Document Modal (Unified)
 *
 * Modal for linking an existing QuickBooks document (invoice or estimate) to an order.
 * Features vary by document type:
 *
 * Invoice:
 * - Customer invoices list with pagination
 * - Search by Invoice # or Transaction ID
 * - Preview panel with line items
 * - Unlink functionality
 * - Current status banner
 *
 * Estimate:
 * - Customer estimates list with pagination
 * - No search (can be enabled when backend supports it)
 * - No preview panel (can be enabled when backend supports it)
 * - No unlink (can be enabled when backend supports it)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Loader2, Link, Search, FileText, AlertCircle, Check,
  ChevronLeft, ChevronRight, Unlink, AlertTriangle
} from 'lucide-react';
import {
  DocumentType,
  getDocumentConfig,
  CustomerDocumentListItem,
} from '../../../../types/document';
import { createDocumentApi, DocumentLineItemDetail } from './documentApi';
import { useModalBackdrop } from '../../../../hooks/useModalBackdrop';
import { formatDateWithYear } from '../../../../utils/dateUtils';

/** Order totals for comparison with QB documents */
export interface OrderTotals {
  subtotal: number;
  taxName: string;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

interface LinkDocumentModalProps {
  /** Document type determines available features */
  documentType: DocumentType;
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  onSuccess: () => void;
  /** Current document info if one is already linked */
  currentDocument?: {
    documentId: string | null;
    documentNumber: string | null;
  };
  /** Document status if known (from verification check) */
  documentStatus?: 'exists' | 'not_found' | 'error' | 'not_linked';
  /** Order totals for comparison display (invoice only) */
  orderTotals?: OrderTotals;
}

type ViewMode = 'list' | 'search';

export const LinkDocumentModal: React.FC<LinkDocumentModalProps> = ({
  documentType,
  isOpen,
  onClose,
  orderNumber,
  onSuccess,
  currentDocument,
  documentStatus,
  orderTotals,
}) => {
  const config = getDocumentConfig(documentType);
  const api = createDocumentApi(documentType);

  // View mode (list or search) - search only for invoices
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // List state
  const [documentList, setDocumentList] = useState<CustomerDocumentListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected document
  const [selectedDocument, setSelectedDocument] = useState<CustomerDocumentListItem | null>(null);

  // Search state (invoices only)
  const [searchValue, setSearchValue] = useState('');
  const [searchType, setSearchType] = useState<'id' | 'docNumber'>('docNumber');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<CustomerDocumentListItem | null>(null);

  // Link state
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Unlink state (invoices only)
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [unlinkSuccess, setUnlinkSuccess] = useState(false);

  // Preview panel state (invoices only)
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<CustomerDocumentListItem | null>(null);
  const [documentDetails, setDocumentDetails] = useState<Record<string, DocumentLineItemDetail[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Refs for backdrop click handling
  const previewPanelRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 10;

  // Check if there's a current document linked (even if deleted)
  const hasCurrentDocument = !!(currentDocument?.documentId || currentDocument?.documentNumber);
  const isCurrentDocumentDeleted = documentStatus === 'not_found';

  // Modal backdrop handling with preview panel ref
  const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp, isMobile } = useModalBackdrop({
    isOpen,
    onClose,
    additionalRefs: [previewPanelRef],
  });

  // Load customer documents
  const loadDocuments = async (page: number = 1) => {
    try {
      setLoadingList(true);
      setListError(null);
      const result = await api.listForCustomer(orderNumber, page, PAGE_SIZE);
      setDocumentList(result.documents);
      setTotalPages(result.totalPages);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load customer documents:', err);
      setListError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoadingList(false);
    }
  };

  // Load documents when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      loadDocuments(1);
    }
  }, [isOpen, orderNumber]);

  const handleSearch = async () => {
    if (!api.search) return;
    if (!searchValue.trim()) {
      setSearchError('Please enter a document number or ID');
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      setSearchResult(null);

      const result = await api.search(searchValue.trim(), searchType);

      if (!result.found) {
        setSearchError(`${config.labels.documentName} not found. Please check the number/ID and try again.`);
        return;
      }

      if (result.alreadyLinked) {
        setSearchError(`${config.labels.documentName} already linked to Order #${result.linkedOrderNumber}`);
        return;
      }

      setSearchResult({
        id: result.documentId!,
        docNumber: result.docNumber!,
        total: result.total!,
        balance: result.balance,
        txnDate: result.txnDate || '',
        customerName: result.customerName,
        isOpen: result.balance !== undefined ? result.balance > 0 : undefined,
      });
    } catch (err) {
      console.error('Failed to search document:', err);
      setSearchError(err instanceof Error ? err.message : 'Failed to search');
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async () => {
    const document = viewMode === 'list' ? selectedDocument : searchResult;
    if (!document) return;

    try {
      setLinking(true);
      setLinkError(null);

      // If reassigning, unlink first (for invoices)
      if (hasCurrentDocument && api.unlink) {
        console.log('Reassigning document - unlinking previous...');
        await api.unlink(orderNumber);
      }

      await api.link(orderNumber, document.id);

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Failed to link document:', err);
      setLinkError(err instanceof Error ? err.message : 'Failed to link document');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!api.unlink) return;

    try {
      setUnlinking(true);
      setUnlinkError(null);

      await api.unlink(orderNumber);

      setUnlinkSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Failed to unlink document:', err);
      setUnlinkError(err instanceof Error ? err.message : 'Failed to unlink document');
    } finally {
      setUnlinking(false);
    }
  };

  // Open preview panel for document (invoices only)
  const openPreview = async (document: CustomerDocumentListItem) => {
    if (!api.getDetails) return;

    const documentId = document.id;

    if (previewDocumentId === documentId) {
      // Close if same document clicked
      setPreviewDocumentId(null);
      setPreviewDocument(null);
      return;
    }

    setPreviewDocumentId(documentId);
    setPreviewDocument(document);

    // Fetch details if not cached
    if (!documentDetails[documentId]) {
      setLoadingDetails(prev => new Set(prev).add(documentId));
      try {
        const details = await api.getDetails(documentId);
        setDocumentDetails(prev => ({ ...prev, [documentId]: details.lineItems }));
      } catch (err) {
        console.error('Failed to load document details:', err);
        setDocumentDetails(prev => ({ ...prev, [documentId]: [] }));
      } finally {
        setLoadingDetails(prev => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
      }
    }
  };

  const closePreview = () => {
    setPreviewDocumentId(null);
    setPreviewDocument(null);
  };

  const resetForm = () => {
    setViewMode('list');
    setDocumentList([]);
    setTotalPages(1);
    setCurrentPage(1);
    setSelectedDocument(null);
    setSearchValue('');
    setSearchResult(null);
    setSearchError(null);
    setListError(null);
    setLinkError(null);
    setSuccess(false);
    setUnlinkError(null);
    setUnlinkSuccess(false);
    setPreviewDocumentId(null);
    setPreviewDocument(null);
    setDocumentDetails({});
    setLoadingDetails(new Set());
  };

  if (!isOpen) return null;

  const activeDocument = viewMode === 'list' ? selectedDocument : searchResult;

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile ? 'overflow-y-auto' : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div className={`flex ${isMobile ? '' : 'gap-3'}`}>
        {/* Main Modal */}
        <div
          ref={modalContentRef}
          className={`bg-white rounded-lg shadow-2xl flex flex-col flex-shrink-0 ${
            isMobile ? 'w-full min-h-full' : 'w-[576px] max-h-[90vh]'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <Link className={`w-6 h-6 ${isCurrentDocumentDeleted ? 'text-red-600' : 'text-blue-600'}`} />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {isCurrentDocumentDeleted
                      ? `Reassign or Unlink ${config.labels.documentName}`
                      : hasCurrentDocument
                        ? `Reassign ${config.labels.documentName}`
                        : config.title.link
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
                  {hasCurrentDocument ? `${config.labels.documentName} reassigned successfully!` : `${config.labels.documentName} linked successfully!`}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  This order is now connected to the QuickBooks {config.labels.documentName.toLowerCase()}.
                </p>
              </div>
            ) : unlinkSuccess ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <Unlink className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="font-medium text-green-800">{config.labels.documentName} unlinked successfully!</p>
                <p className="text-sm text-green-700 mt-1">
                  This order is no longer connected to a QuickBooks {config.labels.documentName.toLowerCase()}.
                </p>
              </div>
            ) : (
              <>
                {/* Order Totals Reference (invoice only) */}
                {orderTotals && documentType === 'invoice' && (
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

                {/* Current Document Status Banner */}
                {hasCurrentDocument && config.features.hasUnlink && (
                  <div className={`mb-4 p-4 rounded-lg border ${
                    isCurrentDocumentDeleted ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {isCurrentDocumentDeleted ? (
                          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className={`font-medium ${isCurrentDocumentDeleted ? 'text-red-800' : 'text-blue-800'}`}>
                            {isCurrentDocumentDeleted
                              ? `Linked ${config.labels.documentName} Deleted in QuickBooks`
                              : `Currently Linked ${config.labels.documentName}`
                            }
                          </p>
                          <div className="text-sm mt-1 space-y-0.5">
                            {currentDocument?.documentNumber && (
                              <p className={isCurrentDocumentDeleted ? 'text-red-700' : 'text-blue-700'}>
                                {config.labels.documentName} #: <span className="font-mono">{currentDocument.documentNumber}</span>
                              </p>
                            )}
                            {currentDocument?.documentId && (
                              <p className={isCurrentDocumentDeleted ? 'text-red-600' : 'text-blue-600'}>
                                Transaction ID: <span className="font-mono text-xs">{currentDocument.documentId}</span>
                              </p>
                            )}
                          </div>
                          {isCurrentDocumentDeleted && (
                            <p className="text-sm text-red-600 mt-2">
                              You must unlink or reassign this {config.labels.documentName.toLowerCase()} to continue.
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={handleUnlink}
                        disabled={unlinking}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 ${
                          isCurrentDocumentDeleted
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

                {/* View Mode Toggle (search only for invoices) */}
                {config.features.hasSearch && (
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => { setViewMode('list'); setSearchResult(null); setSearchError(null); }}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        viewMode === 'list'
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      Customer {config.labels.documentNamePlural}
                    </button>
                    <button
                      onClick={() => { setViewMode('search'); setSelectedDocument(null); }}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        viewMode === 'search'
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      Search by #
                    </button>
                  </div>
                )}

                {viewMode === 'list' ? (
                  /* Document List View */
                  <div className="flex-1 flex flex-col min-h-0">
                    {loadingList ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                        <span className="text-gray-600">Loading {config.labels.documentNamePlural.toLowerCase()}...</span>
                      </div>
                    ) : listError ? (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {listError}
                      </div>
                    ) : documentList.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No available {config.labels.documentNamePlural.toLowerCase()} found for this customer.</p>
                        {config.features.hasSearch && (
                          <p className="text-sm mt-1">Try searching by {config.labels.documentName.toLowerCase()} number instead.</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col min-h-0">
                        {/* Document List */}
                        <div className={`space-y-2 flex-1 overflow-y-auto ${isMobile ? '' : 'min-h-0'}`}>
                          {documentList.map((doc) => (
                            <div
                              key={doc.id}
                              className={`rounded-lg border transition-colors ${
                                selectedDocument?.id === doc.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              {/* Main document row */}
                              <div className="flex items-stretch">
                                {/* Document info - clickable for selection */}
                                <button
                                  onClick={() => setSelectedDocument(
                                    selectedDocument?.id === doc.id ? null : doc
                                  )}
                                  className={`flex-1 text-left transition-colors ${
                                    isMobile ? 'p-4 min-h-[72px]' : 'p-3'
                                  } hover:bg-gray-50 active:bg-gray-100 rounded-l-lg`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">
                                          #{doc.docNumber}
                                        </span>
                                        {config.features.hasBalance && doc.isOpen !== undefined && (
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            doc.isOpen
                                              ? 'bg-orange-100 text-orange-700'
                                              : 'bg-green-100 text-green-700'
                                          }`}>
                                            {doc.isOpen ? 'Open' : 'Paid'}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {formatDateWithYear(doc.txnDate)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium text-gray-900">
                                        ${doc.total.toFixed(2)}
                                      </div>
                                      {config.features.hasBalance && doc.isOpen && doc.balance !== undefined && (
                                        <div className="text-xs text-orange-600">
                                          Bal: ${doc.balance.toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </button>

                                {/* Preview button (invoices only) */}
                                {config.features.hasPreview && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPreview(doc);
                                    }}
                                    className={`flex-shrink-0 px-3 flex items-center justify-center hover:bg-gray-100 rounded-r-lg border-l border-gray-200 ${
                                      previewDocumentId === doc.id ? 'bg-blue-50' : ''
                                    }`}
                                    title="View line items"
                                  >
                                    <ChevronRight className={`w-4 h-4 ${previewDocumentId === doc.id ? 'text-blue-600' : 'text-gray-400'}`} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-3 border-t border-gray-200 flex-shrink-0">
                            <button
                              onClick={() => loadDocuments(currentPage - 1)}
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
                              Page {currentPage} of {totalPages}
                            </span>
                            <button
                              onClick={() => loadDocuments(currentPage + 1)}
                              disabled={currentPage === totalPages || loadingList}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                                isMobile ? 'min-h-[44px]' : ''
                              } ${
                                currentPage === totalPages || loadingList
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
                    )}
                  </div>
                ) : (
                  /* Search View (invoices only) */
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
                        {config.labels.documentName} #
                      </button>
                      <button
                        onClick={() => { setSearchType('id'); setSearchResult(null); setSearchError(null); }}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                          searchType === 'id'
                            ? 'bg-gray-200 text-gray-800'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                        }`}
                        title={`Unique QuickBooks Transaction ID - use this if ${config.labels.documentName} # is duplicated`}
                      >
                        Transaction ID
                      </button>
                    </div>
                    {searchType === 'id' && (
                      <p className="text-xs text-gray-500">
                        Use Transaction ID when {config.labels.documentName} # may be duplicated in QuickBooks
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
                          <span className="font-medium text-green-800">{config.labels.documentName} Found</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">{config.labels.documentName} #:</span>
                            <span className="font-medium">{searchResult.docNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total:</span>
                            <span className="font-medium">${searchResult.total.toFixed(2)}</span>
                          </div>
                          {config.features.hasBalance && searchResult.balance !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Balance:</span>
                              <span className={`font-medium ${
                                searchResult.balance === 0 ? 'text-green-600' : 'text-orange-600'
                              }`}>
                                ${searchResult.balance.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {searchResult.txnDate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Date:</span>
                              <span>{formatDateWithYear(searchResult.txnDate)}</span>
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

            {!success && !unlinkSuccess && activeDocument && (
              <button
                onClick={handleLink}
                disabled={linking}
                className={`px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  isMobile ? 'min-h-[44px]' : ''
                } ${
                  linking
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : hasCurrentDocument
                      ? 'bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800'
                      : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                }`}
              >
                {linking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {hasCurrentDocument ? 'Reassigning...' : 'Linking...'}
                  </>
                ) : (
                  <>
                    <Link className="w-4 h-4" />
                    {hasCurrentDocument ? 'Reassign to' : 'Link'} #{activeDocument.docNumber}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Preview Panel (invoices only, desktop) */}
        {previewDocumentId && previewDocument && !isMobile && config.features.hasPreview && (
          <div ref={previewPanelRef} className="bg-white rounded-lg shadow-2xl w-[450px] max-h-[90vh] flex flex-col flex-shrink-0">
            {/* Preview Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-sm font-medium text-gray-900">{config.labels.documentName} #{previewDocument.docNumber}</div>
                <div className="text-xs text-gray-500">{formatDateWithYear(previewDocument.txnDate)}</div>
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
              {/* Document Summary */}
              <div className="mb-4 pb-3 border-b border-gray-200">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Total:</span>
                  <span className="font-medium">${previewDocument.total.toFixed(2)}</span>
                </div>
                {config.features.hasBalance && previewDocument.balance !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Balance:</span>
                    <span className={`font-medium ${previewDocument.balance === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      ${previewDocument.balance.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Line Items
              </div>
              {loadingDetails.has(previewDocumentId) ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                  <span className="text-sm text-gray-500">Loading...</span>
                </div>
              ) : documentDetails[previewDocumentId] && documentDetails[previewDocumentId].length > 0 ? (
                <div className="space-y-3">
                  {documentDetails[previewDocumentId].map((line, idx) => (
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

export default LinkDocumentModal;
