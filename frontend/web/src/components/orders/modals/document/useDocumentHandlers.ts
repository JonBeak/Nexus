/**
 * useDocumentHandlers - All handler functions for DocumentActionModal
 *
 * Extracts email config changes, subject prefix toggles, document CRUD,
 * email sending/scheduling, invoice linking, and recipient management.
 */

import { Order } from '../../../../types/orders';
import {
  DocumentType,
  DocumentRecipientEntry,
  DocumentConfig,
} from '../../../../types/document';
import { DocumentApiAdapter } from './documentApi';
import { InvoiceEmailConfig } from '../InvoiceEmailComposer';
import { qbInvoiceApi, CustomerInvoiceListItem, InvoiceLineItem } from '../../../../services/api';
import { DocumentMode } from './DocumentActionModal';

export interface UseDocumentHandlersParams {
  mode: DocumentMode;
  documentType: DocumentType;
  order: Order;
  config: DocumentConfig;
  api: DocumentApiAdapter;
  // Current state values
  subject: string;
  previewHtml: string;
  recipientEntries: DocumentRecipientEntry[];
  selectedLinkInvoice: CustomerInvoiceListItem | null;
  invoiceDetails: Record<string, InvoiceLineItem[]>;
  pickupChecked: boolean;
  shippingChecked: boolean;
  completedChecked: boolean;
  loading: boolean;
  updateCompleted: boolean;
  isStale: boolean;
  scheduledDate: string;
  scheduledTime: string;
  // State setters
  setSubject: (v: string) => void;
  setEmailConfig: (v: InvoiceEmailConfig) => void;
  setPickupChecked: (v: boolean) => void;
  setShippingChecked: (v: boolean) => void;
  setCompletedChecked: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setIsStale: (v: boolean) => void;
  setUpdateCompleted: (v: boolean) => void;
  setDocumentPdf: (v: string | null) => void;
  setPdfError: (v: string | null) => void;
  setQbDocumentData: (v: any) => void;
  setShowScheduleModal: (v: boolean) => void;
  setShowSuccessModal: (v: boolean) => void;
  setSuccessModalData: (v: any) => void;
  setRecipientEntries: (v: DocumentRecipientEntry[]) => void;
  setSelectedLinkInvoice: (v: CustomerInvoiceListItem | null) => void;
  setLinking: (v: boolean) => void;
  setLinkError: (v: string | null) => void;
  setPreviewInvoice: (v: CustomerInvoiceListItem | null) => void;
  setInvoiceDetails: (v: React.SetStateAction<Record<string, InvoiceLineItem[]>>) => void;
  setLoadingDetails: (v: React.SetStateAction<Set<string>>) => void;
  // Callbacks
  onSuccess: () => void;
  onClose: () => void;
  onSkip?: () => void;
  onCreated?: () => void;
  // Functions from init hook
  loadDocumentPdf: () => Promise<void>;
  checkSyncStatus: () => Promise<void>;
}

export interface UseDocumentHandlersReturn {
  handleEmailConfigChange: (config: InvoiceEmailConfig) => void;
  handlePickupChange: (checked: boolean) => void;
  handleShippingChange: (checked: boolean) => void;
  handleCompletedChange: (checked: boolean) => void;
  handleDocumentOnly: () => Promise<void>;
  handleUpdateDocument: () => Promise<void>;
  handleSendEmail: () => Promise<void>;
  handleMarkAsSent: () => Promise<void>;
  handleScheduleConfirm: () => Promise<void>;
  handleSkip: () => void;
  handleLinkInvoiceFromCreate: () => Promise<void>;
  handleInvoicePreview: (invoice: CustomerInvoiceListItem | null) => Promise<void>;
  closePreview: () => void;
  handleSuccessModalClose: () => void;
  handleEmailTypeChange: (id: string, newType: 'to' | 'cc' | 'bcc') => void;
}

export function useDocumentHandlers(params: UseDocumentHandlersParams): UseDocumentHandlersReturn {
  const {
    mode, documentType, order, config, api,
    subject, previewHtml, recipientEntries, selectedLinkInvoice, invoiceDetails,
    pickupChecked, shippingChecked, completedChecked,
    setSubject, setEmailConfig, setPickupChecked, setShippingChecked, setCompletedChecked,
    setLoading, setError, setIsStale, setUpdateCompleted, setDocumentPdf, setPdfError,
    setQbDocumentData, setShowScheduleModal, setShowSuccessModal, setSuccessModalData,
    setRecipientEntries, setSelectedLinkInvoice, setLinking, setLinkError,
    setPreviewInvoice, setInvoiceDetails, setLoadingDetails,
    onSuccess, onClose, onSkip, onCreated, loadDocumentPdf, checkSyncStatus,
    scheduledDate, scheduledTime,
  } = params;

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
      } else if (mode === 'create' && onCreated) {
        onCreated();
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

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

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

  const handleInvoicePreview = async (invoice: CustomerInvoiceListItem | null) => {
    if (!invoice) {
      setPreviewInvoice(null);
      return;
    }

    setPreviewInvoice(invoice);

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

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setSuccessModalData(null);
    onSuccess();
  };

  const handleEmailTypeChange = (id: string, newType: 'to' | 'cc' | 'bcc') => {
    setRecipientEntries(recipientEntries.map(entry => {
      if (entry.id === id) {
        return { ...entry, emailType: entry.emailType === newType ? null : newType };
      }
      return entry;
    }));
  };

  return {
    handleEmailConfigChange,
    handlePickupChange,
    handleShippingChange,
    handleCompletedChange,
    handleDocumentOnly,
    handleUpdateDocument,
    handleSendEmail,
    handleMarkAsSent,
    handleScheduleConfirm,
    handleSkip,
    handleLinkInvoiceFromCreate,
    handleInvoicePreview,
    closePreview,
    handleSuccessModalClose,
    handleEmailTypeChange,
  };
}
