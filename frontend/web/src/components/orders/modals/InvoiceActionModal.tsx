/**
 * Invoice Action Modal
 * Phase 2.e: QuickBooks Invoice Automation
 *
 * Combined modal for Create/Update/Send invoice flow with:
 * - Invoice preview (line items from order parts)
 * - Email editor (recipients, subject, body)
 * - Schedule option for delayed send
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Loader2, Calendar, Send, FileText, RefreshCw, Clock, Mail, Eye, Truck, Package, AlertTriangle, Plus, UserCircle } from 'lucide-react';
import { Order, OrderPart } from '../../../types/orders';
import { qbInvoiceApi, EmailPreview, InvoiceDetails, InvoiceSyncStatus, InvoiceDifference, InvoiceSyncResult } from '../../../services/api/orders/qbInvoiceApi';
import { customerContactsApi } from '../../../services/api';
import { InvoiceConflictModal } from './InvoiceConflictModal';

interface InvoiceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  mode: 'create' | 'update' | 'send' | 'view';
  onSuccess: () => void;
  onSkip?: () => void;  // For status change prompts - allows skipping
}

interface EmailHistoryItem {
  id: number;
  emailType: string;
  recipientEmails: string[];
  subject: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  scheduledFor: string;
  sentAt: string | null;
  createdAt: string;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Recipient entry with mode (existing/custom) and email type (to/cc/bcc)
interface RecipientEntry {
  id: string;
  mode: 'existing' | 'custom' | 'accounting';  // accounting = auto-added invoice_email
  contact_id?: number;
  email: string;
  name?: string;
  emailType: 'to' | 'cc' | 'bcc';
  saveToDatabase?: boolean;
}

interface CustomerContact {
  contact_id: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
}

export const InvoiceActionModal: React.FC<InvoiceActionModalProps> = ({
  isOpen,
  onClose,
  order,
  mode,
  onSuccess,
  onSkip
}) => {
  // Form State
  const [recipientEntries, setRecipientEntries] = useState<RecipientEntry[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // Customer contacts for recipient selection
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // UI State
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'invoice' | 'email'>('email');
  const [htmlBody, setHtmlBody] = useState(''); // Full HTML for preview
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Custom message and subject prefix state
  const [customMessage, setCustomMessage] = useState('');
  const [pickupChecked, setPickupChecked] = useState(false);
  const [shippingChecked, setShippingChecked] = useState(false);

  // QB Invoice data for Invoice Details tab
  const [qbInvoiceData, setQbInvoiceData] = useState<InvoiceDetails | null>(null);
  const [loadingQbInvoice, setLoadingQbInvoice] = useState(false);

  // Email history for view mode
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Staleness detection for view mode
  const [isStale, setIsStale] = useState(false);
  const [checkingStaleness, setCheckingStaleness] = useState(false);

  // Track if update mode has completed update (to enable Send/Schedule)
  const [updateCompleted, setUpdateCompleted] = useState(false);

  // Conflict detection (Phase 2 bi-directional sync)
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<InvoiceSyncStatus | null>(null);
  const [syncDifferences, setSyncDifferences] = useState<InvoiceDifference[]>([]);
  const [checkingSync, setCheckingSync] = useState(false);

  // Invoice PDF for Invoice Details tab
  const [invoicePdf, setInvoicePdf] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Determine template based on order type and deposit payment status
  const templateKey = useMemo(() => {
    if (!order.deposit_required) return 'full_invoice';

    // Check if deposit has been paid (any payment made reduces balance below total)
    const depositPaid = !!(order.qb_invoice_id &&
      order.cached_balance != null &&
      order.cached_invoice_total != null &&
      order.cached_balance < order.cached_invoice_total);

    return depositPaid ? 'full_invoice' : 'deposit_request';
  }, [order.deposit_required, order.qb_invoice_id, order.cached_balance, order.cached_invoice_total]);

  // Calculate invoice line items from order parts
  const lineItems = useMemo((): InvoiceLineItem[] => {
    if (!order.parts) return [];

    return order.parts
      .filter(part => part.quantity && part.quantity > 0)
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

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    // TODO: Get actual tax rate from order.tax_name
    const taxRate = order.cash ? 0 : 0.13; // 13% HST default, 0 if cash job
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const deposit = order.deposit_required ? total * 0.5 : 0;

    return { subtotal, tax, taxRate, total, deposit };
  }, [lineItems, order.cash, order.deposit_required]);

  // Load customer contacts
  const loadContacts = useCallback(async () => {
    if (!order.customer_id) return;
    try {
      setLoadingContacts(true);
      const contacts = await customerContactsApi.getContacts(order.customer_id);
      setCustomerContacts(contacts || []);
    } catch (error) {
      console.error('Failed to load customer contacts:', error);
      setCustomerContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [order.customer_id]);

  // Initialize recipients: accounting emails first, then point persons
  useEffect(() => {
    if (isOpen) {
      loadContacts();

      const entries: RecipientEntry[] = [];
      const addedEmails = new Set<string>(); // Track added emails for deduplication

      // Add accounting emails (use accounting_emails array if available, fallback to invoice_email)
      if (order.accounting_emails && order.accounting_emails.length > 0) {
        order.accounting_emails.forEach((ae, idx) => {
          entries.push({
            id: `accounting-${idx}`,
            mode: 'accounting',
            email: ae.email,
            name: ae.label || 'Accounting',
            emailType: ae.email_type  // Use stored type (to/cc/bcc)
          });
          addedEmails.add(ae.email.toLowerCase());
        });
      }

      // Add point persons (skip if already added as accounting email)
      if (order.point_persons) {
        order.point_persons.forEach((pp, idx) => {
          if (pp.contact_email) {
            // Skip if already added as accounting email
            if (addedEmails.has(pp.contact_email.toLowerCase())) return;

            entries.push({
              id: `pp-${pp.id || idx}`,
              mode: pp.contact_id ? 'existing' : 'custom',
              contact_id: pp.contact_id,
              email: pp.contact_email,
              name: pp.contact_name,
              emailType: 'to'
            });
            addedEmails.add(pp.contact_email.toLowerCase());
          }
        });
      }

      setRecipientEntries(entries);
    }
  }, [isOpen, order.point_persons, order.invoice_email, order.accounting_emails, loadContacts]);

  // Load email preview/template
  useEffect(() => {
    if (isOpen) {
      loadEmailPreview();
    }
  }, [isOpen, mode, templateKey, order.order_number]);

  // Default subject format: {orderName} | Invoice #{orderNumber}
  const defaultSubject = `${order.order_name} | Invoice #${order.order_number}`;

  const loadEmailPreview = async () => {
    try {
      setLoadingPreview(true);
      const preview = await qbInvoiceApi.getEmailPreview(order.order_number, templateKey);
      // Use subject from template (includes PO#, Job# if available)
      setSubject(preview.subject);
      setHtmlBody(preview.body); // Store base HTML for preview (customMessage will be empty)
      // Extract plain text version for simple editing (strip HTML tags)
      const plainText = preview.body
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500);
      setBody(plainText);
    } catch (err) {
      console.error('Failed to load email preview:', err);
      // Fallback to basic template
      setSubject(defaultSubject);
      setBody(`Please find attached invoice for order ${order.order_name}.`);
      setHtmlBody('');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Compute final HTML with custom message injected (for real-time preview)
  const previewHtml = useMemo(() => {
    if (!htmlBody) return '';

    if (!customMessage || !customMessage.trim()) {
      return htmlBody;
    }

    // Inject custom message before the highlight-box or urgency-box
    // The template has {customMessage} placeholder which is empty,
    // we inject a styled paragraph before the highlight/urgency box
    const styledMessage = `<p class="custom-message" style="margin: 18px 0; font-size: 15px; color: #333;">${customMessage.trim()}</p>`;

    // Insert before the highlight-box or urgency-box div
    const insertPoint = htmlBody.indexOf('<div class="highlight-box">') !== -1
      ? '<div class="highlight-box">'
      : '<div class="urgency-box">';

    if (htmlBody.includes(insertPoint)) {
      return htmlBody.replace(insertPoint, styledMessage + insertPoint);
    }

    return htmlBody;
  }, [htmlBody, customMessage]);

  // Load QB invoice data when switching to invoice tab (if invoice exists)
  useEffect(() => {
    if (isOpen && previewTab === 'invoice' && order.qb_invoice_id && !qbInvoiceData) {
      loadQbInvoiceData();
    }
  }, [isOpen, previewTab, order.qb_invoice_id]);

  const loadQbInvoiceData = async () => {
    try {
      setLoadingQbInvoice(true);
      const data = await qbInvoiceApi.getInvoice(order.order_number);
      setQbInvoiceData(data);
    } catch (err) {
      console.error('Failed to load QB invoice data:', err);
      // Fall back to local data - don't set error
    } finally {
      setLoadingQbInvoice(false);
    }
  };

  // Load email history when modal opens in view mode
  useEffect(() => {
    if (isOpen && mode === 'view') {
      loadEmailHistory();
      // Also load QB invoice data for view mode
      if (order.qb_invoice_id && !qbInvoiceData) {
        loadQbInvoiceData();
      }
    }
  }, [isOpen, mode]);

  // Check sync status when modal opens with existing invoice (view or update mode)
  useEffect(() => {
    if (isOpen && order.qb_invoice_id && (mode === 'view' || mode === 'update')) {
      checkSyncStatus();
    }
  }, [isOpen, mode, order.qb_invoice_id]);

  // Full sync check - compares local data with QuickBooks invoice
  // Shows conflict modal if QB was modified or there's a conflict
  const checkSyncStatus = async () => {
    if (!order.qb_invoice_id) return;

    try {
      setCheckingSync(true);
      setCheckingStaleness(true);
      const result = await qbInvoiceApi.compareWithQB(order.order_number);

      setSyncStatus(result.status);
      setSyncDifferences(result.differences || []);

      // Determine if update is needed (local changed)
      setIsStale(result.localChanged);

      // If QB was modified or there's a conflict, show conflict modal
      if (result.status === 'qb_modified' || result.status === 'conflict') {
        setShowConflictModal(true);
      }
    } catch (err) {
      console.error('Failed to check invoice sync status:', err);
      setIsStale(false);
      setSyncStatus(null);
    } finally {
      setCheckingSync(false);
      setCheckingStaleness(false);
    }
  };

  const loadEmailHistory = async () => {
    try {
      setLoadingHistory(true);
      const history = await qbInvoiceApi.getEmailHistory(order.order_number);
      setEmailHistory(history);
    } catch (err) {
      console.error('Failed to load email history:', err);
      setEmailHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load invoice PDF as soon as modal opens (if QB invoice exists)
  useEffect(() => {
    if (isOpen && order.qb_invoice_id && !invoicePdf && !loadingPdf) {
      loadInvoicePdf();
    }
  }, [isOpen, order.qb_invoice_id]);

  const loadInvoicePdf = async () => {
    try {
      setLoadingPdf(true);
      setPdfError(null);
      const result = await qbInvoiceApi.getInvoicePdf(order.order_number);
      setInvoicePdf(result.pdf);
    } catch (err) {
      console.error('Failed to load invoice PDF:', err);
      setPdfError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Auto-check pickup/shipping based on order status when modal opens and subject is loaded
  useEffect(() => {
    if (isOpen && subject && !loadingPreview) {
      // Only auto-apply if no prefix already exists
      if (!subject.startsWith('[Ready for')) {
        if (order.status === 'pick_up') {
          setPickupChecked(true);
          setShippingChecked(false);
          setSubject(`[Ready for Pickup] ${subject}`);
        } else if (order.status === 'shipping') {
          setShippingChecked(true);
          setPickupChecked(false);
          setSubject(`[Ready for Shipping] ${subject}`);
        }
      }
    }
  }, [isOpen, loadingPreview]); // Only run when modal opens and preview finishes loading

  // Smart checkbox behavior - uncheck if prefix is manually removed
  useEffect(() => {
    if (pickupChecked && !subject.startsWith('[Ready for Pickup]')) {
      setPickupChecked(false);
    }
    if (shippingChecked && !subject.startsWith('[Ready for Shipping]')) {
      setShippingChecked(false);
    }
  }, [subject]);

  // Checkbox handlers
  const handlePickupChange = (checked: boolean) => {
    if (checked) {
      setShippingChecked(false); // Mutually exclusive
      // Remove any existing prefix and add pickup prefix
      const cleanSubject = subject.replace(/^\[Ready for (Pickup|Shipping)\]\s*/, '');
      setSubject(`[Ready for Pickup] ${cleanSubject}`);
    } else {
      // Remove the prefix
      setSubject(subject.replace(/^\[Ready for Pickup\]\s*/, ''));
    }
    setPickupChecked(checked);
  };

  const handleShippingChange = (checked: boolean) => {
    if (checked) {
      setPickupChecked(false); // Mutually exclusive
      // Remove any existing prefix and add shipping prefix
      const cleanSubject = subject.replace(/^\[Ready for (Pickup|Shipping)\]\s*/, '');
      setSubject(`[Ready for Shipping] ${cleanSubject}`);
    } else {
      // Remove the prefix
      setSubject(subject.replace(/^\[Ready for Shipping\]\s*/, ''));
    }
    setShippingChecked(checked);
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setScheduleEnabled(false);
      setScheduledDate('');
      setScheduledTime('09:00');
      setShowScheduleModal(false);
      setCustomMessage('');
      setPickupChecked(false);
      setShippingChecked(false);
      setQbInvoiceData(null);
      setEmailHistory([]);
      setIsStale(false);
      setUpdateCompleted(false);
      setShowConflictModal(false);
      setSyncStatus(null);
      setSyncDifferences([]);
      setInvoicePdf(null);
      setPdfError(null);
      setRecipientEntries([]);
      setCustomerContacts([]);
    }
  }, [isOpen]);

  // Handle creating/updating invoice only (no email)
  // For update mode: stay open and reload data so user can then send
  // For create mode: call onSuccess to refresh parent and close
  const handleInvoiceOnly = async () => {
    try {
      setLoading(true);
      setError(null);

      if (mode === 'create' || mode === 'update') {
        const result = mode === 'create'
          ? await qbInvoiceApi.createInvoice(order.order_number)
          : await qbInvoiceApi.updateInvoice(order.order_number);

        console.log(`Invoice ${mode}d:`, result);
      }

      if (mode === 'update') {
        // Stay open and reload modal data so user can Schedule/Send
        setIsStale(false);
        setUpdateCompleted(true);  // Enable Schedule/Send buttons
        setInvoicePdf(null);
        setPdfError(null);
        setQbInvoiceData(null);

        // Reload PDF and invoice data
        await Promise.all([
          loadInvoicePdf(),
          loadQbInvoiceData()
        ]);
      } else {
        // Create mode - close modal and refresh parent
        onSuccess();
      }
    } catch (err) {
      console.error(`Failed to ${mode} invoice:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${mode} invoice`);
    } finally {
      setLoading(false);
    }
  };

  // Handle updating invoice from view mode (when stale)
  // After successful update, reload modal data instead of closing
  const handleUpdateInvoice = async () => {
    try {
      setLoading(true);
      setError(null);
      await qbInvoiceApi.updateInvoice(order.order_number);
      setIsStale(false);

      // Reload modal data instead of closing
      // Reset PDF state to trigger reload
      setInvoicePdf(null);
      setPdfError(null);
      setQbInvoiceData(null);

      // Reload PDF and invoice data
      await Promise.all([
        loadInvoicePdf(),
        loadQbInvoiceData()
      ]);
    } catch (err) {
      console.error('Failed to update invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to update invoice');
    } finally {
      setLoading(false);
    }
  };

  // Handle sending invoice email immediately
  const handleSendInvoice = async () => {
    // Get valid recipients (have email)
    const validEntries = recipientEntries.filter(r => r.email?.trim());
    const toEmails = validEntries.filter(r => r.emailType === 'to').map(r => r.email);
    const ccEmails = validEntries.filter(r => r.emailType === 'cc').map(r => r.email);
    const bccEmails = validEntries.filter(r => r.emailType === 'bcc').map(r => r.email);

    if (toEmails.length === 0) {
      setError('Please add at least one "To" recipient');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create/update invoice first if needed
      if (mode === 'create' || mode === 'update') {
        const result = mode === 'create'
          ? await qbInvoiceApi.createInvoice(order.order_number)
          : await qbInvoiceApi.updateInvoice(order.order_number);
        console.log(`Invoice ${mode}d:`, result);
      }

      // Send email immediately - use previewHtml which has customMessage injected
      const finalBody = previewHtml || body;
      await qbInvoiceApi.sendEmail(order.order_number, {
        recipientEmails: toEmails,
        ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
        bccEmails: bccEmails.length > 0 ? bccEmails : undefined,
        subject,
        body: finalBody,
        attachInvoicePdf: true
      });
      console.log('Email sent immediately');

      onSuccess();
    } catch (err) {
      console.error('Failed to send invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invoice');
    } finally {
      setLoading(false);
    }
  };

  // Handle scheduling invoice email
  const handleScheduleConfirm = async () => {
    if (!scheduledDate) {
      setError('Please select a date');
      return;
    }

    // Get valid recipients (have email)
    const validEntries = recipientEntries.filter(r => r.email?.trim());
    const toEmails = validEntries.filter(r => r.emailType === 'to').map(r => r.email);
    const ccEmails = validEntries.filter(r => r.emailType === 'cc').map(r => r.email);
    const bccEmails = validEntries.filter(r => r.emailType === 'bcc').map(r => r.email);

    if (toEmails.length === 0) {
      setError('Please add at least one "To" recipient');
      setShowScheduleModal(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create/update invoice first if needed
      if (mode === 'create' || mode === 'update') {
        const result = mode === 'create'
          ? await qbInvoiceApi.createInvoice(order.order_number)
          : await qbInvoiceApi.updateInvoice(order.order_number);
        console.log(`Invoice ${mode}d:`, result);
      }

      // Schedule email - use previewHtml which has customMessage injected
      const finalBody = previewHtml || body;
      const scheduledFor = `${scheduledDate}T${scheduledTime}:00`;
      await qbInvoiceApi.scheduleEmail(order.order_number, {
        recipientEmails: toEmails,
        ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
        bccEmails: bccEmails.length > 0 ? bccEmails : undefined,
        subject,
        body: finalBody,
        scheduledFor,
        attachInvoicePdf: true
      });
      console.log('Email scheduled for:', scheduledFor);

      setShowScheduleModal(false);
      onSuccess();
    } catch (err) {
      console.error('Failed to schedule invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to schedule invoice');
      setShowScheduleModal(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle skip (for status change prompts)
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  // Recipient management functions
  const getAvailableContacts = (currentEntryId: string) => {
    const selectedContactIds = recipientEntries
      .filter(r => r.contact_id)
      .map(r => r.contact_id);
    const currentEntry = recipientEntries.find(r => r.id === currentEntryId);
    return customerContacts.filter(c =>
      !selectedContactIds.includes(c.contact_id) ||
      c.contact_id === currentEntry?.contact_id
    );
  };

  const hasAvailableContacts = () => {
    const selectedContactIds = recipientEntries
      .filter(r => r.contact_id)
      .map(r => r.contact_id);
    return customerContacts.some(c => !selectedContactIds.includes(c.contact_id));
  };

  const handleAddRecipient = () => {
    const defaultMode = hasAvailableContacts() ? 'existing' : 'custom';
    const newEntry: RecipientEntry = {
      id: `new-${Date.now()}`,
      mode: defaultMode,
      email: '',
      emailType: 'to',
      saveToDatabase: defaultMode === 'custom' ? true : undefined
    };
    setRecipientEntries([...recipientEntries, newEntry]);
  };

  const handleRemoveRecipient = (id: string) => {
    setRecipientEntries(recipientEntries.filter(r => r.id !== id));
  };

  const handleRecipientModeChange = (id: string, mode: 'existing' | 'custom') => {
    setRecipientEntries(recipientEntries.map(entry => {
      if (entry.id === id) {
        return {
          ...entry,
          mode,
          contact_id: undefined,
          email: '',
          name: undefined,
          saveToDatabase: mode === 'custom' ? true : undefined
        };
      }
      return entry;
    }));
  };

  const handleExistingContactSelect = (id: string, contactId: number | null) => {
    if (!contactId) {
      setRecipientEntries(recipientEntries.map(entry => {
        if (entry.id === id) {
          return { ...entry, contact_id: undefined, email: '', name: undefined };
        }
        return entry;
      }));
      return;
    }

    const selectedContact = customerContacts.find(c => c.contact_id === contactId);
    if (!selectedContact) return;

    setRecipientEntries(recipientEntries.map(entry => {
      if (entry.id === id) {
        return {
          ...entry,
          contact_id: selectedContact.contact_id,
          email: selectedContact.contact_email,
          name: selectedContact.contact_name
        };
      }
      return entry;
    }));
  };

  const handleRecipientFieldChange = (id: string, field: keyof RecipientEntry, value: any) => {
    setRecipientEntries(recipientEntries.map(entry => {
      if (entry.id === id) {
        return { ...entry, [field]: value };
      }
      return entry;
    }));
  };

  // Check if there are valid To recipients for button enable state
  const hasValidToRecipients = recipientEntries.some(r => r.email?.trim() && r.emailType === 'to');

  if (!isOpen) return null;

  const modalTitle = {
    create: 'Create Invoice',
    update: 'Update Invoice',
    send: 'Send Invoice',
    view: 'View Invoice'
  }[mode];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[96%] max-w-[1475px] h-[95vh] flex overflow-hidden">
        {/* Left Panel - Header + Form + Footer (37%) */}
        <div className="w-[37%] border-r border-gray-200 flex flex-col">
          {/* Header - Left side only */}
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                {mode === 'create' && <FileText className="w-6 h-6 text-green-600" />}
                {mode === 'update' && <RefreshCw className="w-6 h-6 text-orange-500" />}
                {mode === 'send' && <Send className="w-6 h-6 text-blue-600" />}
                {mode === 'view' && <Eye className="w-6 h-6 text-gray-600" />}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{modalTitle}</h2>
                  <p className="text-sm text-gray-600">
                    #{order.order_number} - {order.order_name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            {/* Open in QuickBooks button - shown whenever invoice is linked */}
            {!!order.qb_invoice_id && (
              <button
                onClick={() => window.open(`https://qbo.intuit.com/app/invoice?txnId=${order.qb_invoice_id}`, '_blank')}
                className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors mt-3"
              >
                <FileText className="w-4 h-4" />
                <span>Open in QuickBooks</span>
              </button>
            )}
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Sync Check Loading */}
            {checkingSync && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  <span className="text-sm text-blue-700">Checking invoice sync status with QuickBooks...</span>
                </div>
              </div>
            )}

            {/* Staleness Warning - View Mode */}
              {mode === 'view' && isStale && !checkingSync && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-orange-800">Invoice Out of Date</h4>
                      <p className="text-sm text-orange-700 mt-1">
                        Order data has changed since this invoice was created.
                      </p>
                      <button
                        onClick={handleUpdateInvoice}
                        disabled={loading}
                        className="mt-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Update
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Invoice Notes - Display only */}
              {order.invoice_notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    Invoice Notes
                  </h4>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{order.invoice_notes}</p>
                </div>
              )}

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline-block mr-1" />
                  Recipients
                  {loadingContacts && (
                    <Loader2 className="w-3 h-3 inline-block ml-2 animate-spin text-gray-400" />
                  )}
                </label>
                <div className="space-y-2">
                  {recipientEntries.map((entry) => {
                    const availableContacts = getAvailableContacts(entry.id);
                    const canUseExisting = availableContacts.length > 0 || entry.mode === 'existing';
                    const isAccounting = entry.mode === 'accounting';

                    return (
                      <div
                        key={entry.id}
                        className={`border rounded-lg p-2 ${
                          isAccounting ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Email Type Selector (To/CC/BCC) */}
                          <select
                            value={entry.emailType}
                            onChange={(e) => handleRecipientFieldChange(entry.id, 'emailType', e.target.value)}
                            className="w-16 px-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
                          >
                            <option value="to">To</option>
                            <option value="cc">CC</option>
                            <option value="bcc">BCC</option>
                          </select>

                          {/* Content based on mode */}
                          <div className="flex-1 min-w-0">
                            {isAccounting ? (
                              /* Accounting Email - Read-only display */
                              <div className="flex items-center gap-2">
                                <UserCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs text-green-700 font-medium">Accounting</span>
                                  <p className="text-sm text-gray-900 truncate">{entry.email}</p>
                                </div>
                              </div>
                            ) : entry.mode === 'existing' ? (
                              /* Existing Contact Dropdown */
                              <select
                                value={entry.contact_id || ''}
                                onChange={(e) => handleExistingContactSelect(entry.id, e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">Select contact...</option>
                                {availableContacts.map(contact => (
                                  <option key={contact.contact_id} value={contact.contact_id}>
                                    {contact.contact_name}{contact.contact_role && ` (${contact.contact_role})`} - {contact.contact_email}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              /* Custom Contact Input */
                              <div className="space-y-1">
                                <div className="flex gap-1">
                                  <input
                                    type="email"
                                    value={entry.email}
                                    onChange={(e) => handleRecipientFieldChange(entry.id, 'email', e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    placeholder="Email *"
                                  />
                                  <input
                                    type="text"
                                    value={entry.name || ''}
                                    onChange={(e) => handleRecipientFieldChange(entry.id, 'name', e.target.value)}
                                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    placeholder="Name"
                                  />
                                </div>
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={entry.saveToDatabase || false}
                                    onChange={(e) => handleRecipientFieldChange(entry.id, 'saveToDatabase', e.target.checked)}
                                    className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-[10px] text-gray-500">Save to contacts</span>
                                </label>
                              </div>
                            )}
                          </div>

                          {/* Mode Toggle (Existing/New) - only for non-accounting */}
                          {!isAccounting && (
                            <div className="flex flex-col items-start gap-0" style={{ minWidth: '55px' }}>
                              {canUseExisting && (
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`mode-${entry.id}`}
                                    checked={entry.mode === 'existing'}
                                    onChange={() => handleRecipientModeChange(entry.id, 'existing')}
                                    className="w-3 h-3 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-[10px] text-gray-600">Existing</span>
                                </label>
                              )}
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`mode-${entry.id}`}
                                  checked={entry.mode === 'custom'}
                                  onChange={() => handleRecipientModeChange(entry.id, 'custom')}
                                  className="w-3 h-3 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-[10px] text-gray-600">New</span>
                              </label>
                            </div>
                          )}

                          {/* Remove Button */}
                          <button
                            onClick={() => handleRemoveRecipient(entry.id)}
                            className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                            title="Remove recipient"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Recipient Button */}
                  <button
                    type="button"
                    onClick={handleAddRecipient}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Recipient
                  </button>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={loadingPreview}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {/* Subject Prefix Checkboxes */}
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pickupChecked}
                      onChange={(e) => handlePickupChange(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Package className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700">Ready for Pickup</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shippingChecked}
                      onChange={(e) => handleShippingChange(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-700">Ready for Shipping</span>
                  </label>
                </div>
              </div>

              {/* Custom Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a custom message that will appear in the email body..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>


              {/* Email History - View Mode Only (at bottom) */}
              {mode === 'view' && (
                <div className="bg-gray-50 rounded-lg p-4 border-t border-gray-200 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Email History
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
                      {/* Sort: pending (scheduled) first, then by date descending */}
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
                            <span className="font-medium text-gray-900 break-words flex-1">
                              {email.subject}
                            </span>
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
                          <div className="text-xs text-gray-400 mt-1 flex items-center justify-between">
                            <span>
                              {email.sentAt
                                ? `Sent: ${new Date(email.sentAt).toLocaleString()}`
                                : email.status === 'pending'
                                ? `Scheduled: ${new Date(email.scheduledFor).toLocaleString()}`
                                : `Created: ${new Date(email.createdAt).toLocaleString()}`
                              }
                            </span>
                            {email.status === 'pending' && (
                              <button
                                onClick={async () => {
                                  if (window.confirm('Cancel this scheduled email?')) {
                                    try {
                                      await qbInvoiceApi.cancelScheduledEmail(order.order_number, email.id);
                                      // Refresh history
                                      const history = await qbInvoiceApi.getEmailHistory(order.order_number);
                                      setEmailHistory(history);
                                    } catch (err) {
                                      console.error('Failed to cancel email:', err);
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 font-medium"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Footer Actions - Inside Left Panel */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                {/* Cancel - Left */}
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                >
                  {onSkip ? 'Skip' : 'Cancel'}
                </button>

                {/* Action Buttons - Right */}
                <div className="flex items-center gap-2">
                  {/* Invoice Only Button (for create/update modes) */}
                  {(mode === 'create' || mode === 'update') && (
                    <button
                      onClick={handleInvoiceOnly}
                      disabled={loading}
                      className={`px-3 py-2 rounded-lg disabled:opacity-50 text-sm ${
                        mode === 'update'
                          ? 'bg-orange-500 hover:bg-orange-600 text-white font-medium'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </span>
                      ) : (
                        mode === 'create' ? 'Create Only' : 'Update'
                      )}
                    </button>
                  )}

                  {/* Schedule Button - disabled when update required */}
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    disabled={loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm ${
                      loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Schedule
                  </button>

                  {/* Send Button - disabled when update required */}
                  <button
                    onClick={handleSendInvoice}
                    disabled={loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm ${
                      loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {mode === 'view' ? 'Resend' : 'Send'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

        {/* Right Panel - Preview (63%) - Full height from top */}
        <div className="w-[63%] bg-gray-50 flex flex-col">
            {/* Preview Tabs */}
            <div className="flex border-b border-gray-300 px-6 pt-3 pb-0 bg-gray-200">
              <button
                onClick={() => setPreviewTab('email')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  previewTab === 'email'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-700 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4 inline-block mr-1.5" />
                Email Preview
              </button>
              <button
                onClick={() => setPreviewTab('invoice')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  previewTab === 'invoice'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-700 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4 inline-block mr-1.5" />
                Invoice Details
              </button>
            </div>

            {/* Preview Content */}
            <div className={`flex-1 ${
              previewTab === 'email'
                ? 'overflow-hidden'
                : order.qb_invoice_id
                  ? 'overflow-hidden'  // PDF view - full height, no padding
                  : 'overflow-y-auto p-6'  // Local preview - with padding
            }`}>
              {previewTab === 'email' ? (
                /* Email Preview - Rendered HTML (full height, no wrapper) */
                loadingPreview ? (
                  <div className="flex items-center justify-center h-full bg-white">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">Loading preview...</span>
                  </div>
                ) : previewHtml ? (
                  <iframe
                    ref={iframeRef}
                    srcDoc={previewHtml}
                    title="Email Preview"
                    className="w-full h-full border-0 bg-white"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 bg-white">
                    No email preview available
                  </div>
                )
              ) : (
                /* Invoice Details - PDF or Local Preview */
                order.qb_invoice_id ? (
                  /* QB Invoice PDF */
                  loadingPdf ? (
                    <div className="flex items-center justify-center h-full bg-white">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-500">Loading invoice PDF...</span>
                    </div>
                  ) : invoicePdf ? (
                    <iframe
                      src={`data:application/pdf;base64,${invoicePdf}#view=FitH`}
                      title="Invoice PDF"
                      className="w-full h-full border-0"
                    />
                  ) : pdfError ? (
                    <div className="flex flex-col items-center justify-center h-full bg-white text-gray-500">
                      <FileText className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-sm">Failed to load PDF</p>
                      <p className="text-xs text-gray-400 mt-1">{pdfError}</p>
                      <button
                        onClick={loadInvoicePdf}
                        className="mt-3 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full bg-white text-gray-500">
                      No PDF available
                    </div>
                  )
                ) : (
                  /* Local Preview - No QB Invoice Yet */
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6 overflow-y-auto h-full">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6 pb-4 border-b">
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">INVOICE PREVIEW</h4>
                        <p className="text-sm text-gray-600">#{order.order_number}</p>
                        <p className="text-xs text-amber-600 mt-1">Not yet created in QuickBooks</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-gray-600">{new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Line Items */}
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
                        {lineItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="py-2 text-gray-900">{item.description}</td>
                            <td className="py-2 text-right text-gray-600">{item.quantity}</td>
                            <td className="py-2 text-right text-gray-600">${item.unitPrice.toFixed(2)}</td>
                            <td className="py-2 text-right text-gray-900">${item.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                        {lineItems.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-gray-500 italic">
                              No line items
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Totals */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-end">
                        <span className="w-32 text-gray-600">Subtotal:</span>
                        <span className="w-24 text-right font-medium">${totals.subtotal.toFixed(2)}</span>
                      </div>
                      {!order.cash && (
                        <div className="flex justify-end">
                          <span className="w-32 text-gray-600">Tax ({(totals.taxRate * 100).toFixed(0)}%):</span>
                          <span className="w-24 text-right font-medium">${totals.tax.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-end border-t pt-2 mt-2">
                        <span className="w-32 font-semibold text-gray-900">Total:</span>
                        <span className="w-24 text-right font-bold text-gray-900">${totals.total.toFixed(2)}</span>
                      </div>
                      {order.deposit_required && (
                        <div className="flex justify-end bg-green-50 px-3 py-2 rounded mt-2">
                          <span className="w-32 font-semibold text-green-700">Deposit Due:</span>
                          <span className="w-24 text-right font-bold text-green-700">${totals.deposit.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Schedule Email
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleConfirm}
                disabled={loading || !scheduledDate}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm ${
                  loading || !scheduledDate
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Confirm Schedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Conflict Modal - shown when QB invoice differs from local data */}
      <InvoiceConflictModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        order={order}
        status={syncStatus || 'in_sync'}
        differences={syncDifferences}
        onResolved={async () => {
          // After resolution, reload modal data
          setShowConflictModal(false);
          setSyncStatus(null);
          setSyncDifferences([]);
          setIsStale(false);
          setInvoicePdf(null);
          setPdfError(null);
          setQbInvoiceData(null);

          // Reload data
          await Promise.all([
            loadInvoicePdf(),
            loadQbInvoiceData()
          ]);

          // Re-check sync status
          await checkSyncStatus();
        }}
      />
    </div>
  );
};

export default InvoiceActionModal;
