/**
 * DocumentSendViewPanels - Sub-components for DocumentSendView
 *
 * FormPanel: Left panel with recipients, email composer, history, actions
 * PreviewPanel: Right panel with email HTML iframe, PDF viewer, fallback table
 */

import React from 'react';
import {
  X, Loader2, Send, FileText, RefreshCw, Clock, Mail, Eye,
  AlertTriangle, UserCircle, CheckCircle
} from 'lucide-react';
import { Order } from '../../../../types/orders';
import {
  DocumentType,
  DocumentSyncStatus,
  DocumentRecipientEntry,
  DocumentEmailHistoryItem,
  DocumentConfig,
} from '../../../../types/document';
import InvoiceEmailComposer, {
  InvoiceEmailConfig,
  InvoiceEmailData,
} from '../InvoiceEmailComposer';
import { DocumentMode } from './DocumentActionModal';

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

export const FormPanel: React.FC<{
  mode: DocumentMode;
  documentType: DocumentType;
  order: Order;
  config: DocumentConfig;
  isMobile: boolean;
  loading: boolean;
  error: string | null;
  emailConfig: InvoiceEmailConfig;
  documentEmailData: InvoiceEmailData;
  recipientEntries: DocumentRecipientEntry[];
  loadingPreview: boolean;
  pickupChecked: boolean;
  shippingChecked: boolean;
  completedChecked: boolean;
  checkingSync: boolean;
  isStale: boolean;
  syncStatus: DocumentSyncStatus | null;
  updateCompleted: boolean;
  qbDocumentId: string | null;
  emailHistory: DocumentEmailHistoryItem[];
  loadingHistory: boolean;
  hasValidToRecipients: boolean;
  modalTitle: string;
  onClose: () => void;
  onEmailConfigChange: (config: InvoiceEmailConfig) => void;
  onPickupChange: (checked: boolean) => void;
  onShippingChange: (checked: boolean) => void;
  onCompletedChange: (checked: boolean) => void;
  onEmailTypeChange: (id: string, newType: 'to' | 'cc' | 'bcc') => void;
  onDocumentOnly: () => void;
  onUpdateDocument: () => void;
  onSendEmail: () => void;
  onMarkAsSent: () => void;
  onShowScheduleModal: () => void;
  onSkip: () => void;
  onReassign?: (isDeleted: boolean) => void;
}> = ({
  mode, documentType, order, config, isMobile, loading, error,
  emailConfig, documentEmailData, recipientEntries, loadingPreview,
  pickupChecked, shippingChecked, completedChecked,
  checkingSync, isStale, syncStatus, updateCompleted,
  qbDocumentId, emailHistory, loadingHistory,
  hasValidToRecipients, modalTitle,
  onClose, onEmailConfigChange, onPickupChange, onShippingChange, onCompletedChange,
  onEmailTypeChange, onDocumentOnly, onUpdateDocument, onSendEmail,
  onMarkAsSent, onShowScheduleModal, onSkip, onReassign,
}) => (
  <div className={`${isMobile ? 'flex-1 overflow-hidden' : 'w-[37%] border-r border-gray-200'} flex flex-col`}>
    {/* Header - Desktop only */}
    {!isMobile && (
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {mode === 'update' && <RefreshCw className="w-6 h-6 text-orange-500" />}
            {mode === 'send' && <Send className="w-6 h-6 text-blue-600" />}
            {mode === 'view' && <Eye className="w-6 h-6 text-gray-600" />}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{modalTitle}</h2>
              <p className="text-sm text-gray-600">#{order.order_number} - {order.order_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {qbDocumentId && (
            <button
              onClick={() => {
                const url = documentType === 'invoice'
                  ? `https://qbo.intuit.com/app/invoice?txnId=${qbDocumentId}`
                  : `https://qbo.intuit.com/app/estimate?txnId=${qbDocumentId}`;
                window.open(url, '_blank');
              }}
              className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              <span>Open in QuickBooks</span>
            </button>
          )}
          {onReassign && (
            <button
              onClick={() => onReassign(syncStatus === 'not_found')}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium border border-gray-300"
            >
              <span>Reassign</span>
            </button>
          )}
        </div>
      </div>
    )}

    {/* Form Content */}
    <div className={`flex-1 overflow-y-auto min-h-0 ${isMobile ? 'p-4' : 'p-6'} space-y-6`}>
      {checkingSync && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-700">Checking sync status with QuickBooks...</span>
          </div>
        </div>
      )}

      {mode === 'view' && isStale && !checkingSync && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-orange-800">{config.labels.documentName} Out of Date</h4>
              <p className="text-sm text-orange-700 mt-1">Order data has changed since this {config.labels.documentName.toLowerCase()} was created.</p>
              <button
                onClick={onUpdateDocument}
                disabled={loading}
                className="mt-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {loading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {order.invoice_notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />Invoice Notes
          </h4>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{order.invoice_notes}</p>
        </div>
      )}

      {/* Recipients Table */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Mail className="w-4 h-4 inline-block mr-1" />Recipients
        </label>
        {recipientEntries.length === 0 ? (
          <div className="text-sm text-gray-500 italic py-3 text-center border border-gray-200 rounded-lg bg-gray-50">
            No recipients configured. Add accounting emails or point persons on the order page.
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_50px_50px_50px] bg-gray-100 border-b border-gray-200 text-xs font-medium text-gray-600">
              <div className="px-3 py-2">Contact</div>
              <div className="px-2 py-2 text-center">To</div>
              <div className="px-2 py-2 text-center">CC</div>
              <div className="px-2 py-2 text-center">BCC</div>
            </div>
            <div className="divide-y divide-gray-100">
              {recipientEntries.map((entry) => (
                <div key={entry.id} className={`grid grid-cols-[1fr_50px_50px_50px] items-center ${entry.source === 'accounting' ? 'bg-green-50' : 'bg-white'} hover:bg-gray-50`}>
                  <div className="px-3 py-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <UserCircle className={`w-4 h-4 flex-shrink-0 ${entry.source === 'accounting' ? 'text-green-600' : 'text-gray-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 truncate">{entry.name || entry.email}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${entry.source === 'accounting' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{entry.label || 'Contact'}</span>
                        </div>
                        {entry.name && <p className="text-xs text-gray-500 truncate">{entry.email}</p>}
                      </div>
                    </div>
                  </div>
                  {(['to', 'cc', 'bcc'] as const).map(type => (
                    <div key={type} className="px-2 py-2 text-center">
                      <input type="checkbox" checked={entry.emailType === type} onChange={() => onEmailTypeChange(entry.id, type)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1.5">Select TO, CC, or BCC for each recipient. Manage contacts on the order page.</p>
      </div>

      <InvoiceEmailComposer
        documentType={documentType} config={emailConfig} onChange={onEmailConfigChange}
        invoiceData={documentEmailData} disabled={loadingPreview}
        pickupChecked={pickupChecked} shippingChecked={shippingChecked} completedChecked={completedChecked}
        onPickupChange={onPickupChange} onShippingChange={onShippingChange} onCompletedChange={onCompletedChange}
        orderStatus={order.status}
      />

      {mode === 'view' && (
        <div className="bg-gray-50 rounded-lg p-4 border-t border-gray-200 mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center"><Clock className="w-4 h-4 mr-2" />Email History</h3>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Loading history...</span></div>
          ) : emailHistory.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No emails sent yet</p>
          ) : (
            <div className="space-y-2">
              {[...emailHistory].sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              }).map((email) => (
                <div key={email.id} className={`bg-white border rounded-lg p-3 text-sm ${email.status === 'pending' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-medium text-gray-900 break-words flex-1">{email.subject}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${email.status === 'sent' ? 'bg-green-100 text-green-700' : email.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : email.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {email.status === 'pending' ? 'scheduled' : email.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">To: {email.recipientEmails.join(', ')}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {email.sentAt ? `Sent: ${new Date(email.sentAt).toLocaleString()}` : email.status === 'pending' ? `Scheduled: ${new Date(email.scheduledFor).toLocaleString()}` : `Created: ${new Date(email.createdAt).toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
    </div>

    {/* Footer Actions */}
    <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} border-t border-gray-200 bg-white flex-shrink-0`}>
      <div className={`flex items-center ${isMobile ? 'flex-col gap-3' : 'justify-between gap-3'}`}>
        <div className={`flex items-center gap-2 ${isMobile ? 'w-full order-1' : ''}`}>
          {mode === 'update' && (
            <button onClick={onDocumentOnly} disabled={loading} className={`rounded-lg disabled:opacity-50 text-sm bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-medium ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-3 py-2'}`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Update'}
            </button>
          )}
          {config.features.hasSchedule && (
            <button
              onClick={onShowScheduleModal}
              disabled={loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)}
              className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'} ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-4 py-2'}`}
            >
              <Clock className="w-4 h-4" />{!isMobile && 'Schedule'}
            </button>
          )}
          <button
            onClick={onSendEmail}
            disabled={loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)}
            className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'} ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-4 py-2'}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {mode === 'view' ? 'Resend' : 'Send'}
          </button>
          {config.features.hasMarkAsSent && mode !== 'view' && (
            <button
              onClick={onMarkAsSent}
              disabled={loading || (mode === 'update' && !updateCompleted)}
              className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${loading || (mode === 'update' && !updateCompleted) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800'} ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-4 py-2'}`}
              title={`Mark ${config.labels.documentName.toLowerCase()} as sent without sending an email`}
            >
              <CheckCircle className="w-4 h-4" />{!isMobile && 'Mark Sent'}
            </button>
          )}
        </div>
        <button onClick={onSkip} className={`text-gray-600 hover:text-gray-800 active:text-gray-900 text-sm ${isMobile ? 'w-full py-3 min-h-[44px] order-2' : 'px-4 py-2'}`}>
          Cancel
        </button>
      </div>
    </div>
  </div>
);

export const PreviewPanel: React.FC<{
  config: DocumentConfig;
  isMobile: boolean;
  loadingPreview: boolean;
  previewHtml: string;
  previewTab: 'email' | 'document';
  qbDocumentId: string | null;
  documentPdf: string | null;
  loadingPdf: boolean;
  pdfError: string | null;
  order: Order;
  displayParts: DisplayPart[];
  totals: TotalsResult;
  onPreviewTabChange: (tab: 'email' | 'document') => void;
  onLoadDocumentPdf: () => void;
}> = ({
  config, isMobile, loadingPreview, previewHtml, previewTab,
  qbDocumentId, documentPdf, loadingPdf, pdfError,
  order, displayParts, totals,
  onPreviewTabChange, onLoadDocumentPdf,
}) => (
  <div className={`${isMobile ? 'flex-1 overflow-hidden' : 'w-[63%]'} bg-gray-50 flex flex-col`}>
    {/* Preview Tabs */}
    {!isMobile && (
      <div className="flex border-b border-gray-300 px-6 pt-3 pb-0 bg-gray-200">
        <button onClick={() => onPreviewTabChange('email')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${previewTab === 'email' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-gray-900'}`}>
          <Eye className="w-4 h-4 inline-block mr-1.5" />Email Preview
        </button>
        <button onClick={() => onPreviewTabChange('document')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${previewTab === 'document' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-gray-900'}`}>
          <FileText className="w-4 h-4 inline-block mr-1.5" />{config.labels.documentName} Details
        </button>
      </div>
    )}
    {isMobile && (
      <div className="flex border-b border-gray-300 bg-gray-100 flex-shrink-0">
        <button onClick={() => onPreviewTabChange('email')} className={`flex-1 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${previewTab === 'email' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-600'}`}>Email</button>
        <button onClick={() => onPreviewTabChange('document')} className={`flex-1 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${previewTab === 'document' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-600'}`}>{config.labels.documentName}</button>
      </div>
    )}

    <div className={`flex-1 min-h-0 ${previewTab === 'email' ? 'overflow-hidden' : qbDocumentId ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
      {previewTab === 'email' ? (
        loadingPreview ? (
          <div className="flex items-center justify-center h-full bg-white"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /><span className="ml-2 text-gray-500">Loading preview...</span></div>
        ) : previewHtml ? (
          <iframe srcDoc={previewHtml} title="Email Preview" className="w-full h-full border-0 bg-white" sandbox="allow-same-origin" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 bg-white">No email preview available</div>
        )
      ) : qbDocumentId ? (
        loadingPdf ? (
          <div className="flex items-center justify-center h-full bg-white"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /><span className="ml-2 text-gray-500">Loading {config.labels.documentName.toLowerCase()} PDF...</span></div>
        ) : documentPdf ? (
          <iframe src={`data:application/pdf;base64,${documentPdf}#view=FitH`} title={`${config.labels.documentName} PDF`} className="w-full h-full border-0" />
        ) : pdfError ? (
          <div className="flex flex-col items-center justify-center h-full bg-white text-gray-500">
            <FileText className="w-12 h-12 text-gray-300 mb-3" /><p className="text-sm">Failed to load PDF</p><p className="text-xs text-gray-400 mt-1">{pdfError}</p>
            <button onClick={onLoadDocumentPdf} className="mt-3 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800">Try Again</button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full bg-white text-gray-500">No PDF available</div>
        )
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 overflow-y-auto h-full">
          <div className="flex justify-between items-start mb-6 pb-4 border-b">
            <div>
              <h4 className="text-lg font-bold text-gray-900">{config.labels.documentName.toUpperCase()} PREVIEW</h4>
              <p className="text-sm text-gray-600">#{order.order_number}</p>
              <p className="text-xs text-amber-600 mt-1">Not yet created in QuickBooks</p>
            </div>
            <div className="text-right text-sm"><p className="font-medium">{order.customer_name}</p><p className="text-gray-600">{new Date().toLocaleDateString()}</p></div>
          </div>
          <table className="w-full text-sm mb-6">
            <thead><tr className="border-b"><th className="text-left py-2 font-medium text-gray-700">Description</th><th className="text-right py-2 font-medium text-gray-700 w-16">Qty</th><th className="text-right py-2 font-medium text-gray-700 w-24">Price</th><th className="text-right py-2 font-medium text-gray-700 w-24">Amount</th></tr></thead>
            <tbody>
              {displayParts.map((part, idx) => (
                part.is_header_row ? (
                  <tr key={idx} className="bg-gray-100"><td colSpan={4} className="py-2 px-2 font-semibold text-gray-900">{part.qb_description || part.invoice_description || 'Section Header'}</td></tr>
                ) : (
                  <tr key={idx} className="border-b border-gray-300">
                    <td className="py-2 text-gray-900">{part.invoice_description || part.qb_description || part.product_type}</td>
                    <td className="py-2 text-right text-gray-600">{part.quantity}</td>
                    <td className="py-2 text-right text-gray-600">${Number(part.unit_price || 0).toFixed(2)}</td>
                    <td className="py-2 text-right text-gray-900">${Number(part.extended_price || 0).toFixed(2)}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
          <div className="space-y-2 text-sm">
            <div className="flex justify-end"><span className="w-32 text-gray-600">Subtotal:</span><span className="w-24 text-right font-medium">${totals.subtotal.toFixed(2)}</span></div>
            {!order.cash && (
              <div className="flex justify-end">
                <span className={`w-32 ${totals.taxNotFound ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{totals.taxNotFound ? `${totals.taxName} (NOT FOUND):` : `Tax (${totals.taxName || 'Tax'} ${(totals.taxRate * 100).toFixed(0)}%):`}</span>
                <span className={`w-24 text-right font-medium ${totals.taxNotFound ? 'text-red-600' : ''}`}>{totals.taxNotFound ? 'ERROR' : `$${totals.tax.toFixed(2)}`}</span>
              </div>
            )}
            <div className="flex justify-end border-t pt-2 mt-2"><span className="w-32 font-semibold text-gray-900">Total:</span><span className="w-24 text-right font-bold text-gray-900">${totals.total.toFixed(2)}</span></div>
          </div>
        </div>
      )}
    </div>
  </div>
);
