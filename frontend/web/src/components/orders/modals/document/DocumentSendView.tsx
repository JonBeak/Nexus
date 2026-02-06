/**
 * DocumentSendView - Update/Send/View mode layout
 *
 * Shared layout for update, send, and view modes.
 * Left panel (37%): Form - recipients, email composer, history, actions
 * Right panel (63%): Preview - email HTML iframe, PDF viewer, fallback table
 *
 * Sub-components in DocumentSendViewPanels.tsx
 */

import React from 'react';
import {
  X, Loader2, Send, RefreshCw, Mail, Eye,
} from 'lucide-react';
import { Order } from '../../../../types/orders';
import {
  DocumentType,
  DocumentSyncStatus,
  DocumentRecipientEntry,
  DocumentEmailHistoryItem,
  DocumentConfig,
} from '../../../../types/document';
import {
  InvoiceEmailConfig,
  InvoiceEmailData,
} from '../InvoiceEmailComposer';
import { DocumentMode } from './DocumentActionModal';
import { FormPanel, PreviewPanel } from './DocumentSendViewPanels';

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

export interface DocumentSendViewProps {
  mode: DocumentMode;
  documentType: DocumentType;
  order: Order;
  config: DocumentConfig;
  isMobile: boolean;
  isInitialized: boolean;
  loading: boolean;
  loadingPreview: boolean;
  error: string | null;
  emailConfig: InvoiceEmailConfig;
  documentEmailData: InvoiceEmailData;
  recipientEntries: DocumentRecipientEntry[];
  previewHtml: string;
  previewTab: 'email' | 'document';
  mobileTab: 'form' | 'preview';
  pickupChecked: boolean;
  shippingChecked: boolean;
  completedChecked: boolean;
  checkingSync: boolean;
  isStale: boolean;
  syncStatus: DocumentSyncStatus | null;
  updateCompleted: boolean;
  qbDocumentId: string | null;
  documentPdf: string | null;
  loadingPdf: boolean;
  pdfError: string | null;
  emailHistory: DocumentEmailHistoryItem[];
  loadingHistory: boolean;
  displayParts: DisplayPart[];
  totals: TotalsResult;
  hasValidToRecipients: boolean;
  modalTitle: string;
  modalContentRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onBackdropMouseDown: (e: React.MouseEvent) => void;
  onBackdropMouseUp: (e: React.MouseEvent) => void;
  onMobileTabChange: (tab: 'form' | 'preview') => void;
  onPreviewTabChange: (tab: 'email' | 'document') => void;
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
  onLoadDocumentPdf: () => void;
  onReassign?: (isDeleted: boolean) => void;
}

export const DocumentSendView: React.FC<DocumentSendViewProps> = ({
  mode, documentType, order, config, isMobile, isInitialized, loading,
  loadingPreview, error, emailConfig, documentEmailData, recipientEntries,
  previewHtml, previewTab, mobileTab,
  pickupChecked, shippingChecked, completedChecked,
  checkingSync, isStale, syncStatus, updateCompleted,
  qbDocumentId, documentPdf, loadingPdf, pdfError,
  emailHistory, loadingHistory,
  displayParts, totals, hasValidToRecipients, modalTitle,
  modalContentRef,
  onClose, onBackdropMouseDown, onBackdropMouseUp,
  onMobileTabChange, onPreviewTabChange,
  onEmailConfigChange, onPickupChange, onShippingChange, onCompletedChange,
  onEmailTypeChange, onDocumentOnly, onUpdateDocument, onSendEmail,
  onMarkAsSent, onShowScheduleModal, onSkip, onLoadDocumentPdf,
  onReassign,
}) => {
  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile ? '' : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={onBackdropMouseDown}
      onMouseUp={onBackdropMouseUp}
    >
      <div ref={modalContentRef} className={`bg-white shadow-2xl w-full flex ${
        isMobile ? 'flex-col h-full overflow-hidden' : 'rounded-lg w-[96%] max-w-[1475px] h-[95vh] overflow-hidden'
      }`}>
        {/* Mobile Tab Bar */}
        {isMobile && (
          <div className="flex-shrink-0 border-b border-gray-200 bg-white sticky top-0 z-10">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {mode === 'update' && <RefreshCw className="w-5 h-5 text-orange-500" />}
                  {mode === 'send' && <Send className="w-5 h-5 text-blue-600" />}
                  {mode === 'view' && <Eye className="w-5 h-5 text-gray-600" />}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
                    <p className="text-sm text-gray-600">#{order.order_number}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="flex">
              <button
                onClick={() => onMobileTabChange('form')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  mobileTab === 'form' ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-600'
                }`}
              >
                <Mail className="w-4 h-4 inline-block mr-1.5" />Email Setup
              </button>
              <button
                onClick={() => onMobileTabChange('preview')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  mobileTab === 'preview' ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-600'
                }`}
              >
                <Eye className="w-4 h-4 inline-block mr-1.5" />Preview
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {!isInitialized ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-gray-500 text-sm">Loading {config.labels.documentName.toLowerCase()}...</span>
            </div>
          </div>
        ) : (
          <>
            {(!isMobile || mobileTab === 'form') && (
              <FormPanel
                mode={mode} documentType={documentType} order={order} config={config}
                isMobile={isMobile} loading={loading} error={error}
                emailConfig={emailConfig} documentEmailData={documentEmailData}
                recipientEntries={recipientEntries} loadingPreview={loadingPreview}
                pickupChecked={pickupChecked} shippingChecked={shippingChecked} completedChecked={completedChecked}
                checkingSync={checkingSync} isStale={isStale} syncStatus={syncStatus} updateCompleted={updateCompleted}
                qbDocumentId={qbDocumentId} emailHistory={emailHistory} loadingHistory={loadingHistory}
                hasValidToRecipients={hasValidToRecipients} modalTitle={modalTitle}
                onClose={onClose} onEmailConfigChange={onEmailConfigChange}
                onPickupChange={onPickupChange} onShippingChange={onShippingChange} onCompletedChange={onCompletedChange}
                onEmailTypeChange={onEmailTypeChange} onDocumentOnly={onDocumentOnly}
                onUpdateDocument={onUpdateDocument} onSendEmail={onSendEmail}
                onMarkAsSent={onMarkAsSent} onShowScheduleModal={onShowScheduleModal}
                onSkip={onSkip} onReassign={onReassign}
              />
            )}

            {(!isMobile || mobileTab === 'preview') && (
              <PreviewPanel
                config={config} isMobile={isMobile} loadingPreview={loadingPreview}
                previewHtml={previewHtml} previewTab={previewTab}
                qbDocumentId={qbDocumentId} documentPdf={documentPdf}
                loadingPdf={loadingPdf} pdfError={pdfError}
                order={order} displayParts={displayParts} totals={totals}
                onPreviewTabChange={onPreviewTabChange} onLoadDocumentPdf={onLoadDocumentPdf}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
