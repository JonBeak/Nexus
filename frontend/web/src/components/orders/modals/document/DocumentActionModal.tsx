/**
 * Document Action Modal (Unified) - Orchestrator
 *
 * Combined modal for Create/Update/Send/View workflow for both invoices and estimates.
 * State and memos live here; effects, handlers, and rendering are extracted to:
 * - useDocumentModalInit.ts  (initialization effects)
 * - useDocumentHandlers.ts   (all handler functions)
 * - CreateInvoiceView.tsx    (invoice create mode)
 * - CreateEstimateView.tsx   (estimate create mode)
 * - DocumentSendView.tsx     (update/send/view modes)
 * - DocumentScheduleModal.tsx (schedule sub-modal)
 */

import React, { useState, useMemo, useRef } from 'react';
import { Order } from '../../../../types/orders';
import { Address } from '../../../../types';
import {
  DocumentType,
  DocumentSyncStatus,
  DocumentDifference,
  DocumentRecipientEntry,
  DocumentEmailHistoryItem,
  getDocumentConfig,
} from '../../../../types/document';
import { createDocumentApi } from './documentApi';
import { DocumentConflictModal } from './DocumentConflictModal';
import { useModalBackdrop } from '../../../../hooks/useModalBackdrop';
import { CustomerInvoiceListItem, InvoiceLineItem, InvoicePreviewLineItem } from '../../../../services/api';
import {
  InvoiceEmailConfig,
  InvoiceEmailData,
  DEFAULT_INVOICE_SUMMARY_CONFIG,
  DEFAULT_ESTIMATE_SUMMARY_CONFIG,
  DEFAULT_INVOICE_BEGINNING,
  DEFAULT_INVOICE_END
} from '../InvoiceEmailComposer';
import { InvoiceSentSuccessModal } from '../InvoiceSentSuccessModal';
import { useDocumentModalInit } from './useDocumentModalInit';
import { useDocumentHandlers } from './useDocumentHandlers';
import { CreateInvoiceView } from './CreateInvoiceView';
import { CreateEstimateView } from './CreateEstimateView';
import { DocumentSendView } from './DocumentSendView';
import { DocumentScheduleModal } from './DocumentScheduleModal';

interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

export type DocumentMode = 'create' | 'update' | 'send' | 'view';

interface DocumentActionModalProps {
  documentType: DocumentType;
  mode: DocumentMode;
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSuccess: () => void;
  onCreated?: () => void;
  onSkip?: () => void;
  onReassign?: (isDeleted: boolean) => void;
  onLinkExisting?: () => void;
  taxRules?: TaxRule[];
}

interface DocumentLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export const DocumentActionModal: React.FC<DocumentActionModalProps> = ({
  documentType, mode, isOpen, onClose, order, onSuccess,
  onCreated, onSkip, onReassign, onLinkExisting, taxRules = []
}) => {
  const config = getDocumentConfig(documentType);
  const api = createDocumentApi(documentType);

  const qbDocumentId = documentType === 'invoice' ? order.qb_invoice_id : order.qb_estimate_id;
  const qbDocumentNumber = documentType === 'invoice' ? order.qb_invoice_doc_number : order.qb_estimate_doc_number;

  // -- State declarations --
  const [recipientEntries, setRecipientEntries] = useState<DocumentRecipientEntry[]>([]);
  const [subject, setSubject] = useState('');
  const [emailConfig, setEmailConfig] = useState<InvoiceEmailConfig>(() => ({
    subject: '',
    beginning: DEFAULT_INVOICE_BEGINNING,
    end: DEFAULT_INVOICE_END,
    summaryConfig: documentType === 'estimate' ? DEFAULT_ESTIMATE_SUMMARY_CONFIG : DEFAULT_INVOICE_SUMMARY_CONFIG,
    includePayButton: documentType === 'invoice'
  }));
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    recipients: { to: string[]; cc: string[]; bcc: string[] };
    scheduledFor?: string;
    wasResent?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [previewTab, setPreviewTab] = useState<'email' | 'document'>('email');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [pickupChecked, setPickupChecked] = useState(false);
  const [shippingChecked, setShippingChecked] = useState(false);
  const [completedChecked, setCompletedChecked] = useState(false);
  const [qbDocumentData, setQbDocumentData] = useState<any>(null);
  const [loadingQbDocument, setLoadingQbDocument] = useState(false);
  const [emailHistory, setEmailHistory] = useState<DocumentEmailHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [checkingStaleness, setCheckingStaleness] = useState(false);
  const [updateCompleted, setUpdateCompleted] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<DocumentSyncStatus | null>(null);
  const [syncDifferences, setSyncDifferences] = useState<DocumentDifference[]>([]);
  const [checkingSync, setCheckingSync] = useState(false);
  const [documentPdf, setDocumentPdf] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [selectedLinkInvoice, setSelectedLinkInvoice] = useState<CustomerInvoiceListItem | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [mobileCreateTab, setMobileCreateTab] = useState<'create' | 'link'>('create');
  const [previewInvoice, setPreviewInvoice] = useState<CustomerInvoiceListItem | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<Record<string, InvoiceLineItem[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [invoicePreviewLines, setInvoicePreviewLines] = useState<InvoicePreviewLineItem[]>([]);
  const [loadingInvoicePreview, setLoadingInvoicePreview] = useState(false);
  const [companySettings, setCompanySettings] = useState<{ company_name: string | null; company_address: string | null } | null>(null);
  const [customerBillingAddress, setCustomerBillingAddress] = useState<Address | null>(null);

  // Refs
  const linkModalRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  // -- Memos --
  const templateKey = useMemo(() => {
    if (documentType === 'estimate') return 'estimate';
    if (!order.deposit_required) return 'full_invoice';
    const depositPaid = !!(order.qb_invoice_id &&
      order.cached_balance != null && order.cached_invoice_total != null &&
      order.cached_balance < order.cached_invoice_total);
    return depositPaid ? 'full_invoice' : 'deposit_request';
  }, [documentType, order.deposit_required, order.qb_invoice_id, order.cached_balance, order.cached_invoice_total]);

  const lineItems = useMemo((): DocumentLineItem[] => {
    if (!order.parts) return [];
    return order.parts
      .filter(part => part.quantity && part.quantity > 0 && !part.is_header_row)
      .map(part => {
        const qty = Number(part.quantity) || 1;
        const unitPrice = Number(part.unit_price) || 0;
        const extPrice = Number(part.extended_price) || (qty * unitPrice);
        return { description: part.invoice_description || part.qb_description || part.product_type, quantity: qty, unitPrice, amount: extPrice };
      });
  }, [order.parts]);

  const displayParts = useMemo(() => {
    if (!order.parts) return [];
    return order.parts.filter(p => p.is_header_row || (p.quantity && p.quantity > 0));
  }, [order.parts]);

  const invoiceDisplayParts = useMemo(() => {
    if (documentType === 'invoice' && invoicePreviewLines.length > 0) {
      return invoicePreviewLines.map((line, idx) => ({
        key: idx, qb_item_name: line.qbItemName, qb_description: line.description,
        quantity: line.quantity, unit_price: line.unitPrice, extended_price: line.amount,
        is_header_row: line.isHeaderRow, is_description_only: line.isDescriptionOnly
      }));
    }
    return displayParts.map((part, idx) => ({
      key: idx, qb_item_name: part.qb_item_name, qb_description: part.qb_description || '',
      quantity: part.quantity, unit_price: part.unit_price, extended_price: part.extended_price,
      is_header_row: part.is_header_row, is_description_only: false
    }));
  }, [documentType, invoicePreviewLines, displayParts]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const isCashJob = !!order.cash;
    const hasTaxName = !!order.tax_name;
    const taxRule = hasTaxName ? taxRules.find(r => r.tax_name === order.tax_name) : null;
    const taxNotFound = hasTaxName && !isCashJob && taxRules.length > 0 && !taxRule;
    const taxRate = isCashJob ? 0 : (taxRule ? parseFloat(taxRule.tax_percent.toString()) : 0);
    const tax = taxNotFound ? 0 : subtotal * taxRate;
    const total = taxNotFound ? subtotal : subtotal + tax;
    const deposit = order.deposit_required ? total * 0.5 : 0;
    return { subtotal, tax, taxRate, total, deposit, taxNotFound, taxName: order.tax_name };
  }, [lineItems, order.cash, order.deposit_required, order.tax_name, taxRules]);

  const documentEmailData: InvoiceEmailData = useMemo(() => ({
    jobName: order.order_name, jobNumber: order.customer_job_number || undefined,
    customerPO: order.customer_po || undefined, customerJobNumber: order.customer_job_number,
    orderNumber: order.order_number,
    invoiceNumber: documentType === 'invoice' ? (order.qb_invoice_doc_number || undefined) : undefined,
    invoiceDate: documentType === 'invoice' ? new Date().toISOString() : undefined,
    dueDate: documentType === 'invoice' ? (qbDocumentData?.dueDate || undefined) : undefined,
    estimateNumber: documentType === 'estimate' ? (order.qb_estimate_doc_number || undefined) : undefined,
    estimateDate: documentType === 'estimate' ? new Date().toISOString() : undefined,
    subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
    balanceDue: documentType === 'invoice'
      ? (qbDocumentData?.balance ?? totals.total)
      : (order.cached_balance !== null && order.cached_balance !== undefined && order.cached_balance > 0
          ? order.cached_balance : undefined)
  }), [order, totals, qbDocumentData, documentType]);

  // Modal backdrop
  const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp, isMobile } = useModalBackdrop({
    isOpen, onClose, preventClose: showScheduleModal || showConflictModal || showSuccessModal,
  });

  // -- Hooks --
  const { checkSyncStatus, loadDocumentPdf } = useDocumentModalInit({
    isOpen, isInitialized, mode, documentType, order, templateKey,
    qbDocumentId, qbDocumentNumber, totals, emailConfig, documentEmailData, config, api,
    qbDocumentData,
    setIsInitialized, setLoadingPreview, setError, setSubject, setEmailConfig,
    setPickupChecked, setShippingChecked, setCompletedChecked, setRecipientEntries,
    setQbDocumentData, setCompanySettings, setCustomerBillingAddress, setEmailHistory,
    setDocumentPdf, setPreviewHtml, setScheduledDate, setScheduledTime, setShowScheduleModal,
    setShowConflictModal, setSyncStatus, setSyncDifferences, setIsStale, setUpdateCompleted,
    setPdfError, setLoadingPdf, setCheckingSync, setCheckingStaleness,
    setShowSuccessModal, setSuccessModalData, setSelectedLinkInvoice, setLinking, setLinkError,
    setMobileCreateTab, setInvoicePreviewLines, setLoadingInvoicePreview,
  });

  const handlers = useDocumentHandlers({
    mode, documentType, order, config, api,
    subject, previewHtml, recipientEntries, selectedLinkInvoice, invoiceDetails,
    pickupChecked, shippingChecked, completedChecked, loading, updateCompleted, isStale,
    scheduledDate, scheduledTime,
    setSubject, setEmailConfig, setPickupChecked, setShippingChecked, setCompletedChecked,
    setLoading, setError, setIsStale, setUpdateCompleted, setDocumentPdf, setPdfError,
    setQbDocumentData, setShowScheduleModal, setShowSuccessModal, setSuccessModalData,
    setRecipientEntries, setSelectedLinkInvoice, setLinking, setLinkError,
    setPreviewInvoice: setPreviewInvoice, setInvoiceDetails, setLoadingDetails,
    onSuccess, onClose, onSkip, onCreated, loadDocumentPdf, checkSyncStatus,
  });

  // Computed values
  const hasValidToRecipients = recipientEntries.some(r => r.email?.trim() && r.emailType === 'to');

  const formatAddress = (addr: Address | null): string => {
    if (!addr) return 'No address on file';
    const parts = [
      addr.address_line1, addr.address_line2,
      [addr.city, addr.province_state_short, addr.postal_zip].filter(Boolean).join(', ')
    ].filter(Boolean);
    return parts.join('\n');
  };

  const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const modalTitle = { create: config.title.create, update: config.title.update, send: config.title.send, view: config.title.view }[mode];

  if (!isOpen) return null;

  // -- Render by mode --
  if (mode === 'create') {
    if (documentType === 'invoice') {
      return (
        <CreateInvoiceView
          order={order} isMobile={isMobile} isInitialized={isInitialized}
          loading={loading} linking={linking} error={error} linkError={linkError}
          loadingInvoicePreview={loadingInvoicePreview} invoiceDisplayParts={invoiceDisplayParts}
          totals={totals} companySettings={companySettings} customerBillingAddress={customerBillingAddress}
          formattedDate={formattedDate} selectedLinkInvoice={selectedLinkInvoice}
          previewInvoice={previewInvoice} invoiceDetails={invoiceDetails} loadingDetails={loadingDetails}
          mobileCreateTab={mobileCreateTab} qbDocumentNumber={qbDocumentNumber}
          showSuccessModal={showSuccessModal} successModalData={successModalData}
          modalContentRef={modalContentRef} linkModalRef={linkModalRef} previewPanelRef={previewPanelRef}
          onClose={onClose} onSkip={onSkip}
          onBackdropMouseDown={handleBackdropMouseDown} onBackdropMouseUp={handleBackdropMouseUp}
          onMobileCreateTabChange={setMobileCreateTab} onSelectLinkInvoice={setSelectedLinkInvoice}
          onDocumentOnly={handlers.handleDocumentOnly} onLinkInvoiceFromCreate={handlers.handleLinkInvoiceFromCreate}
          onInvoicePreview={handlers.handleInvoicePreview} onClosePreview={handlers.closePreview}
          onSuccessModalClose={handlers.handleSuccessModalClose} formatAddress={formatAddress}
        />
      );
    }

    return (
      <CreateEstimateView
        order={order} config={config} isMobile={isMobile} isInitialized={isInitialized}
        loading={loading} error={error} displayParts={displayParts} totals={totals}
        companySettings={companySettings} customerBillingAddress={customerBillingAddress}
        formattedDate={formattedDate} modalTitle={modalTitle} qbDocumentNumber={qbDocumentNumber}
        showSuccessModal={showSuccessModal} successModalData={successModalData}
        modalContentRef={modalContentRef}
        onClose={onClose} onSkip={onSkip} onLinkExisting={onLinkExisting}
        onDocumentOnly={handlers.handleDocumentOnly}
        onBackdropMouseDown={handleBackdropMouseDown} onBackdropMouseUp={handleBackdropMouseUp}
        onSuccessModalClose={handlers.handleSuccessModalClose} formatAddress={formatAddress}
      />
    );
  }

  // UPDATE/SEND/VIEW modes
  return (
    <>
      <DocumentSendView
        mode={mode} documentType={documentType} order={order} config={config}
        isMobile={isMobile} isInitialized={isInitialized} loading={loading}
        loadingPreview={loadingPreview} error={error} emailConfig={emailConfig}
        documentEmailData={documentEmailData} recipientEntries={recipientEntries}
        previewHtml={previewHtml} previewTab={previewTab} mobileTab={mobileTab}
        pickupChecked={pickupChecked} shippingChecked={shippingChecked} completedChecked={completedChecked}
        checkingSync={checkingSync} isStale={isStale} syncStatus={syncStatus} updateCompleted={updateCompleted}
        qbDocumentId={qbDocumentId} documentPdf={documentPdf} loadingPdf={loadingPdf} pdfError={pdfError}
        emailHistory={emailHistory} loadingHistory={loadingHistory}
        displayParts={displayParts} totals={totals} hasValidToRecipients={hasValidToRecipients}
        modalTitle={modalTitle} modalContentRef={modalContentRef}
        onClose={onClose}
        onBackdropMouseDown={handleBackdropMouseDown} onBackdropMouseUp={handleBackdropMouseUp}
        onMobileTabChange={setMobileTab} onPreviewTabChange={setPreviewTab}
        onEmailConfigChange={handlers.handleEmailConfigChange}
        onPickupChange={handlers.handlePickupChange} onShippingChange={handlers.handleShippingChange}
        onCompletedChange={handlers.handleCompletedChange}
        onEmailTypeChange={handlers.handleEmailTypeChange}
        onDocumentOnly={handlers.handleDocumentOnly} onUpdateDocument={handlers.handleUpdateDocument}
        onSendEmail={handlers.handleSendEmail} onMarkAsSent={handlers.handleMarkAsSent}
        onShowScheduleModal={() => setShowScheduleModal(true)} onSkip={handlers.handleSkip}
        onLoadDocumentPdf={loadDocumentPdf} onReassign={onReassign}
      />

      {showScheduleModal && (
        <DocumentScheduleModal
          isMobile={isMobile} loading={loading}
          scheduledDate={scheduledDate} scheduledTime={scheduledTime}
          onScheduledDateChange={setScheduledDate} onScheduledTimeChange={setScheduledTime}
          onConfirm={handlers.handleScheduleConfirm} onClose={() => setShowScheduleModal(false)}
        />
      )}

      <DocumentConflictModal
        documentType={documentType} isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        orderNumber={order.order_number} orderName={order.order_name}
        syncStatus={syncStatus || 'in_sync'} differences={syncDifferences}
        onResolved={async () => {
          setShowConflictModal(false);
          setSyncStatus(null);
          setSyncDifferences([]);
          setIsStale(false);
          setDocumentPdf(null);
          setPdfError(null);
          setQbDocumentData(null);
          await loadDocumentPdf();
          await checkSyncStatus();
        }}
      />

      <InvoiceSentSuccessModal
        isOpen={showSuccessModal} onClose={handlers.handleSuccessModalClose}
        orderNumber={order.order_number} orderName={order.order_name}
        invoiceNumber={qbDocumentNumber || undefined}
        recipients={successModalData?.recipients || { to: [], cc: [], bcc: [] }}
        scheduledFor={successModalData?.scheduledFor} wasResent={successModalData?.wasResent}
      />
    </>
  );
};

export default DocumentActionModal;
