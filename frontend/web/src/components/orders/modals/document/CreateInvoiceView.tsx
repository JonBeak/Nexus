/**
 * CreateInvoiceView - Invoice create mode layout
 *
 * Mobile: Tabs (Create New / Link Existing)
 * Desktop: Side-by-side panels (Create New | Link Existing | Invoice Preview)
 */

import React from 'react';
import {
  X, Loader2, FileText, Link as LinkIcon, Plus
} from 'lucide-react';
import { Order } from '../../../../types/orders';
import { Address } from '../../../../types';
import { CustomerInvoiceListItem, InvoiceLineItem } from '../../../../services/api';
import { InvoiceLinkingPanel } from './InvoiceLinkingPanel';
import { InvoiceSentSuccessModal } from '../InvoiceSentSuccessModal';
import { InvoiceDisplayPart, TotalsResult, MobileCreateContent, DesktopCreateContent } from './CreateInvoiceViewParts';

export interface CreateInvoiceViewProps {
  order: Order;
  isMobile: boolean;
  isInitialized: boolean;
  loading: boolean;
  linking: boolean;
  error: string | null;
  linkError: string | null;
  loadingInvoicePreview: boolean;
  invoiceDisplayParts: InvoiceDisplayPart[];
  totals: TotalsResult;
  companySettings: { company_name: string | null; company_address: string | null } | null;
  customerBillingAddress: Address | null;
  formattedDate: string;
  selectedLinkInvoice: CustomerInvoiceListItem | null;
  previewInvoice: CustomerInvoiceListItem | null;
  invoiceDetails: Record<string, InvoiceLineItem[]>;
  loadingDetails: Set<string>;
  mobileCreateTab: 'create' | 'link';
  qbDocumentNumber: string | null;
  showSuccessModal: boolean;
  successModalData: {
    recipients: { to: string[]; cc: string[]; bcc: string[] };
    scheduledFor?: string;
    wasResent?: boolean;
  } | null;
  // Refs
  modalContentRef: React.RefObject<HTMLDivElement | null>;
  linkModalRef: React.RefObject<HTMLDivElement | null>;
  previewPanelRef: React.RefObject<HTMLDivElement | null>;
  // Handlers
  onClose: () => void;
  onSkip?: () => void;
  onBackdropMouseDown: (e: React.MouseEvent) => void;
  onBackdropMouseUp: (e: React.MouseEvent) => void;
  onMobileCreateTabChange: (tab: 'create' | 'link') => void;
  onSelectLinkInvoice: (v: CustomerInvoiceListItem | null) => void;
  onDocumentOnly: () => void;
  onLinkInvoiceFromCreate: () => void;
  onInvoicePreview: (invoice: CustomerInvoiceListItem | null) => void;
  onClosePreview: () => void;
  onSuccessModalClose: () => void;
  formatAddress: (addr: Address | null) => string;
}

export const CreateInvoiceView: React.FC<CreateInvoiceViewProps> = ({
  order, isMobile, isInitialized, loading, linking, error, linkError,
  loadingInvoicePreview, invoiceDisplayParts, totals, companySettings,
  customerBillingAddress, formattedDate, selectedLinkInvoice, previewInvoice,
  invoiceDetails, loadingDetails, mobileCreateTab, qbDocumentNumber,
  showSuccessModal, successModalData,
  modalContentRef, linkModalRef, previewPanelRef,
  onClose, onSkip, onBackdropMouseDown, onBackdropMouseUp,
  onMobileCreateTabChange, onSelectLinkInvoice, onDocumentOnly,
  onLinkInvoiceFromCreate, onInvoicePreview, onClosePreview,
  onSuccessModalClose, formatAddress,
}) => {
  const orderTotalsForLink = {
    subtotal: totals.subtotal,
    taxName: totals.taxName || 'Tax',
    taxPercent: totals.taxNotFound ? -1 : totals.taxRate * 100,
    taxAmount: totals.tax,
    total: totals.total
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile ? 'overflow-y-auto' : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={onBackdropMouseDown}
      onMouseUp={(e) => {
        const isInsideCreate = modalContentRef.current ? modalContentRef.current.contains(e.target as Node) : true;
        const isInsideLink = linkModalRef.current ? linkModalRef.current.contains(e.target as Node) : true;
        const isInsidePreview = previewPanelRef.current ? previewPanelRef.current.contains(e.target as Node) : true;
        if (!isInsideCreate && !isInsideLink && !isInsidePreview) {
          onBackdropMouseUp(e);
        }
      }}
    >
      {/* Mobile: Single modal with tabs */}
      {isMobile ? (
        <div ref={modalContentRef} className="bg-white shadow-2xl w-full min-h-full flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-green-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Invoice Options</h2>
                  <p className="text-sm text-gray-600">#{order.order_number} - {order.order_name}</p>
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

          {/* Mobile Tab Bar */}
          <div className="flex border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => onMobileCreateTabChange('create')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                mobileCreateTab === 'create'
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Plus className="w-4 h-4 inline-block mr-1.5" />
              Create New
            </button>
            <button
              onClick={() => onMobileCreateTabChange('link')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                mobileCreateTab === 'link'
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <LinkIcon className="w-4 h-4 inline-block mr-1.5" />
              Link Existing
            </button>
          </div>

          {/* Mobile Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {!isInitialized ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading...</span>
              </div>
            ) : mobileCreateTab === 'create' ? (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <MobileCreateContent
                    companySettings={companySettings}
                    order={order}
                    customerBillingAddress={customerBillingAddress}
                    formattedDate={formattedDate}
                    loadingInvoicePreview={loadingInvoicePreview}
                    invoiceDisplayParts={invoiceDisplayParts}
                    totals={totals}
                    formatAddress={formatAddress}
                  />
                  {error && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
                  )}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <div className="flex flex-col-reverse gap-2">
                    <button onClick={onSkip || onClose} disabled={loading || linking} className={`text-gray-600 hover:text-gray-800 text-sm w-full py-2 min-h-[44px] ${loading || linking ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {onSkip ? 'Skip' : 'Cancel'}
                    </button>
                    <button
                      onClick={onDocumentOnly}
                      disabled={loading || linking}
                      className="rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium flex items-center justify-center gap-2 text-sm w-full py-3 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4" />Create QB Invoice</>}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 overflow-hidden">
                  <InvoiceLinkingPanel
                    orderNumber={order.order_number}
                    orderTotals={orderTotalsForLink}
                    onSelect={onSelectLinkInvoice}
                    selectedInvoice={selectedLinkInvoice}
                    isMobile={true}
                    compact={false}
                    isActive={true}
                    disabled={loading || linking}
                  />
                </div>
                {linkError && (
                  <div className="mx-4 mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{linkError}</div>
                )}
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <div className="flex flex-col-reverse gap-2">
                    <button onClick={onSkip || onClose} disabled={loading || linking} className={`text-gray-600 hover:text-gray-800 text-sm w-full py-2 min-h-[44px] ${loading || linking ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {onSkip ? 'Skip' : 'Cancel'}
                    </button>
                    <button
                      onClick={onLinkInvoiceFromCreate}
                      disabled={linking || loading || !selectedLinkInvoice}
                      className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm w-full py-3 min-h-[44px] ${
                        linking || loading || !selectedLinkInvoice ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LinkIcon className="w-4 h-4" />{selectedLinkInvoice ? `Link Invoice #${selectedLinkInvoice.docNumber}` : 'Select Invoice'}</>}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Desktop: Two separate modal windows side-by-side */
        <div className="flex gap-4">
          {/* Left Modal - Create New Invoice */}
          <div ref={modalContentRef} className="bg-white rounded-lg shadow-2xl w-[680px] max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Create New Invoice</h2>
                    <p className="text-sm text-gray-500">#{order.order_number} - {order.order_name}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {!isInitialized ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading...</span>
                </div>
              ) : (
                <DesktopCreateContent
                  companySettings={companySettings}
                  order={order}
                  customerBillingAddress={customerBillingAddress}
                  formattedDate={formattedDate}
                  loadingInvoicePreview={loadingInvoicePreview}
                  invoiceDisplayParts={invoiceDisplayParts}
                  totals={totals}
                  formatAddress={formatAddress}
                />
              )}
              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
              <div className="flex items-center justify-between">
                <button
                  onClick={onSkip || onClose}
                  disabled={loading || linking}
                  className={`text-gray-600 hover:text-gray-800 active:text-gray-900 text-sm px-3 py-2 ${loading || linking ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {onSkip ? 'Skip' : 'Cancel'}
                </button>
                <button
                  onClick={onDocumentOnly}
                  disabled={loading || linking}
                  className="rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium flex items-center justify-center gap-2 text-sm px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Create QB Invoice
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Modal - Link Existing Invoice */}
          <div ref={linkModalRef} className="bg-white rounded-lg shadow-2xl w-[480px] max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <LinkIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Link Existing Invoice</h2>
                  <p className="text-sm text-gray-500">Select from customer's invoices</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <InvoiceLinkingPanel
                orderNumber={order.order_number}
                orderTotals={orderTotalsForLink}
                onSelect={onSelectLinkInvoice}
                selectedInvoice={selectedLinkInvoice}
                isMobile={false}
                compact={false}
                isActive={true}
                disabled={loading || linking}
                onPreview={onInvoicePreview}
                previewInvoiceId={previewInvoice?.invoiceId || null}
              />
            </div>

            {linkError && (
              <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{linkError}</div>
            )}

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
              <div className="flex items-center justify-end">
                <button
                  onClick={onLinkInvoiceFromCreate}
                  disabled={linking || loading || !selectedLinkInvoice}
                  className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm px-5 py-2.5 ${
                    linking || loading || !selectedLinkInvoice
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  }`}
                >
                  {linking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      {selectedLinkInvoice ? `Link Invoice #${selectedLinkInvoice.docNumber}` : 'Select Invoice'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Third Window - Invoice Preview Panel */}
          {previewInvoice && (
            <div ref={previewPanelRef} className="bg-white rounded-lg shadow-2xl w-[400px] max-h-[85vh] flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <div className="text-sm font-medium text-gray-900">Invoice #{previewInvoice.docNumber}</div>
                  <div className="text-xs text-gray-500">{previewInvoice.txnDate}</div>
                </div>
                <button onClick={onClosePreview} className="p-1.5 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
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
                  {previewInvoice.linkedToOrderNumber && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs text-amber-600">
                        <LinkIcon className="w-3 h-3" />
                        <span>Linked to Order #{previewInvoice.linkedToOrderNumber} - {previewInvoice.linkedToOrderName}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Line Items
                </div>
                {loadingDetails.has(previewInvoice.invoiceId) ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                ) : invoiceDetails[previewInvoice.invoiceId] && invoiceDetails[previewInvoice.invoiceId].length > 0 ? (
                  <div className="space-y-3">
                    {invoiceDetails[previewInvoice.invoiceId].map((line, idx) => (
                      <div key={idx} className="text-sm border-b border-gray-100 pb-2 last:border-0">
                        <div className="flex items-start">
                          <span className="font-medium text-gray-900 flex-1">{line.itemName}</span>
                          <span className="text-gray-500 text-xs whitespace-nowrap ml-2">{line.quantity} × ${line.unitPrice?.toFixed(2) || '0.00'}</span>
                          <span className="font-medium text-gray-900 w-16 text-right">${line.amount.toFixed(2)}</span>
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
      )}

      <InvoiceSentSuccessModal
        isOpen={showSuccessModal}
        onClose={onSuccessModalClose}
        orderNumber={order.order_number}
        orderName={order.order_name}
        invoiceNumber={qbDocumentNumber || undefined}
        recipients={successModalData?.recipients || { to: [], cc: [], bcc: [] }}
        scheduledFor={successModalData?.scheduledFor}
        wasResent={successModalData?.wasResent}
      />
    </div>
  );
};

