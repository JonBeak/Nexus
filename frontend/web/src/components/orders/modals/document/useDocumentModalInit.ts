/**
 * useDocumentModalInit - Initialization effects for DocumentActionModal
 *
 * Handles:
 * - Consolidated initialization effect (reset state on close, load email preview, QB data, etc.)
 * - Styled email preview effect (debounced 300ms)
 * - Sync status check effect + checkSyncStatus()
 * - loadDocumentPdf()
 */

import { useEffect, useRef } from 'react';
import { Order } from '../../../../types/orders';
import { Address } from '../../../../types';
import {
  DocumentType,
  DocumentSyncStatus,
  DocumentDifference,
  DocumentRecipientEntry,
  DocumentEmailHistoryItem,
  DocumentConfig,
} from '../../../../types/document';
import { DocumentApiAdapter } from './documentApi';
import {
  InvoiceEmailConfig,
  InvoiceEmailData,
  DEFAULT_INVOICE_SUMMARY_CONFIG,
  DEFAULT_ESTIMATE_SUMMARY_CONFIG,
  DEFAULT_INVOICE_BEGINNING,
  DEFAULT_INVOICE_END
} from '../InvoiceEmailComposer';
import { qbInvoiceApi, orderPreparationApi, customerApi, settingsApi, InvoicePreviewLineItem } from '../../../../services/api';
import { DocumentMode } from './DocumentActionModal';

interface TotalsResult {
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  deposit: number;
  taxNotFound: boolean;
  taxName: string | null;
}

export interface UseDocumentModalInitParams {
  isOpen: boolean;
  isInitialized: boolean;
  mode: DocumentMode;
  documentType: DocumentType;
  order: Order;
  templateKey: string;
  qbDocumentId: string | null;
  qbDocumentNumber: string | null;
  totals: TotalsResult;
  emailConfig: InvoiceEmailConfig;
  documentEmailData: InvoiceEmailData;
  config: DocumentConfig;
  api: DocumentApiAdapter;
  qbDocumentData: any;
  // State setters
  setIsInitialized: (v: boolean) => void;
  setLoadingPreview: (v: boolean) => void;
  setError: (v: string | null) => void;
  setSubject: (v: string) => void;
  setEmailConfig: (v: InvoiceEmailConfig) => void;
  setPickupChecked: (v: boolean) => void;
  setShippingChecked: (v: boolean) => void;
  setCompletedChecked: (v: boolean) => void;
  setRecipientEntries: (v: DocumentRecipientEntry[]) => void;
  setQbDocumentData: (v: any) => void;
  setCompanySettings: (v: { company_name: string | null; company_address: string | null } | null) => void;
  setCustomerBillingAddress: (v: Address | null) => void;
  setEmailHistory: (v: DocumentEmailHistoryItem[]) => void;
  setDocumentPdf: (v: string | null) => void;
  setPreviewHtml: (v: string) => void;
  setScheduledDate: (v: string) => void;
  setScheduledTime: (v: string) => void;
  setShowScheduleModal: (v: boolean) => void;
  setShowConflictModal: (v: boolean) => void;
  setSyncStatus: (v: DocumentSyncStatus | null) => void;
  setSyncDifferences: (v: DocumentDifference[]) => void;
  setIsStale: (v: boolean) => void;
  setUpdateCompleted: (v: boolean) => void;
  setPdfError: (v: string | null) => void;
  setLoadingPdf: (v: boolean) => void;
  setCheckingSync: (v: boolean) => void;
  setCheckingStaleness: (v: boolean) => void;
  setShowSuccessModal: (v: boolean) => void;
  setSuccessModalData: (v: any) => void;
  setSelectedLinkInvoice: (v: any) => void;
  setLinking: (v: boolean) => void;
  setLinkError: (v: string | null) => void;
  setMobileCreateTab: (v: 'create' | 'link') => void;
  setInvoicePreviewLines: (v: InvoicePreviewLineItem[]) => void;
  setLoadingInvoicePreview: (v: boolean) => void;
}

export interface UseDocumentModalInitReturn {
  checkSyncStatus: () => Promise<void>;
  loadDocumentPdf: () => Promise<void>;
}

export function useDocumentModalInit(params: UseDocumentModalInitParams): UseDocumentModalInitReturn {
  const {
    isOpen, mode, documentType, order, templateKey, qbDocumentId, qbDocumentNumber,
    totals, emailConfig, documentEmailData, config, api,
    setIsInitialized, setLoadingPreview, setError, setSubject, setEmailConfig,
    setPickupChecked, setShippingChecked, setCompletedChecked, setRecipientEntries,
    setQbDocumentData, setCompanySettings, setCustomerBillingAddress, setEmailHistory,
    setDocumentPdf, setPreviewHtml, setScheduledDate, setScheduledTime, setShowScheduleModal,
    setShowConflictModal, setSyncStatus, setSyncDifferences, setIsStale, setUpdateCompleted,
    setPdfError, setLoadingPdf, setCheckingSync, setCheckingStaleness,
    setShowSuccessModal, setSuccessModalData, setSelectedLinkInvoice, setLinking, setLinkError,
    setMobileCreateTab, setInvoicePreviewLines, setLoadingInvoicePreview,
  } = params;

  const hasAutoAppliedPrefixRef = useRef(false);
  const hasStartedInitRef = useRef(false);

  // Consolidated initialization effect
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
      setSelectedLinkInvoice(null);
      setLinking(false);
      setLinkError(null);
      setMobileCreateTab('create');
      setInvoicePreviewLines([]);
      setLoadingInvoicePreview(false);
      return;
    }

    const initializeModal = async () => {
      if (hasStartedInitRef.current) return;
      hasStartedInitRef.current = true;
      setLoadingPreview(true);

      try {
        const promises: Promise<any>[] = [];

        // Email preview
        let emailPreviewPromise: Promise<any> | null = null;
        if (documentType === 'invoice') {
          emailPreviewPromise = qbInvoiceApi.getEmailPreview(order.order_number, templateKey);
          promises.push(emailPreviewPromise);
        } else {
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

        // QB document data
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

        // Invoice line items preview
        let invoicePreviewPromise: Promise<InvoicePreviewLineItem[]> | null = null;
        if (documentType === 'invoice' && (mode === 'create' || mode === 'update')) {
          setLoadingInvoicePreview(true);
          invoicePreviewPromise = qbInvoiceApi.getInvoicePreview(order.order_number);
          promises.push(invoicePreviewPromise);
        }

        // Email history (view mode only)
        let emailHistoryPromise: Promise<any> | null = null;
        if (mode === 'view') {
          emailHistoryPromise = api.getEmailHistory(order.order_number);
          promises.push(emailHistoryPromise);
        }

        // Document PDF
        let pdfPromise: Promise<any> | null = null;
        if (qbDocumentId) {
          pdfPromise = api.getPdf(order.order_number).catch(() => null);
          promises.push(pdfPromise);
        }

        await Promise.all(promises);

        const emailPreview = emailPreviewPromise ? await emailPreviewPromise : null;
        const qbData = qbDocPromise ? await qbDocPromise : null;
        const createData = createDataPromise ? await createDataPromise : null;
        const historyData = emailHistoryPromise ? await emailHistoryPromise : null;
        const pdfData = pdfPromise ? await pdfPromise : null;
        const invoicePreviewData = invoicePreviewPromise ? await invoicePreviewPromise : null;

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

        // Set all state at once
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
        if (invoicePreviewData) {
          setInvoicePreviewLines(invoicePreviewData);
          setLoadingInvoicePreview(false);
        }

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

  // Fetch styled email preview - debounced
  useEffect(() => {
    if (!isOpen || !params.isInitialized) return;

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
              qbInvoiceUrl: params.qbDocumentData?.invoiceUrl as string | undefined
            }
          });
          setPreviewHtml(result.html);
        } else {
          const backendSummaryConfig = {
            includeJobName: emailConfig.summaryConfig.includeJobName,
            includeCustomerRef: emailConfig.summaryConfig.includeJobNumber,
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
  }, [isOpen, params.isInitialized, order.order_number, emailConfig, documentEmailData, params.qbDocumentData?.invoiceUrl, documentType, totals, order.order_name, order.customer_job_number, order.customer_po, order.qb_estimate_doc_number, order.cached_balance]);

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

  // Check sync status when modal opens with existing document
  useEffect(() => {
    if (isOpen && qbDocumentId && (mode === 'view' || mode === 'update')) {
      checkSyncStatus();
    }
  }, [isOpen, mode, qbDocumentId]);

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

  return { checkSyncStatus, loadDocumentPdf };
}
