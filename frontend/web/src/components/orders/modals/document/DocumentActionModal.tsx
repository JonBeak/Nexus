/**
 * Document Action Modal (Unified)
 *
 * Combined modal for Create/Update/Send/View workflow for both invoices and estimates.
 * Supports:
 * - create: Preview document, create in QB
 * - update: Compare & update (invoice) or recreate (estimate)
 * - send: Email composer with immediate/scheduled delivery
 * - view: PDF view, email history, resend
 *
 * Key differences by document type:
 * - Invoice: Full update support, balance display, pay button in email
 * - Estimate: Recreate instead of update, no balance, parts preview on create
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X, Loader2, Calendar, Send, FileText, RefreshCw, Clock, Mail, Eye,
  AlertTriangle, UserCircle, CheckCircle, Link as LinkIcon, Plus
} from 'lucide-react';
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
import { InvoiceLinkingPanel } from './InvoiceLinkingPanel';
import { useModalBackdrop } from '../../../../hooks/useModalBackdrop';
import { useAlert } from '../../../../contexts/AlertContext';
import { qbInvoiceApi, orderPreparationApi, customerApi, settingsApi, CustomerInvoiceListItem, InvoiceLineItem } from '../../../../services/api';
// Unified email composer for both invoices and estimates
import InvoiceEmailComposer, {
  InvoiceEmailConfig,
  InvoiceEmailData,
  DEFAULT_INVOICE_SUMMARY_CONFIG,
  DEFAULT_ESTIMATE_SUMMARY_CONFIG,
  DEFAULT_INVOICE_BEGINNING,
  DEFAULT_INVOICE_END
} from '../InvoiceEmailComposer';
import { InvoiceSentSuccessModal } from '../InvoiceSentSuccessModal';

interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

export type DocumentMode = 'create' | 'update' | 'send' | 'view';

interface DocumentActionModalProps {
  /** Document type determines behavior and available features */
  documentType: DocumentType;
  /** Modal mode */
  mode: DocumentMode;
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSuccess: () => void;
  /** For status change prompts - allows skipping */
  onSkip?: () => void;
  /** For reassigning to a different document */
  onReassign?: (isDeleted: boolean) => void;
  /** For linking to existing QB document instead of creating */
  onLinkExisting?: () => void;
  /** Tax rules for looking up actual tax rate */
  taxRules?: TaxRule[];
}

interface DocumentLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export const DocumentActionModal: React.FC<DocumentActionModalProps> = ({
  documentType,
  mode,
  isOpen,
  onClose,
  order,
  onSuccess,
  onSkip,
  onReassign,
  onLinkExisting,
  taxRules = []
}) => {
  const { showConfirmation } = useAlert();
  const config = getDocumentConfig(documentType);
  const api = createDocumentApi(documentType);

  // QB document ID from order
  const qbDocumentId = documentType === 'invoice' ? order.qb_invoice_id : order.qb_estimate_id;
  const qbDocumentNumber = documentType === 'invoice' ? order.qb_invoice_doc_number : order.qb_estimate_doc_number;

  // Form State - Recipients
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

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    recipients: { to: string[]; cc: string[]; bcc: string[] };
    scheduledFor?: string;
    wasResent?: boolean;
  } | null>(null);

  // UI State
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [previewTab, setPreviewTab] = useState<'email' | 'document'>('email');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Subject prefix state
  const [pickupChecked, setPickupChecked] = useState(false);
  const [shippingChecked, setShippingChecked] = useState(false);
  const [completedChecked, setCompletedChecked] = useState(false);

  // QB document data for Document Details tab
  const [qbDocumentData, setQbDocumentData] = useState<any>(null);
  const [loadingQbDocument, setLoadingQbDocument] = useState(false);

  // Email history for view mode
  const [emailHistory, setEmailHistory] = useState<DocumentEmailHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Staleness detection for view mode
  const [isStale, setIsStale] = useState(false);
  const [checkingStaleness, setCheckingStaleness] = useState(false);

  // Track if update mode has completed update (to enable Send/Schedule)
  const [updateCompleted, setUpdateCompleted] = useState(false);

  // Conflict detection
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<DocumentSyncStatus | null>(null);
  const [syncDifferences, setSyncDifferences] = useState<DocumentDifference[]>([]);
  const [checkingSync, setCheckingSync] = useState(false);

  // Document PDF for Document Details tab
  const [documentPdf, setDocumentPdf] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Mobile tab navigation for update/send/view modes
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');

  // Create mode: Two-panel state for invoices (left=create, right=link)
  const [selectedLinkInvoice, setSelectedLinkInvoice] = useState<CustomerInvoiceListItem | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  // Mobile: Tab to switch between Create and Link panels (invoice create mode only)
  const [mobileCreateTab, setMobileCreateTab] = useState<'create' | 'link'>('create');

  // Invoice preview panel state (third window for viewing invoice details)
  const [previewInvoice, setPreviewInvoice] = useState<CustomerInvoiceListItem | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<Record<string, InvoiceLineItem[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Refs for backdrop click handling
  const scheduleModalRef = useRef<HTMLDivElement>(null);
  const scheduleMouseDownOutsideRef = useRef(false);
  // Ref for link modal in two-window invoice create mode
  const linkModalRef = useRef<HTMLDivElement>(null);
  // Ref for preview panel in three-window invoice create mode
  const previewPanelRef = useRef<HTMLDivElement>(null);

  // Ref to track if prefix has been auto-applied
  const hasAutoAppliedPrefixRef = useRef(false);
  // Ref to prevent concurrent initialization
  const hasStartedInitRef = useRef(false);

  // Create mode: company and customer address data
  const [companySettings, setCompanySettings] = useState<{
    company_name: string | null;
    company_address: string | null;
  } | null>(null);
  const [customerBillingAddress, setCustomerBillingAddress] = useState<Address | null>(null);

  // Determine template based on order type and deposit payment status (invoice only)
  const templateKey = useMemo(() => {
    if (documentType === 'estimate') return 'estimate';
    if (!order.deposit_required) return 'full_invoice';
    const depositPaid = !!(order.qb_invoice_id &&
      order.cached_balance != null &&
      order.cached_invoice_total != null &&
      order.cached_balance < order.cached_invoice_total);
    return depositPaid ? 'full_invoice' : 'deposit_request';
  }, [documentType, order.deposit_required, order.qb_invoice_id, order.cached_balance, order.cached_invoice_total]);

  // Calculate line items from order parts
  const lineItems = useMemo((): DocumentLineItem[] => {
    if (!order.parts) return [];
    return order.parts
      .filter(part => part.quantity && part.quantity > 0 && !part.is_header_row)
      .map(part => {
        const qty = Number(part.quantity) || 1;
        const unitPrice = Number(part.unit_price) || 0;
        const extPrice = Number(part.extended_price) || (qty * unitPrice);
        return {
          description: part.invoice_description || part.qb_description || part.product_type,
          quantity: qty,
          unitPrice: unitPrice,
          amount: extPrice
        };
      });
  }, [order.parts]);

  // Parts for display (includes headers in original order)
  const displayParts = useMemo(() => {
    if (!order.parts) return [];
    return order.parts.filter(p => p.is_header_row || (p.quantity && p.quantity > 0));
  }, [order.parts]);

  // Calculate totals
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

  // Build document data for email composer preview
  const documentEmailData: InvoiceEmailData = useMemo(() => ({
    jobName: order.order_name,
    jobNumber: order.customer_job_number || undefined,
    customerPO: order.customer_po || undefined,
    customerJobNumber: order.customer_job_number,
    orderNumber: order.order_number,
    // Invoice-specific
    invoiceNumber: documentType === 'invoice' ? (order.qb_invoice_doc_number || undefined) : undefined,
    invoiceDate: documentType === 'invoice' ? new Date().toISOString() : undefined,
    dueDate: documentType === 'invoice' ? (qbDocumentData?.dueDate || undefined) : undefined,
    // Estimate-specific
    estimateNumber: documentType === 'estimate' ? (order.qb_estimate_doc_number || undefined) : undefined,
    estimateDate: documentType === 'estimate' ? new Date().toISOString() : undefined,
    // Common financial fields
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    balanceDue: documentType === 'invoice'
      ? (qbDocumentData?.balance ?? totals.total)
      : (order.cached_balance !== null && order.cached_balance !== undefined && order.cached_balance > 0
          ? order.cached_balance
          : undefined)
  }), [order, totals, qbDocumentData, documentType]);

  // Modal backdrop handling
  const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp, isMobile } = useModalBackdrop({
    isOpen,
    onClose,
    preventClose: showScheduleModal || showConflictModal || showSuccessModal,
  });

  // Schedule modal backdrop handlers
  const handleScheduleBackdropMouseDown = (e: React.MouseEvent) => {
    scheduleMouseDownOutsideRef.current = scheduleModalRef.current ? !scheduleModalRef.current.contains(e.target as Node) : false;
  };

  const handleScheduleBackdropMouseUp = (e: React.MouseEvent) => {
    if (scheduleMouseDownOutsideRef.current && scheduleModalRef.current && !scheduleModalRef.current.contains(e.target as Node)) {
      setShowScheduleModal(false);
    }
    scheduleMouseDownOutsideRef.current = false;
  };

  // CONSOLIDATED INITIALIZATION EFFECT
  useEffect(() => {
    if (!isOpen) {
      // Reset all state when modal closes
      setIsInitialized(false);
      setError(null);
      setScheduledDate('');
      setScheduledTime('09:00');
      setShowScheduleModal(false);
      setPickupChecked(false);
      setShippingChecked(false);
      setCompletedChecked(false);
      setQbDocumentData(null);
      setEmailHistory([]);
      setIsStale(false);
      setUpdateCompleted(false);
      setShowConflictModal(false);
      setSyncStatus(null);
      setSyncDifferences([]);
      setDocumentPdf(null);
      setPdfError(null);
      setRecipientEntries([]);
      setShowSuccessModal(false);
      setSuccessModalData(null);
      setPreviewHtml('');
      setEmailConfig({
        subject: '',
        beginning: DEFAULT_INVOICE_BEGINNING,
        end: DEFAULT_INVOICE_END,
        summaryConfig: documentType === 'estimate' ? DEFAULT_ESTIMATE_SUMMARY_CONFIG : DEFAULT_INVOICE_SUMMARY_CONFIG,
        includePayButton: documentType === 'invoice'
      });
      setCompanySettings(null);
      setCustomerBillingAddress(null);
      hasAutoAppliedPrefixRef.current = false;
      hasStartedInitRef.current = false;
      // Reset create mode two-panel state
      setSelectedLinkInvoice(null);
      setLinking(false);
      setLinkError(null);
      setMobileCreateTab('create');
      return;
    }

    const initializeModal = async () => {
      if (hasStartedInitRef.current) return;
      hasStartedInitRef.current = true;
      setLoadingPreview(true);

      try {
        const promises: Promise<any>[] = [];

        // Email preview (always needed for send/view modes)
        let emailPreviewPromise: Promise<any> | null = null;
        if (documentType === 'invoice') {
          emailPreviewPromise = qbInvoiceApi.getEmailPreview(order.order_number, templateKey);
          promises.push(emailPreviewPromise);
        } else {
          // For estimates, use a simpler preview fetch
          emailPreviewPromise = orderPreparationApi.getEstimateEmailPreview(order.order_number, {
            estimateData: {
              jobName: order.order_name,
              customerJobNumber: order.customer_job_number || undefined,
              subtotal: totals.subtotal,
              tax: totals.tax,
              total: totals.total,
            }
          }).catch(() => ({
            subject: `${order.order_name} | Estimate #${order.qb_estimate_doc_number || 'New'}`,
            html: ''
          }));
          promises.push(emailPreviewPromise);
        }

        // QB document data (if document exists and mode needs it)
        let qbDocPromise: Promise<any> | null = null;
        if (qbDocumentId && (mode === 'update' || mode === 'send' || mode === 'view')) {
          if (documentType === 'invoice') {
            qbDocPromise = qbInvoiceApi.getInvoice(order.order_number);
            promises.push(qbDocPromise);
          }
        }

        // Create mode data
        let createDataPromise: Promise<[any, any]> | null = null;
        if (mode === 'create') {
          createDataPromise = Promise.all([
            settingsApi.getCompanySettings(),
            customerApi.getAddresses(order.customer_id)
          ]);
          promises.push(createDataPromise);
        }

        // Email history (view mode only)
        let emailHistoryPromise: Promise<any> | null = null;
        if (mode === 'view') {
          emailHistoryPromise = api.getEmailHistory(order.order_number);
          promises.push(emailHistoryPromise);
        }

        // Document PDF (if QB document exists)
        let pdfPromise: Promise<any> | null = null;
        if (qbDocumentId) {
          pdfPromise = api.getPdf(order.order_number).catch(() => null);
          promises.push(pdfPromise);
        }

        await Promise.all(promises);

        // Get results
        const emailPreview = emailPreviewPromise ? await emailPreviewPromise : null;
        const qbData = qbDocPromise ? await qbDocPromise : null;
        const createData = createDataPromise ? await createDataPromise : null;
        const historyData = emailHistoryPromise ? await emailHistoryPromise : null;
        const pdfData = pdfPromise ? await pdfPromise : null;

        // Compute final subject with prefix
        let finalSubject = emailPreview?.subject || `${order.order_name} | ${config.labels.documentName} #${qbDocumentNumber || 'New'}`;
        let pickupCheck = false;
        let shippingCheck = false;
        let completedCheck = false;

        if (!hasAutoAppliedPrefixRef.current && documentType === 'invoice') {
          const status = order.status;
          if (!/^\[(Ready for Pickup|Ready for Shipping|Order Completed)\]/.test(finalSubject)) {
            if (status === 'pick_up') {
              hasAutoAppliedPrefixRef.current = true;
              pickupCheck = true;
              finalSubject = `[Ready for Pickup] ${finalSubject}`;
            } else if (status === 'shipping') {
              hasAutoAppliedPrefixRef.current = true;
              shippingCheck = true;
              finalSubject = `[Ready for Shipping] ${finalSubject}`;
            } else if (status === 'awaiting_payment') {
              hasAutoAppliedPrefixRef.current = true;
              completedCheck = true;
              finalSubject = `[Order Completed] ${finalSubject}`;
            }
          }
        }

        // Compute emailConfig with auto-enabled Balance Due if needed
        let summaryConfig = { ...DEFAULT_INVOICE_SUMMARY_CONFIG };
        if (documentType === 'invoice' && qbData?.balance !== undefined && qbData?.total !== undefined) {
          if (qbData.balance !== qbData.total) {
            summaryConfig.includeBalanceDue = true;
          }
        }

        const finalEmailConfig: InvoiceEmailConfig = {
          subject: finalSubject,
          beginning: DEFAULT_INVOICE_BEGINNING,
          end: DEFAULT_INVOICE_END,
          summaryConfig,
          includePayButton: documentType === 'invoice'
        };

        // Initialize recipients
        const entries: DocumentRecipientEntry[] = [];
        const addedEmails = new Set<string>();

        if (order.accounting_emails?.length > 0) {
          order.accounting_emails.forEach((ae, idx) => {
            entries.push({
              id: `accounting-${idx}`,
              source: 'accounting',
              email: ae.email,
              name: ae.label || 'Accounting',
              label: 'Accounting',
              emailType: ae.email_type || 'to'
            });
            addedEmails.add(ae.email.toLowerCase());
          });
        }

        if (order.point_persons?.length > 0) {
          order.point_persons.forEach((pp, idx) => {
            if (pp.contact_email && !addedEmails.has(pp.contact_email.toLowerCase())) {
              entries.push({
                id: `pp-${pp.id || idx}`,
                source: 'point_person',
                email: pp.contact_email,
                name: pp.contact_name,
                label: pp.contact_role || 'Point Person',
                emailType: 'to'
              });
              addedEmails.add(pp.contact_email.toLowerCase());
            }
          });
        }

        // SET ALL STATE AT ONCE
        setSubject(finalSubject);
        setEmailConfig(finalEmailConfig);
        setPickupChecked(pickupCheck);
        setShippingChecked(shippingCheck);
        setCompletedChecked(completedCheck);
        setRecipientEntries(entries);

        if (qbData) setQbDocumentData(qbData);
        if (createData) {
          setCompanySettings({
            company_name: createData[0].company_name,
            company_address: createData[0].company_address
          });
          const addressResponse = createData[1] as { addresses: Address[] };
          const addresses = addressResponse.addresses || [];
          const billingAddr = addresses.find(a => a.is_billing) || addresses.find(a => a.is_primary) || null;
          setCustomerBillingAddress(billingAddr);
        }
        if (historyData) setEmailHistory(historyData);
        if (pdfData?.pdf) setDocumentPdf(pdfData.pdf);

        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize modal:', err);
        const fallbackSubject = qbDocumentNumber
          ? `${order.order_name} | ${config.labels.documentName} #${qbDocumentNumber}`
          : `${order.order_name} | Order #${order.order_number}`;
        setSubject(fallbackSubject);
        setEmailConfig({
          subject: fallbackSubject,
          beginning: DEFAULT_INVOICE_BEGINNING,
          end: DEFAULT_INVOICE_END,
          summaryConfig: documentType === 'estimate' ? DEFAULT_ESTIMATE_SUMMARY_CONFIG : DEFAULT_INVOICE_SUMMARY_CONFIG,
          includePayButton: documentType === 'invoice'
        });
        setRecipientEntries([]);
        setIsInitialized(true);
      } finally {
        setLoadingPreview(false);
      }
    };

    initializeModal();
  }, [isOpen, mode, templateKey, order.order_number, qbDocumentId, order.customer_id, order.status, documentType]);

  // Fetch styled email preview from backend - ONLY after initialization
  useEffect(() => {
    if (!isOpen || !isInitialized) return;

    const fetchPreview = async () => {
      try {
        if (documentType === 'invoice') {
          const result = await qbInvoiceApi.getStyledEmailPreview(order.order_number, {
            subject: emailConfig.subject,
            beginning: emailConfig.beginning,
            end: emailConfig.end,
            summaryConfig: emailConfig.summaryConfig,
            includePayButton: emailConfig.includePayButton,
            invoiceData: {
              jobName: documentEmailData.jobName,
              jobNumber: documentEmailData.jobNumber,
              customerPO: documentEmailData.customerPO,
              invoiceNumber: documentEmailData.invoiceNumber,
              invoiceDate: documentEmailData.invoiceDate,
              dueDate: documentEmailData.dueDate,
              subtotal: documentEmailData.subtotal,
              tax: documentEmailData.tax,
              total: documentEmailData.total,
              balanceDue: documentEmailData.balanceDue,
              qbInvoiceUrl: qbDocumentData?.invoiceUrl
            }
          });
          setPreviewHtml(result.html);
        } else {
          // Estimate preview - convert frontend summary config to backend format
          const backendSummaryConfig = {
            includeJobName: emailConfig.summaryConfig.includeJobName,
            includeCustomerRef: emailConfig.summaryConfig.includeJobNumber, // Map Job # to Customer Ref
            includePO: emailConfig.summaryConfig.includePO,
            includeOrderNumber: emailConfig.summaryConfig.includeOrderNumber,
            includeQbEstimateNumber: emailConfig.summaryConfig.includeEstimateNumber,
            includeEstimateDate: emailConfig.summaryConfig.includeEstimateDate,
            includeValidUntilDate: emailConfig.summaryConfig.includeValidUntil,
            includeSubtotal: emailConfig.summaryConfig.includeSubtotal,
            includeTax: emailConfig.summaryConfig.includeTax,
            includeTotal: emailConfig.summaryConfig.includeTotal,
            includeBalance: emailConfig.summaryConfig.includeBalanceDue
          };
          const result = await orderPreparationApi.getEstimateEmailPreview(order.order_number, {
            subject: emailConfig.subject,
            beginning: emailConfig.beginning,
            end: emailConfig.end,
            summaryConfig: backendSummaryConfig,
            estimateData: {
              jobName: order.order_name,
              customerJobNumber: order.customer_job_number || undefined,
              customerPO: order.customer_po || undefined,
              orderNumber: order.order_number,
              qbEstimateNumber: order.qb_estimate_doc_number || undefined,
              subtotal: totals.subtotal,
              tax: totals.tax,
              total: totals.total,
              balance: order.cached_balance ?? undefined
            }
          });
          setPreviewHtml(result.html);
        }
      } catch (err) {
        console.error('Failed to fetch email preview:', err);
      }
    };

    const timeoutId = setTimeout(fetchPreview, 300);
    return () => clearTimeout(timeoutId);
  }, [isOpen, isInitialized, order.order_number, emailConfig, documentEmailData, qbDocumentData?.invoiceUrl, documentType, totals, order.order_name, order.customer_job_number, order.customer_po, order.qb_estimate_doc_number, order.cached_balance]);

  // Check sync status when modal opens with existing document
  useEffect(() => {
    if (isOpen && qbDocumentId && (mode === 'view' || mode === 'update')) {
      checkSyncStatus();
    }
  }, [isOpen, mode, qbDocumentId]);

  const checkSyncStatus = async () => {
    if (!qbDocumentId) return;

    try {
      setCheckingSync(true);
      setCheckingStaleness(true);
      const result = await api.compare(order.order_number);

      setSyncStatus(result.status);
      setSyncDifferences(result.differences || []);
      setIsStale(result.localChanged);

      if (result.status === 'qb_modified' || result.status === 'conflict') {
        setShowConflictModal(true);
      }
    } catch (err) {
      console.error('Failed to check sync status:', err);
      setIsStale(false);
      setSyncStatus(null);
    } finally {
      setCheckingSync(false);
      setCheckingStaleness(false);
    }
  };

  const loadDocumentPdf = async () => {
    try {
      setLoadingPdf(true);
      setPdfError(null);
      const result = await api.getPdf(order.order_number);
      setDocumentPdf(result.pdf);
    } catch (err) {
      console.error('Failed to load PDF:', err);
      setPdfError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Handle email config changes from composer
  const handleEmailConfigChange = (config: InvoiceEmailConfig) => {
    setEmailConfig(config);
    const newSubject = config.subject;
    setSubject(newSubject);

    if (!newSubject.startsWith('[Ready for Pickup]') && pickupChecked) {
      setPickupChecked(false);
    }
    if (!newSubject.startsWith('[Ready for Shipping]') && shippingChecked) {
      setShippingChecked(false);
    }
    if (!newSubject.startsWith('[Order Completed]') && completedChecked) {
      setCompletedChecked(false);
    }
  };

  // Checkbox handlers
  const handlePickupChange = (checked: boolean) => {
    if (checked) {
      setShippingChecked(false);
      setCompletedChecked(false);
      const cleanSubject = subject.replace(/^\[(Ready for Pickup|Ready for Shipping|Order Completed)\]\s*/, '');
      setSubject(`[Ready for Pickup] ${cleanSubject}`);
    } else {
      setSubject(subject.replace(/^\[Ready for Pickup\]\s*/, ''));
    }
    setPickupChecked(checked);
  };

  const handleShippingChange = (checked: boolean) => {
    if (checked) {
      setPickupChecked(false);
      setCompletedChecked(false);
      const cleanSubject = subject.replace(/^\[(Ready for Pickup|Ready for Shipping|Order Completed)\]\s*/, '');
      setSubject(`[Ready for Shipping] ${cleanSubject}`);
    } else {
      setSubject(subject.replace(/^\[Ready for Shipping\]\s*/, ''));
    }
    setShippingChecked(checked);
  };

  const handleCompletedChange = (checked: boolean) => {
    if (checked) {
      setPickupChecked(false);
      setShippingChecked(false);
      const cleanSubject = subject.replace(/^\[(Ready for Pickup|Ready for Shipping|Order Completed)\]\s*/, '');
      setSubject(`[Order Completed] ${cleanSubject}`);
    } else {
      setSubject(subject.replace(/^\[Order Completed\]\s*/, ''));
    }
    setCompletedChecked(checked);
  };

  // Handle creating/updating document only (no email)
  const handleDocumentOnly = async () => {
    try {
      setLoading(true);
      setError(null);

      if (mode === 'create' || mode === 'update') {
        if (mode === 'create') {
          await api.create(order.order_number);
        } else if (api.update) {
          await api.update(order.order_number);
        } else {
          // Estimate recreate
          await api.create(order.order_number);
        }
      }

      if (mode === 'update') {
        setIsStale(false);
        setUpdateCompleted(true);
        setDocumentPdf(null);
        setPdfError(null);
        setQbDocumentData(null);
        await loadDocumentPdf();
      } else {
        onSuccess();
      }
    } catch (err) {
      console.error(`Failed to ${mode} document:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${mode} ${config.labels.documentName.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle updating document from view mode (when stale)
  const handleUpdateDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      if (api.update) {
        await api.update(order.order_number);
      } else {
        await api.create(order.order_number);
      }

      setIsStale(false);
      setDocumentPdf(null);
      setPdfError(null);
      setQbDocumentData(null);
      await loadDocumentPdf();
    } catch (err) {
      console.error('Failed to update document:', err);
      setError(err instanceof Error ? err.message : `Failed to update ${config.labels.documentName.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle sending email immediately
  const handleSendEmail = async () => {
    const validEntries = recipientEntries.filter(r => r.email?.trim() && r.emailType);
    const toEmails = validEntries.filter(r => r.emailType === 'to').map(r => r.email);
    const ccEmails = validEntries.filter(r => r.emailType === 'cc').map(r => r.email);
    const bccEmails = validEntries.filter(r => r.emailType === 'bcc').map(r => r.email);

    if (toEmails.length === 0) {
      setError('Please select at least one "To" recipient');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create/update document first if needed
      if (mode === 'create' || mode === 'update') {
        try {
          if (mode === 'create') {
            await api.create(order.order_number);
          } else if (api.update) {
            await api.update(order.order_number);
          } else {
            await api.create(order.order_number);
          }
        } catch (docErr) {
          const errMsg = docErr instanceof Error ? docErr.message : `Failed to ${mode} ${config.labels.documentName.toLowerCase()}`;
          setError(`${config.labels.documentName} ${mode} failed: ${errMsg}. Email not sent.`);
          return;
        }
      }

      // Send email
      try {
        await api.sendEmail(order.order_number, {
          recipientEmails: toEmails,
          ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
          bccEmails: bccEmails.length > 0 ? bccEmails : undefined,
          subject,
          body: previewHtml,
          attachPdf: true
        });
      } catch (emailErr) {
        const errMsg = emailErr instanceof Error ? emailErr.message : 'Failed to send email';
        setError(`Email send failed: ${errMsg}`);
        return;
      }

      setSuccessModalData({
        recipients: { to: toEmails, cc: ccEmails, bcc: bccEmails },
        wasResent: mode === 'view'
      });
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Failed to send:', err);
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setLoading(false);
    }
  };

  // Handle marking as sent without sending email
  const handleMarkAsSent = async () => {
    try {
      setLoading(true);
      setError(null);

      if (mode === 'create' || mode === 'update') {
        try {
          if (mode === 'create') {
            await api.create(order.order_number);
          } else if (api.update) {
            await api.update(order.order_number);
          } else {
            await api.create(order.order_number);
          }
        } catch (docErr) {
          const errMsg = docErr instanceof Error ? docErr.message : `Failed to ${mode} ${config.labels.documentName.toLowerCase()}`;
          setError(`${config.labels.documentName} ${mode} failed: ${errMsg}`);
          return;
        }
      }

      await api.markAsSent(order.order_number);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to mark as sent:', err);
      setError(err instanceof Error ? err.message : `Failed to mark ${config.labels.documentName.toLowerCase()} as sent`);
    } finally {
      setLoading(false);
    }
  };

  // Handle scheduling email
  const handleScheduleConfirm = async () => {
    if (!scheduledDate) {
      setError('Please select a date');
      return;
    }

    const validEntries = recipientEntries.filter(r => r.email?.trim() && r.emailType);
    const toEmails = validEntries.filter(r => r.emailType === 'to').map(r => r.email);
    const ccEmails = validEntries.filter(r => r.emailType === 'cc').map(r => r.email);
    const bccEmails = validEntries.filter(r => r.emailType === 'bcc').map(r => r.email);

    if (toEmails.length === 0) {
      setError('Please select at least one "To" recipient');
      setShowScheduleModal(false);
      return;
    }

    const scheduledFor = `${scheduledDate}T${scheduledTime}:00`;

    try {
      setLoading(true);
      setError(null);

      // Create/update document first if needed
      if (mode === 'create' || mode === 'update') {
        try {
          if (mode === 'create') {
            await api.create(order.order_number);
          } else if (api.update) {
            await api.update(order.order_number);
          } else {
            await api.create(order.order_number);
          }
        } catch (docErr) {
          const errMsg = docErr instanceof Error ? docErr.message : `Failed to ${mode} ${config.labels.documentName.toLowerCase()}`;
          setError(`${config.labels.documentName} ${mode} failed: ${errMsg}. Email not scheduled.`);
          setShowScheduleModal(false);
          return;
        }
      }

      // Schedule email
      try {
        await api.scheduleEmail(order.order_number, {
          recipientEmails: toEmails,
          ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
          bccEmails: bccEmails.length > 0 ? bccEmails : undefined,
          subject,
          body: previewHtml,
          attachPdf: true,
          scheduledFor
        });
      } catch (scheduleErr) {
        const errMsg = scheduleErr instanceof Error ? scheduleErr.message : 'Failed to schedule email';
        setError(`Email scheduling failed: ${errMsg}`);
        setShowScheduleModal(false);
        return;
      }

      setShowScheduleModal(false);
      setSuccessModalData({
        recipients: { to: toEmails, cc: ccEmails, bcc: bccEmails },
        scheduledFor,
        wasResent: mode === 'view'
      });
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Failed to schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to schedule');
      setShowScheduleModal(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle skip
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  // Handle linking existing invoice in create mode (two-panel, invoice only)
  const handleLinkInvoiceFromCreate = async () => {
    if (!selectedLinkInvoice || documentType !== 'invoice') return;

    try {
      setLinking(true);
      setLinkError(null);

      await qbInvoiceApi.linkInvoice(order.order_number, { qbInvoiceId: selectedLinkInvoice.invoiceId });

      console.log('Invoice linked:', selectedLinkInvoice.docNumber);
      onSuccess();
    } catch (err) {
      console.error('Failed to link invoice:', err);
      setLinkError(err instanceof Error ? err.message : 'Failed to link invoice');
    } finally {
      setLinking(false);
    }
  };

  // Handle invoice preview/expand (loads line items for third window)
  const handleInvoicePreview = async (invoice: CustomerInvoiceListItem | null) => {
    if (!invoice) {
      setPreviewInvoice(null);
      return;
    }

    setPreviewInvoice(invoice);

    // Fetch details if not cached
    if (!invoiceDetails[invoice.invoiceId]) {
      setLoadingDetails(prev => new Set(prev).add(invoice.invoiceId));
      try {
        const details = await qbInvoiceApi.getInvoiceDetails(invoice.invoiceId);
        const lineItems = details?.lineItems || [];
        setInvoiceDetails(prev => ({ ...prev, [invoice.invoiceId]: lineItems }));
      } catch (err) {
        console.error('Failed to load invoice details:', err);
        setInvoiceDetails(prev => ({ ...prev, [invoice.invoiceId]: [] }));
      } finally {
        setLoadingDetails(prev => {
          const next = new Set(prev);
          next.delete(invoice.invoiceId);
          return next;
        });
      }
    }
  };

  const closePreview = () => {
    setPreviewInvoice(null);
  };

  // Handle success modal close
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setSuccessModalData(null);
    onSuccess();
  };

  // Handle email type change for a recipient
  const handleEmailTypeChange = (id: string, newType: 'to' | 'cc' | 'bcc') => {
    setRecipientEntries(recipientEntries.map(entry => {
      if (entry.id === id) {
        return { ...entry, emailType: entry.emailType === newType ? null : newType };
      }
      return entry;
    }));
  };

  const hasValidToRecipients = recipientEntries.some(r => r.email?.trim() && r.emailType === 'to');

  if (!isOpen) return null;

  const formatAddress = (addr: Address | null): string => {
    if (!addr) return 'No address on file';
    const parts = [
      addr.address_line1,
      addr.address_line2,
      [addr.city, addr.province_state_short, addr.postal_zip].filter(Boolean).join(', ')
    ].filter(Boolean);
    return parts.join('\n');
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const modalTitle = {
    create: config.title.create,
    update: config.title.update,
    send: config.title.send,
    view: config.title.view
  }[mode];

  // CREATE mode: Two-panel for invoices (Create | Link), single-panel for estimates
  if (mode === 'create') {
    // Order totals for link panel comparison (invoice only)
    const orderTotalsForLink = {
      subtotal: totals.subtotal,
      taxName: totals.taxName || 'Tax',
      taxPercent: totals.taxNotFound ? -1 : totals.taxRate * 100,
      taxAmount: totals.tax,
      total: totals.total
    };

    // Invoice: Two separate modal windows side-by-side (Create New | Link Existing)
    if (documentType === 'invoice') {
      return (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
            isMobile ? 'overflow-y-auto' : 'flex items-center justify-center p-4'
          }`}
          onMouseDown={handleBackdropMouseDown}
          onMouseUp={(e) => {
            // Check if click is outside all panels
            // If ref isn't attached (null), treat as inside (safe - don't close)
            const isInsideCreate = modalContentRef.current ? modalContentRef.current.contains(e.target as Node) : true;
            const isInsideLink = linkModalRef.current ? linkModalRef.current.contains(e.target as Node) : true;
            const isInsidePreview = previewPanelRef.current ? previewPanelRef.current.contains(e.target as Node) : true;
            if (!isInsideCreate && !isInsideLink && !isInsidePreview) {
              handleBackdropMouseUp(e);
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
                  onClick={() => setMobileCreateTab('create')}
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
                  onClick={() => setMobileCreateTab('link')}
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
                  /* Create Tab Content */
                  <>
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <div className="flex flex-col gap-4 mb-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">From</h4>
                            <p className="text-sm font-medium text-gray-900">{companySettings?.company_name || 'Sign House'}</p>
                            <p className="text-xs text-gray-600 whitespace-pre-line">{companySettings?.company_address || ''}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill To</h4>
                            <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                            <p className="text-xs text-gray-600 whitespace-pre-line">{formatAddress(customerBillingAddress)}</p>
                          </div>
                        </div>
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Invoice Date</h4>
                          <p className="text-sm text-gray-900">{formattedDate}</p>
                        </div>
                        <div className="mb-4 space-y-3">
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
                              </div>
                            )
                          ))}
                        </div>
                        <div className="border-t border-gray-300 pt-3 space-y-1 text-sm">
                          <div className="flex justify-end">
                            <span className="w-24 text-gray-600">Subtotal:</span>
                            <span className="w-20 text-right font-medium">${totals.subtotal.toFixed(2)}</span>
                          </div>
                          {!order.cash && (
                            <div className="flex justify-end">
                              <span className={`w-24 ${totals.taxNotFound ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                {totals.taxNotFound ? `${totals.taxName}:` : `Tax (${(totals.taxRate * 100).toFixed(0)}%):`}
                              </span>
                              <span className={`w-20 text-right font-medium ${totals.taxNotFound ? 'text-red-600' : ''}`}>
                                {totals.taxNotFound ? 'ERROR' : `$${totals.tax.toFixed(2)}`}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-end border-t border-gray-200 pt-1">
                            <span className="w-24 font-semibold text-gray-900">Total:</span>
                            <span className="w-20 text-right font-bold text-gray-900">${totals.total.toFixed(2)}</span>
                          </div>
                          {!!order.deposit_required && (
                            <div className="flex justify-end bg-green-50 px-2 py-1 rounded">
                              <span className="w-24 font-semibold text-green-700">Deposit (50%):</span>
                              <span className="w-20 text-right font-bold text-green-700">${totals.deposit.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
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
                          onClick={handleDocumentOnly}
                          disabled={loading || linking}
                          className="rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium flex items-center justify-center gap-2 text-sm w-full py-3 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4" />Create QB Invoice</>}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Link Tab Content */
                  <>
                    <div className="flex-1 overflow-hidden">
                      <InvoiceLinkingPanel
                        orderNumber={order.order_number}
                        orderTotals={orderTotalsForLink}
                        onSelect={setSelectedLinkInvoice}
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
                          onClick={handleLinkInvoiceFromCreate}
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
                {/* Header */}
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
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                  {!isInitialized ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-500">Loading...</span>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
                      {/* From/To/Date Header */}
                      <div className="grid grid-cols-2 gap-5 mb-5">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">From</h4>
                          <p className="text-sm font-medium text-gray-900">{companySettings?.company_name || 'Sign House'}</p>
                          <p className="text-xs text-gray-600 whitespace-pre-line">{companySettings?.company_address || ''}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill To</h4>
                          <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                          <p className="text-xs text-gray-600 whitespace-pre-line">{formatAddress(customerBillingAddress)}</p>
                        </div>
                      </div>

                      <div className="mb-5">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Invoice Date</h4>
                        <p className="text-sm text-gray-900">{formattedDate}</p>
                      </div>

                      {/* Line Items */}
                      <div className="mb-5">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-300">
                              <th className="text-left py-2 font-medium text-gray-700 w-24">Item</th>
                              <th className="text-left py-2 font-medium text-gray-700">QB Description</th>
                              <th className="text-right py-2 font-medium text-gray-700 w-12">Qty</th>
                              <th className="text-right py-2 font-medium text-gray-700 w-16">Price</th>
                              <th className="text-right py-2 font-medium text-gray-700 w-16">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayParts.map((part, idx) => (
                              part.is_header_row ? (
                                <tr key={idx} className="bg-gray-100">
                                  <td className="py-2"></td>
                                  <td className="py-2 font-semibold text-gray-900 whitespace-pre-wrap">
                                    {part.qb_description || part.invoice_description || 'Section Header'}
                                  </td>
                                  <td className="py-2"></td>
                                  <td className="py-2"></td>
                                  <td className="py-2"></td>
                                </tr>
                              ) : (
                                <tr key={idx} className="border-b border-gray-200 align-top">
                                  <td className="py-2 text-gray-900">{part.qb_item_name || '-'}</td>
                                  <td className="py-2 text-gray-600 whitespace-pre-wrap">
                                    {part.qb_description || part.invoice_description || '-'}
                                  </td>
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
                      </div>

                      {/* Totals */}
                      <div className="border-t border-gray-300 pt-4 space-y-1 text-sm">
                        <div className="flex justify-end">
                          <span className="w-28 text-gray-600">Subtotal:</span>
                          <span className="w-24 text-right font-medium">${totals.subtotal.toFixed(2)}</span>
                        </div>
                        {!order.cash && (
                          <div className="flex justify-end">
                            <span className={`w-28 ${totals.taxNotFound ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              {totals.taxNotFound ? `${totals.taxName}:` : `Tax (${(totals.taxRate * 100).toFixed(0)}%):`}
                            </span>
                            <span className={`w-24 text-right font-medium ${totals.taxNotFound ? 'text-red-600' : ''}`}>
                              {totals.taxNotFound ? 'ERROR' : `$${totals.tax.toFixed(2)}`}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-end border-t border-gray-200 pt-2">
                          <span className="w-28 font-semibold text-gray-900">Total:</span>
                          <span className="w-24 text-right font-bold text-gray-900">${totals.total.toFixed(2)}</span>
                        </div>
                        {!!order.deposit_required && (
                          <div className="flex justify-end bg-green-50 px-3 py-1.5 rounded mt-1">
                            <span className="w-28 font-semibold text-green-700">Deposit (50%):</span>
                            <span className="w-24 text-right font-bold text-green-700">${totals.deposit.toFixed(2)}</span>
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
                      onClick={handleDocumentOnly}
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
                {/* Header */}
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

                {/* Invoice Linking Panel */}
                <div className="flex-1 overflow-hidden">
                  <InvoiceLinkingPanel
                    orderNumber={order.order_number}
                    orderTotals={orderTotalsForLink}
                    onSelect={setSelectedLinkInvoice}
                    selectedInvoice={selectedLinkInvoice}
                    isMobile={false}
                    compact={false}
                    isActive={true}
                    disabled={loading || linking}
                    onPreview={handleInvoicePreview}
                    previewInvoiceId={previewInvoice?.invoiceId || null}
                  />
                </div>

                {/* Link Error */}
                {linkError && (
                  <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{linkError}</div>
                )}

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={handleLinkInvoiceFromCreate}
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
                  {/* Preview Header */}
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Invoice #{previewInvoice.docNumber}</div>
                      <div className="text-xs text-gray-500">{previewInvoice.txnDate}</div>
                    </div>
                    <button
                      onClick={closePreview}
                      className="p-1.5 hover:bg-gray-100 rounded"
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
                      {previewInvoice.linkedToOrderNumber && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-1.5 text-xs text-amber-600">
                            <LinkIcon className="w-3 h-3" />
                            <span>Linked to Order #{previewInvoice.linkedToOrderNumber} - {previewInvoice.linkedToOrderName}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Line Items */}
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
            onClose={handleSuccessModalClose}
            orderNumber={order.order_number}
            orderName={order.order_name}
            invoiceNumber={qbDocumentNumber || undefined}
            recipients={successModalData?.recipients || { to: [], cc: [], bcc: [] }}
            scheduledFor={successModalData?.scheduledFor}
            wasResent={successModalData?.wasResent}
          />
        </div>
      );
    }

    // Estimate: Single-panel layout (same as before)
    return (
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
          isMobile ? 'overflow-y-auto' : 'flex items-center justify-center p-4'
        }`}
        onMouseDown={handleBackdropMouseDown}
        onMouseUp={handleBackdropMouseUp}
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

          {/* Body - Preview */}
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
                  onClick={handleDocumentOnly}
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
          onClose={handleSuccessModalClose}
          orderNumber={order.order_number}
          orderName={order.order_name}
          invoiceNumber={qbDocumentNumber || undefined}
          recipients={successModalData?.recipients || { to: [], cc: [], bcc: [] }}
          scheduledFor={successModalData?.scheduledFor}
          wasResent={successModalData?.wasResent}
        />
      </div>
    );
  }

  // UPDATE/SEND/VIEW modes: Full multi-panel modal - Part 2 continues in next file
  // For brevity, we'll render a simplified version that works for all modes
  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile ? '' : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
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
                onClick={() => setMobileTab('form')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  mobileTab === 'form' ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-600'
                }`}
              >
                <Mail className="w-4 h-4 inline-block mr-1.5" />Email Setup
              </button>
              <button
                onClick={() => setMobileTab('preview')}
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
            {/* Left Panel - Form (37% on desktop) */}
            {(!isMobile || mobileTab === 'form') && (
              <div
                className={`${isMobile ? 'flex-1 overflow-hidden' : 'w-[37%] border-r border-gray-200'} flex flex-col`}
              >
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
                  {/* Sync Check Loading */}
                  {checkingSync && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        <span className="text-sm text-blue-700">Checking sync status with QuickBooks...</span>
                      </div>
                    </div>
                  )}

                  {/* Staleness Warning - View Mode */}
                  {mode === 'view' && isStale && !checkingSync && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-orange-800">{config.labels.documentName} Out of Date</h4>
                          <p className="text-sm text-orange-700 mt-1">
                            Order data has changed since this {config.labels.documentName.toLowerCase()} was created.
                          </p>
                          <button
                            onClick={handleUpdateDocument}
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

                  {/* Invoice Notes */}
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
                            <div
                              key={entry.id}
                              className={`grid grid-cols-[1fr_50px_50px_50px] items-center ${
                                entry.source === 'accounting' ? 'bg-green-50' : 'bg-white'
                              } hover:bg-gray-50`}
                            >
                              <div className="px-3 py-2 min-w-0">
                                <div className="flex items-center gap-2">
                                  <UserCircle className={`w-4 h-4 flex-shrink-0 ${entry.source === 'accounting' ? 'text-green-600' : 'text-gray-400'}`} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-900 truncate">{entry.name || entry.email}</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        entry.source === 'accounting' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {entry.label || 'Contact'}
                                      </span>
                                    </div>
                                    {entry.name && <p className="text-xs text-gray-500 truncate">{entry.email}</p>}
                                  </div>
                                </div>
                              </div>
                              <div className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={entry.emailType === 'to'}
                                  onChange={() => handleEmailTypeChange(entry.id, 'to')}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </div>
                              <div className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={entry.emailType === 'cc'}
                                  onChange={() => handleEmailTypeChange(entry.id, 'cc')}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </div>
                              <div className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={entry.emailType === 'bcc'}
                                  onChange={() => handleEmailTypeChange(entry.id, 'bcc')}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1.5">
                      Select TO, CC, or BCC for each recipient. Manage contacts on the order page.
                    </p>
                  </div>

                  {/* Email Composer - supports both invoice and estimate document types */}
                  <InvoiceEmailComposer
                    documentType={documentType}
                    config={emailConfig}
                    onChange={handleEmailConfigChange}
                    invoiceData={documentEmailData}
                    disabled={loadingPreview}
                    pickupChecked={pickupChecked}
                    shippingChecked={shippingChecked}
                    completedChecked={completedChecked}
                    onPickupChange={handlePickupChange}
                    onShippingChange={handleShippingChange}
                    onCompletedChange={handleCompletedChange}
                    orderStatus={order.status}
                  />

                  {/* Email History - View Mode Only */}
                  {mode === 'view' && (
                    <div className="bg-gray-50 rounded-lg p-4 border-t border-gray-200 mt-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <Clock className="w-4 h-4 mr-2" />Email History
                      </h3>
                      {loadingHistory ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          <span className="ml-2 text-sm text-gray-500">Loading history...</span>
                        </div>
                      ) : emailHistory.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No emails sent yet</p>
                      ) : (
                        <div className="space-y-2">
                          {[...emailHistory]
                            .sort((a, b) => {
                              if (a.status === 'pending' && b.status !== 'pending') return -1;
                              if (a.status !== 'pending' && b.status === 'pending') return 1;
                              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                            })
                            .map((email) => (
                              <div
                                key={email.id}
                                className={`bg-white border rounded-lg p-3 text-sm ${
                                  email.status === 'pending' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className="font-medium text-gray-900 break-words flex-1">{email.subject}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                                    email.status === 'sent' ? 'bg-green-100 text-green-700' :
                                    email.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                    email.status === 'failed' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {email.status === 'pending' ? 'scheduled' : email.status}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  <span>To: {email.recipientEmails.join(', ')}</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {email.sentAt
                                    ? `Sent: ${new Date(email.sentAt).toLocaleString()}`
                                    : email.status === 'pending'
                                      ? `Scheduled: ${new Date(email.scheduledFor).toLocaleString()}`
                                      : `Created: ${new Date(email.createdAt).toLocaleString()}`
                                  }
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} border-t border-gray-200 bg-white flex-shrink-0`}>
                  <div className={`flex items-center ${isMobile ? 'flex-col gap-3' : 'justify-between gap-3'}`}>
                    <div className={`flex items-center gap-2 ${isMobile ? 'w-full order-1' : ''}`}>
                      {mode === 'update' && (
                        <button
                          onClick={handleDocumentOnly}
                          disabled={loading}
                          className={`rounded-lg disabled:opacity-50 text-sm bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-medium ${
                            isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-3 py-2'
                          }`}
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Update'}
                        </button>
                      )}
                      {config.features.hasSchedule && (
                        <button
                          onClick={() => setShowScheduleModal(true)}
                          disabled={loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)}
                          className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
                            loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                          } ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-4 py-2'}`}
                        >
                          <Clock className="w-4 h-4" />{!isMobile && 'Schedule'}
                        </button>
                      )}
                      <button
                        onClick={handleSendEmail}
                        disabled={loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)}
                        className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
                          loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                        } ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-4 py-2'}`}
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {mode === 'view' ? 'Resend' : 'Send'}
                      </button>
                      {config.features.hasMarkAsSent && mode !== 'view' && (
                        <button
                          onClick={handleMarkAsSent}
                          disabled={loading || (mode === 'update' && !updateCompleted)}
                          className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
                            loading || (mode === 'update' && !updateCompleted)
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800'
                          } ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-4 py-2'}`}
                          title={`Mark ${config.labels.documentName.toLowerCase()} as sent without sending an email`}
                        >
                          <CheckCircle className="w-4 h-4" />{!isMobile && 'Mark Sent'}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={handleSkip}
                      className={`text-gray-600 hover:text-gray-800 active:text-gray-900 text-sm ${
                        isMobile ? 'w-full py-3 min-h-[44px] order-2' : 'px-4 py-2'
                      }`}
                    >
                      {onSkip ? 'Skip' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Right Panel - Preview (63% on desktop) */}
            {(!isMobile || mobileTab === 'preview') && (
              <div
                className={`${isMobile ? 'flex-1 overflow-hidden' : 'w-[63%]'} bg-gray-50 flex flex-col`}
              >
                {/* Preview Tabs */}
                {!isMobile && (
                  <div className="flex border-b border-gray-300 px-6 pt-3 pb-0 bg-gray-200">
                    <button
                      onClick={() => setPreviewTab('email')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        previewTab === 'email' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      <Eye className="w-4 h-4 inline-block mr-1.5" />Email Preview
                    </button>
                    <button
                      onClick={() => setPreviewTab('document')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        previewTab === 'document' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      <FileText className="w-4 h-4 inline-block mr-1.5" />{config.labels.documentName} Details
                    </button>
                  </div>
                )}

                {/* Mobile Preview Sub-tabs */}
                {isMobile && (
                  <div className="flex border-b border-gray-300 bg-gray-100 flex-shrink-0">
                    <button
                      onClick={() => setPreviewTab('email')}
                      className={`flex-1 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                        previewTab === 'email' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-600'
                      }`}
                    >
                      Email
                    </button>
                    <button
                      onClick={() => setPreviewTab('document')}
                      className={`flex-1 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                        previewTab === 'document' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-600'
                      }`}
                    >
                      {config.labels.documentName}
                    </button>
                  </div>
                )}

                {/* Preview Content */}
                <div className={`flex-1 min-h-0 ${previewTab === 'email' ? 'overflow-hidden' : qbDocumentId ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
                  {previewTab === 'email' ? (
                    loadingPreview ? (
                      <div className="flex items-center justify-center h-full bg-white">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-500">Loading preview...</span>
                      </div>
                    ) : previewHtml ? (
                      <iframe srcDoc={previewHtml} title="Email Preview" className="w-full h-full border-0 bg-white" sandbox="allow-same-origin" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500 bg-white">
                        No email preview available
                      </div>
                    )
                  ) : (
                    qbDocumentId ? (
                      loadingPdf ? (
                        <div className="flex items-center justify-center h-full bg-white">
                          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                          <span className="ml-2 text-gray-500">Loading {config.labels.documentName.toLowerCase()} PDF...</span>
                        </div>
                      ) : documentPdf ? (
                        <iframe src={`data:application/pdf;base64,${documentPdf}#view=FitH`} title={`${config.labels.documentName} PDF`} className="w-full h-full border-0" />
                      ) : pdfError ? (
                        <div className="flex flex-col items-center justify-center h-full bg-white text-gray-500">
                          <FileText className="w-12 h-12 text-gray-300 mb-3" />
                          <p className="text-sm">Failed to load PDF</p>
                          <p className="text-xs text-gray-400 mt-1">{pdfError}</p>
                          <button onClick={loadDocumentPdf} className="mt-3 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800">
                            Try Again
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full bg-white text-gray-500">
                          No PDF available
                        </div>
                      )
                    ) : (
                      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 overflow-y-auto h-full">
                        <div className="flex justify-between items-start mb-6 pb-4 border-b">
                          <div>
                            <h4 className="text-lg font-bold text-gray-900">{config.labels.documentName.toUpperCase()} PREVIEW</h4>
                            <p className="text-sm text-gray-600">#{order.order_number}</p>
                            <p className="text-xs text-amber-600 mt-1">Not yet created in QuickBooks</p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-medium">{order.customer_name}</p>
                            <p className="text-gray-600">{new Date().toLocaleDateString()}</p>
                          </div>
                        </div>
                        <table className="w-full text-sm mb-6">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 font-medium text-gray-700">Description</th>
                              <th className="text-right py-2 font-medium text-gray-700 w-16">Qty</th>
                              <th className="text-right py-2 font-medium text-gray-700 w-24">Price</th>
                              <th className="text-right py-2 font-medium text-gray-700 w-24">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayParts.map((part, idx) => (
                              part.is_header_row ? (
                                <tr key={idx} className="bg-gray-100">
                                  <td colSpan={4} className="py-2 px-2 font-semibold text-gray-900">
                                    {part.qb_description || part.invoice_description || 'Section Header'}
                                  </td>
                                </tr>
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
                          <div className="flex justify-end">
                            <span className="w-32 text-gray-600">Subtotal:</span>
                            <span className="w-24 text-right font-medium">${totals.subtotal.toFixed(2)}</span>
                          </div>
                          {!order.cash && (
                            <div className="flex justify-end">
                              <span className={`w-32 ${totals.taxNotFound ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                {totals.taxNotFound ? `${totals.taxName} (NOT FOUND):` : `Tax (${totals.taxName || 'Tax'} ${(totals.taxRate * 100).toFixed(0)}%):`}
                              </span>
                              <span className={`w-24 text-right font-medium ${totals.taxNotFound ? 'text-red-600' : ''}`}>
                                {totals.taxNotFound ? 'ERROR' : `$${totals.tax.toFixed(2)}`}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-end border-t pt-2 mt-2">
                            <span className="w-32 font-semibold text-gray-900">Total:</span>
                            <span className="w-24 text-right font-bold text-gray-900">${totals.total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-[60] ${isMobile ? 'flex items-end' : 'flex items-center justify-center'}`}
          onMouseDown={handleScheduleBackdropMouseDown}
          onMouseUp={handleScheduleBackdropMouseUp}
        >
          <div ref={scheduleModalRef} className={`bg-white shadow-2xl w-full ${isMobile ? 'rounded-t-2xl p-4 pb-6' : 'rounded-lg max-w-sm p-6'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />Schedule Email
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isMobile ? 'px-4 py-3 min-h-[48px]' : 'px-3 py-2'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className={`w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isMobile ? 'px-4 py-3 min-h-[48px]' : 'px-3 py-2'
                  }`}
                />
              </div>
            </div>
            <div className={`mt-6 ${isMobile ? 'flex flex-col gap-3' : 'flex justify-end gap-3'}`}>
              <button
                onClick={handleScheduleConfirm}
                disabled={loading || !scheduledDate}
                className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
                  loading || !scheduledDate ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                } ${isMobile ? 'w-full py-3 min-h-[48px] order-1' : 'px-4 py-2'}`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Confirm Schedule
              </button>
              <button
                onClick={() => setShowScheduleModal(false)}
                className={`text-gray-600 hover:text-gray-800 active:text-gray-900 text-sm ${isMobile ? 'w-full py-3 min-h-[44px] order-2' : 'px-4 py-2'}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      <DocumentConflictModal
        documentType={documentType}
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        orderNumber={order.order_number}
        orderName={order.order_name}
        syncStatus={syncStatus || 'in_sync'}
        differences={syncDifferences}
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

      {/* Success Modal */}
      <InvoiceSentSuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
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

export default DocumentActionModal;
