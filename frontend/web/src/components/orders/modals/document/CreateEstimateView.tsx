/**
 * CreateEstimateView - Estimate create mode layout
 *
 * Single-panel layout for both mobile and desktop.
 * Shows From/To, line items, totals, and create/link buttons.
 */

import React from 'react';
import {
  X, Loader2, FileText, Link as LinkIcon
} from 'lucide-react';
import { Order } from '../../../../types/orders';
import { Address } from '../../../../types';
import { DocumentConfig } from '../../../../types/document';
import { InvoiceSentSuccessModal } from '../InvoiceSentSuccessModal';

interface DisplayPart {
  is_header_row?: boolean;
  qb_item_name?: string;
  qb_description?: string;
  invoice_description?: string;
  product_type?: string;
  quantity?: number;
  unit_price?: number;
  extended_price?: number;
}

interface TotalsResult {
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  deposit: number;
  taxNotFound: boolean;
  taxName: string | null;
}

export interface CreateEstimateViewProps {
  order: Order;
  config: DocumentConfig;
  isMobile: boolean;
  isInitialized: boolean;
  loading: boolean;
  error: string | null;
  displayParts: DisplayPart[];
  totals: TotalsResult;
  companySettings: { company_name: string | null; company_address: string | null } | null;
  customerBillingAddress: Address | null;
  formattedDate: string;
  modalTitle: string;
  qbDocumentNumber: string | null;
  showSuccessModal: boolean;
  successModalData: {
    recipients: { to: string[]; cc: string[]; bcc: string[] };
    scheduledFor?: string;
    wasResent?: boolean;
  } | null;
  // Refs
  modalContentRef: React.RefObject<HTMLDivElement | null>;
  // Handlers
  onClose: () => void;
  onSkip?: () => void;
  onLinkExisting?: () => void;
  onDocumentOnly: () => void;
  onBackdropMouseDown: (e: React.MouseEvent) => void;
  onBackdropMouseUp: (e: React.MouseEvent) => void;
  onSuccessModalClose: () => void;
  formatAddress: (addr: Address | null) => string;
}

export const CreateEstimateView: React.FC<CreateEstimateViewProps> = ({
  order, config, isMobile, isInitialized, loading, error,
  displayParts, totals, companySettings, customerBillingAddress,
  formattedDate, modalTitle, qbDocumentNumber,
  showSuccessModal, successModalData,
  modalContentRef,
  onClose, onSkip, onLinkExisting, onDocumentOnly,
  onBackdropMouseDown, onBackdropMouseUp, onSuccessModalClose, formatAddress,
}) => {
  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile ? 'overflow-y-auto' : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={onBackdropMouseDown}
      onMouseUp={onBackdropMouseUp}
    >
      <div ref={modalContentRef} className={`bg-white shadow-2xl w-full flex flex-col ${
        isMobile ? 'min-h-full' : 'rounded-lg max-w-3xl max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} border-b border-gray-200 flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-green-600`} />
              <div>
                <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-900`}>{modalTitle}</h2>
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

        {/* Body */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-6'}`}>
          {!isInitialized ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading...</span>
            </div>
          ) : (
            <div className={`bg-gray-50 rounded-lg border border-gray-200 ${isMobile ? 'p-4' : 'p-6'}`}>
              {/* From/To/Date Header */}
              <div className={`${isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-2 gap-6'} mb-6`}>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">From</h4>
                  <p className="text-sm font-medium text-gray-900">{companySettings?.company_name || 'Sign House'}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{companySettings?.company_address || ''}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill To</h4>
                  <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{formatAddress(customerBillingAddress)}</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{config.labels.documentName} Date</h4>
                <p className="text-sm text-gray-900">{formattedDate}</p>
              </div>

              {/* Line Items - Mobile Cards / Desktop Table */}
              <div className="mb-6">
                {isMobile ? (
                  <div className="space-y-3">
                    {displayParts.map((part, idx) => (
                      part.is_header_row ? (
                        <div key={idx} className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                          <div className="font-semibold text-gray-900 text-sm">
                            {part.qb_description || part.invoice_description || 'Section Header'}
                          </div>
                        </div>
                      ) : (
                        <div key={idx} className="bg-white border border-gray-300 rounded-lg p-3">
                          <div className="font-medium text-gray-900 text-sm">{part.qb_item_name || '-'}</div>
                          <div className="flex items-center justify-between mt-2 text-sm">
                            <span className="text-gray-600">Qty: <span className="font-medium">{part.quantity}</span></span>
                            <span className="text-gray-600">@ ${Number(part.unit_price || 0).toFixed(2)}</span>
                            <span className="font-semibold text-gray-900">${Number(part.extended_price || 0).toFixed(2)}</span>
                          </div>
                          {part.qb_description && (
                            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600 whitespace-pre-wrap">
                              {part.qb_description}
                            </div>
                          )}
                        </div>
                      )
                    ))}
                    {displayParts.filter(p => !p.is_header_row).length === 0 && (
                      <div className="py-4 text-center text-gray-500 italic text-sm">No line items</div>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-2 font-medium text-gray-700">Item Name</th>
                        <th className="text-left py-2 font-medium text-gray-700">QB Description</th>
                        <th className="text-right py-2 font-medium text-gray-700 w-16">Qty</th>
                        <th className="text-right py-2 font-medium text-gray-700 w-24">Price</th>
                        <th className="text-right py-2 font-medium text-gray-700 w-24">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayParts.map((part, idx) => (
                        part.is_header_row ? (
                          <tr key={idx} className="bg-gray-100">
                            <td colSpan={5} className="py-2 px-2 font-semibold text-gray-900">
                              {part.qb_description || part.invoice_description || 'Section Header'}
                            </td>
                          </tr>
                        ) : (
                          <tr key={idx} className="border-b border-gray-300">
                            <td className="py-2 text-gray-900">{part.qb_item_name || '-'}</td>
                            <td className="py-2 text-gray-600 whitespace-pre-wrap">{part.qb_description || '-'}</td>
                            <td className="py-2 text-right text-gray-600">{part.quantity}</td>
                            <td className="py-2 text-right text-gray-600">${Number(part.unit_price || 0).toFixed(2)}</td>
                            <td className="py-2 text-right text-gray-900">${Number(part.extended_price || 0).toFixed(2)}</td>
                          </tr>
                        )
                      ))}
                      {displayParts.filter(p => !p.is_header_row).length === 0 && (
                        <tr><td colSpan={5} className="py-4 text-center text-gray-500 italic">No line items</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Totals */}
              <div className="border-t border-gray-300 pt-4 space-y-2">
                <div className="flex justify-end">
                  <span className="w-32 text-gray-600 text-sm">Subtotal:</span>
                  <span className="w-28 text-right font-medium text-sm">${totals.subtotal.toFixed(2)}</span>
                </div>
                {!order.cash && (
                  <div className="flex justify-end">
                    <span className={`w-32 text-sm ${totals.taxNotFound ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {totals.taxNotFound ? `${totals.taxName} (NOT FOUND):` : `Tax (${totals.taxName || 'Tax'} ${(totals.taxRate * 100).toFixed(0)}%):`}
                    </span>
                    <span className={`w-28 text-right font-medium text-sm ${totals.taxNotFound ? 'text-red-600' : ''}`}>
                      {totals.taxNotFound ? 'ERROR' : `$${totals.tax.toFixed(2)}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-end border-t border-gray-200 pt-2">
                  <span className="w-32 font-semibold text-gray-900">Total:</span>
                  <span className="w-28 text-right font-bold text-gray-900">${totals.total.toFixed(2)}</span>
                </div>
                {!!order.deposit_required && (
                  <div className="flex justify-end bg-green-50 px-3 py-2 rounded mt-2">
                    <span className="w-32 font-semibold text-green-700">Deposit (50%):</span>
                    <span className="w-28 text-right font-bold text-green-700">${totals.deposit.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} border-t border-gray-200 bg-white flex-shrink-0`}>
          <div className={`flex items-center ${isMobile ? 'flex-col-reverse gap-3' : 'justify-between'}`}>
            <button
              onClick={onSkip || onClose}
              className={`text-gray-600 hover:text-gray-800 active:text-gray-900 text-sm ${
                isMobile ? 'w-full py-3 min-h-[44px]' : 'px-4 py-2'
              }`}
            >
              {onSkip ? 'Skip' : 'Cancel'}
            </button>
            <div className={`flex items-center gap-3 ${isMobile ? 'w-full flex-col' : ''}`}>
              {onLinkExisting && (
                <button
                  onClick={onLinkExisting}
                  disabled={loading}
                  className={`rounded-lg border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50 ${
                    isMobile ? 'w-full py-3 min-h-[44px]' : 'px-4 py-2'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  Link Existing
                </button>
              )}
              <button
                onClick={onDocumentOnly}
                disabled={loading}
                className={`rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50 ${
                  isMobile ? 'w-full py-3 min-h-[44px]' : 'px-4 py-2'
                }`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    {config.labels.createAction}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

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
