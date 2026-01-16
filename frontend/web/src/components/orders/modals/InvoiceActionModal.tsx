/**
 * Invoice Action Modal
 * Phase 2.e: QuickBooks Invoice Automation
 *
 * Combined modal for Create/Update/Send invoice flow with:
 * - Invoice preview (line items from order parts)
 * - Email editor (recipients, subject, body)
 * - Schedule option for delayed send
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Loader2, Calendar, Send, FileText, RefreshCw, Clock, Mail, Eye, AlertTriangle, UserCircle, CheckCircle, Link } from 'lucide-react';
import { Order, OrderPart } from '../../../types/orders';
import { Address } from '../../../types';
import { qbInvoiceApi, EmailPreview, InvoiceDetails, InvoiceSyncStatus, InvoiceDifference, InvoiceSyncResult, customerApi, settingsApi } from '../../../services/api';
import { InvoiceConflictModal } from './InvoiceConflictModal';
import { InvoiceSentSuccessModal } from './InvoiceSentSuccessModal';
import InvoiceEmailComposer, { InvoiceEmailConfig, InvoiceSummaryConfig, InvoiceEmailData, DEFAULT_INVOICE_SUMMARY_CONFIG, DEFAULT_INVOICE_BEGINNING, DEFAULT_INVOICE_END } from './InvoiceEmailComposer';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

interface InvoiceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  mode: 'create' | 'update' | 'send' | 'view';
  onSuccess: () => void;
  onSkip?: () => void;  // For status change prompts - allows skipping
  onReassign?: () => void;  // For reassigning to a different invoice
  onLinkExisting?: () => void;  // For linking to existing QB invoice instead of creating
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

// Unified recipient entry for the checkbox table
interface RecipientEntry {
  id: string;
  source: 'accounting' | 'point_person';  // Source of the recipient
  email: string;
  name?: string;
  label?: string;  // e.g., "Accounting", role, etc.
  emailType: 'to' | 'cc' | 'bcc' | null;  // null = not selected
}

export const InvoiceActionModal: React.FC<InvoiceActionModalProps> = ({
  isOpen,
  onClose,
  order,
  mode,
  onSuccess,
  onSkip,
  onReassign,
  onLinkExisting
}) => {
  // Form State
  const [recipientEntries, setRecipientEntries] = useState<RecipientEntry[]>([]);
  const [subject, setSubject] = useState('');
  const [emailConfig, setEmailConfig] = useState<InvoiceEmailConfig>({
    subject: '',
    beginning: DEFAULT_INVOICE_BEGINNING,
    end: DEFAULT_INVOICE_END,
    summaryConfig: DEFAULT_INVOICE_SUMMARY_CONFIG,
    includePayButton: true
  });
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
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
  const [previewTab, setPreviewTab] = useState<'invoice' | 'email'>('email');
  // Email preview HTML fetched from backend (4-part structure with logo/footer)
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  // Note: iframeRef removed - now using dangerouslySetInnerHTML like estimate modal

  // Subject prefix state
  const [pickupChecked, setPickupChecked] = useState(false);
  const [shippingChecked, setShippingChecked] = useState(false);
  const [completedChecked, setCompletedChecked] = useState(false);

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

  // Mobile responsiveness
  const isMobile = useIsMobile();
  useBodyScrollLock(isOpen && isMobile);
  // Mobile tab navigation for update/send/view modes
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');

  // Refs for backdrop click handling
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);
  const scheduleModalRef = useRef<HTMLDivElement>(null);
  const scheduleMouseDownOutsideRef = useRef(false);

  // Create mode: company and customer address data
  const [companySettings, setCompanySettings] = useState<{
    company_name: string | null;
    company_address: string | null;
  } | null>(null);
  const [customerBillingAddress, setCustomerBillingAddress] = useState<Address | null>(null);
  const [loadingCreateData, setLoadingCreateData] = useState(false);

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

  // Build invoice data for email composer preview
  const invoiceEmailData: InvoiceEmailData = useMemo(() => ({
    jobName: order.order_name,
    jobNumber: order.customer_job_number || undefined,  // Customer Job #
    customerPO: order.customer_po || undefined,         // PO #
    customerJobNumber: order.customer_job_number,       // Legacy alias
    invoiceNumber: order.qb_invoice_doc_number || undefined,
    invoiceDate: new Date().toISOString(),
    dueDate: qbInvoiceData?.dueDate || undefined,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    balanceDue: qbInvoiceData?.balance ?? totals.total
  }), [order, totals, qbInvoiceData]);

  // Handle ESC key - stop propagation to prevent parent modals from closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't close if a child modal is open
        if (showScheduleModal || showConflictModal || showSuccessModal) return;
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showScheduleModal, showConflictModal, showSuccessModal]);

  // Handle backdrop click - only close if both mousedown and mouseup are outside modal content
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownOutsideRef.current = modalContentRef.current ? !modalContentRef.current.contains(e.target as Node) : false;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    // Don't close if a child modal is open
    if (showScheduleModal || showConflictModal || showSuccessModal) {
      mouseDownOutsideRef.current = false;
      return;
    }
    if (mouseDownOutsideRef.current && modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      onClose();
    }
    mouseDownOutsideRef.current = false;
  };

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

  // Fetch styled email preview from backend
  useEffect(() => {
    if (!isOpen) return;

    const fetchPreview = async () => {
      try {
        setLoadingPreview(true);
        const result = await qbInvoiceApi.getStyledEmailPreview(order.order_number, {
          subject: emailConfig.subject,
          beginning: emailConfig.beginning,
          end: emailConfig.end,
          summaryConfig: emailConfig.summaryConfig,
          includePayButton: emailConfig.includePayButton,
          invoiceData: {
            jobName: invoiceEmailData.jobName,
            jobNumber: invoiceEmailData.jobNumber,
            customerPO: invoiceEmailData.customerPO,
            invoiceNumber: invoiceEmailData.invoiceNumber,
            invoiceDate: invoiceEmailData.invoiceDate,
            dueDate: invoiceEmailData.dueDate,
            subtotal: invoiceEmailData.subtotal,
            tax: invoiceEmailData.tax,
            total: invoiceEmailData.total,
            balanceDue: invoiceEmailData.balanceDue,
            qbInvoiceUrl: qbInvoiceData?.invoiceUrl
          }
        });
        setPreviewHtml(result.html);
      } catch (err) {
        console.error('Failed to fetch email preview:', err);
        setPreviewHtml('');
      } finally {
        setLoadingPreview(false);
      }
    };

    // Debounce the fetch to avoid too many requests while typing
    const timeoutId = setTimeout(fetchPreview, 300);
    return () => clearTimeout(timeoutId);
  }, [isOpen, order.order_number, emailConfig, invoiceEmailData, qbInvoiceData?.invoiceUrl]);

  // Initialize recipients: accounting emails first, then point persons
  useEffect(() => {
    if (isOpen) {
      const entries: RecipientEntry[] = [];
      const addedEmails = new Set<string>(); // Track added emails for deduplication

      // Add accounting emails with their default email_type from customer data
      if (order.accounting_emails && order.accounting_emails.length > 0) {
        order.accounting_emails.forEach((ae, idx) => {
          entries.push({
            id: `accounting-${idx}`,
            source: 'accounting',
            email: ae.email,
            name: ae.label || 'Accounting',
            label: 'Accounting',
            emailType: ae.email_type || 'to'  // Use stored default preference
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
              source: 'point_person',
              email: pp.contact_email,
              name: pp.contact_name,
              label: pp.contact_role || 'Point Person',
              emailType: 'to'  // Default point persons to "to"
            });
            addedEmails.add(pp.contact_email.toLowerCase());
          }
        });
      }

      setRecipientEntries(entries);
    }
  }, [isOpen, order.point_persons, order.accounting_emails]);

  // Load company settings and customer billing address for create mode
  useEffect(() => {
    if (isOpen && mode === 'create') {
      const loadCreateData = async () => {
        setLoadingCreateData(true);
        try {
          // Fetch company settings and customer addresses in parallel
          const [companyResult, addressesResult] = await Promise.all([
            settingsApi.getCompanySettings(),
            customerApi.getAddresses(order.customer_id)
          ]);

          setCompanySettings({
            company_name: companyResult.company_name,
            company_address: companyResult.company_address
          });

          // Find billing address, fallback to primary
          const addresses = addressesResult as Address[];
          const billingAddr = addresses.find(a => a.is_billing) || addresses.find(a => a.is_primary) || null;
          setCustomerBillingAddress(billingAddr);
        } catch (err) {
          console.error('Failed to load create mode data:', err);
        } finally {
          setLoadingCreateData(false);
        }
      };
      loadCreateData();
    }
  }, [isOpen, mode, order.customer_id]);

  // Load email preview/template
  useEffect(() => {
    if (isOpen) {
      loadEmailPreview();
    }
  }, [isOpen, mode, templateKey, order.order_number]);

  // Default subject format: Use Invoice # if linked to QB, otherwise Order #
  const defaultSubject = order.qb_invoice_doc_number
    ? `${order.order_name} | Invoice #${order.qb_invoice_doc_number}`
    : `${order.order_name} | Order #${order.order_number}`;

  const loadEmailPreview = async () => {
    try {
      setLoadingPreview(true);
      const preview = await qbInvoiceApi.getEmailPreview(order.order_number, templateKey);
      // Use subject from template (includes PO#, Job# if available)
      setSubject(preview.subject);
      // Set initial email config - composer will use defaults for beginning/end
      setEmailConfig(prev => ({
        ...prev,
        subject: preview.subject
      }));
    } catch (err) {
      console.error('Failed to load email preview:', err);
      // Fallback to basic subject
      setSubject(defaultSubject);
      setEmailConfig(prev => ({
        ...prev,
        subject: defaultSubject
      }));
    } finally {
      setLoadingPreview(false);
    }
  };

  // Handle email config changes from composer
  const handleEmailConfigChange = (config: InvoiceEmailConfig) => {
    setEmailConfig(config);
    // Sync subject with pickup/shipping prefixes
    let finalSubject = config.subject;
    if (pickupChecked && !finalSubject.startsWith('[Ready for Pickup]')) {
      finalSubject = `[Ready for Pickup] ${finalSubject.replace(/^\[Ready for (Pickup|Shipping)\]\s*/i, '')}`;
    } else if (shippingChecked && !finalSubject.startsWith('[Ready for Shipping]')) {
      finalSubject = `[Ready for Shipping] ${finalSubject.replace(/^\[Ready for (Pickup|Shipping)\]\s*/i, '')}`;
    }
    setSubject(finalSubject);
  };

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

  // Auto-enable Balance Due in summary config when balance differs from total
  useEffect(() => {
    if (qbInvoiceData?.balance !== undefined && qbInvoiceData?.total !== undefined) {
      const balanceDiffersFromTotal = qbInvoiceData.balance !== qbInvoiceData.total;
      if (balanceDiffersFromTotal && !emailConfig.summaryConfig.includeBalanceDue) {
        setEmailConfig(prev => ({
          ...prev,
          summaryConfig: {
            ...prev.summaryConfig,
            includeBalanceDue: true
          }
        }));
      }
    }
  }, [qbInvoiceData?.balance, qbInvoiceData?.total]);

  // Load email history when modal opens in view mode
  useEffect(() => {
    if (isOpen && mode === 'view') {
      loadEmailHistory();
    }
  }, [isOpen, mode]);

  // Load QB invoice data when modal opens (for update/send/view modes with existing invoice)
  useEffect(() => {
    if (isOpen && order.qb_invoice_id && (mode === 'update' || mode === 'send' || mode === 'view') && !qbInvoiceData) {
      loadQbInvoiceData();
    }
  }, [isOpen, mode, order.qb_invoice_id]);

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

  // Smart checkbox behavior - uncheck if prefix is manually removed
  useEffect(() => {
    if (pickupChecked && !subject.startsWith('[Ready for Pickup]')) {
      setPickupChecked(false);
    }
    if (shippingChecked && !subject.startsWith('[Ready for Shipping]')) {
      setShippingChecked(false);
    }
    if (completedChecked && !subject.startsWith('[Order Completed]')) {
      setCompletedChecked(false);
    }
  }, [subject]);

  // Checkbox handlers
  const handlePickupChange = (checked: boolean) => {
    if (checked) {
      setShippingChecked(false); // Mutually exclusive
      setCompletedChecked(false);
      // Remove any existing prefix and add pickup prefix
      const cleanSubject = subject.replace(/^\[(Ready for Pickup|Ready for Shipping|Order Completed)\]\s*/, '');
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
      setCompletedChecked(false);
      // Remove any existing prefix and add shipping prefix
      const cleanSubject = subject.replace(/^\[(Ready for Pickup|Ready for Shipping|Order Completed)\]\s*/, '');
      setSubject(`[Ready for Shipping] ${cleanSubject}`);
    } else {
      // Remove the prefix
      setSubject(subject.replace(/^\[Ready for Shipping\]\s*/, ''));
    }
    setShippingChecked(checked);
  };

  const handleCompletedChange = (checked: boolean) => {
    if (checked) {
      setPickupChecked(false); // Mutually exclusive
      setShippingChecked(false);
      // Remove any existing prefix and add completed prefix
      const cleanSubject = subject.replace(/^\[(Ready for Pickup|Ready for Shipping|Order Completed)\]\s*/, '');
      setSubject(`[Order Completed] ${cleanSubject}`);
    } else {
      // Remove the prefix
      setSubject(subject.replace(/^\[Order Completed\]\s*/, ''));
    }
    setCompletedChecked(checked);
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setScheduleEnabled(false);
      setScheduledDate('');
      setScheduledTime('09:00');
      setShowScheduleModal(false);
      setPickupChecked(false);
      setShippingChecked(false);
      setCompletedChecked(false);
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
      setShowSuccessModal(false);
      setSuccessModalData(null);
      setEmailConfig({
        subject: '',
        beginning: DEFAULT_INVOICE_BEGINNING,
        end: DEFAULT_INVOICE_END,
        summaryConfig: DEFAULT_INVOICE_SUMMARY_CONFIG,
        includePayButton: true
      });
      // Reset create mode data
      setCompanySettings(null);
      setCustomerBillingAddress(null);
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
    // Get valid recipients (have email and emailType selected)
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

      // Step 1: Create/update invoice first if needed
      if (mode === 'create' || mode === 'update') {
        try {
          const result = mode === 'create'
            ? await qbInvoiceApi.createInvoice(order.order_number)
            : await qbInvoiceApi.updateInvoice(order.order_number);
          console.log(`Invoice ${mode}d:`, result);
        } catch (invoiceErr) {
          console.error(`Failed to ${mode} invoice:`, invoiceErr);
          const errMsg = invoiceErr instanceof Error ? invoiceErr.message : `Failed to ${mode} invoice`;
          setError(`Invoice ${mode} failed: ${errMsg}. Email not sent.`);
          return;
        }
      }

      // Step 2: Send email with PDF attachment
      try {
        await qbInvoiceApi.sendEmail(order.order_number, {
          recipientEmails: toEmails,
          ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
          bccEmails: bccEmails.length > 0 ? bccEmails : undefined,
          subject,
          body: previewHtml,
          attachInvoicePdf: true
        });
        console.log('Email sent immediately');
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr);
        const errMsg = emailErr instanceof Error ? emailErr.message : 'Failed to send email';
        // Check if it's a PDF attachment error
        if (errMsg.toLowerCase().includes('pdf') || errMsg.toLowerCase().includes('attachment')) {
          setError(`Failed to attach invoice PDF: ${errMsg}`);
        } else {
          setError(`Email send failed: ${errMsg}`);
        }
        return;
      }

      // Show success modal instead of immediately closing
      setSuccessModalData({
        recipients: { to: toEmails, cc: ccEmails, bcc: bccEmails },
        wasResent: mode === 'view'  // Only 'view' mode is a resend (invoice was already sent)
      });
      setShowSuccessModal(true);
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

    // Get valid recipients (have email and emailType selected)
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

      // Step 1: Create/update invoice first if needed
      if (mode === 'create' || mode === 'update') {
        try {
          const result = mode === 'create'
            ? await qbInvoiceApi.createInvoice(order.order_number)
            : await qbInvoiceApi.updateInvoice(order.order_number);
          console.log(`Invoice ${mode}d:`, result);
        } catch (invoiceErr) {
          console.error(`Failed to ${mode} invoice:`, invoiceErr);
          const errMsg = invoiceErr instanceof Error ? invoiceErr.message : `Failed to ${mode} invoice`;
          setError(`Invoice ${mode} failed: ${errMsg}. Email not scheduled.`);
          setShowScheduleModal(false);
          return;
        }
      }

      // Step 2: Schedule email with PDF attachment
      try {
        await qbInvoiceApi.scheduleEmail(order.order_number, {
          recipientEmails: toEmails,
          ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
          bccEmails: bccEmails.length > 0 ? bccEmails : undefined,
          subject,
          body: previewHtml,
          scheduledFor,
          attachInvoicePdf: true
        });
        console.log('Email scheduled for:', scheduledFor);
      } catch (scheduleErr) {
        console.error('Failed to schedule email:', scheduleErr);
        const errMsg = scheduleErr instanceof Error ? scheduleErr.message : 'Failed to schedule email';
        setError(`Email scheduling failed: ${errMsg}`);
        setShowScheduleModal(false);
        return;
      }

      setShowScheduleModal(false);

      // Show success modal instead of immediately closing
      setSuccessModalData({
        recipients: { to: toEmails, cc: ccEmails, bcc: bccEmails },
        scheduledFor,
        wasResent: mode === 'view'  // Only 'view' mode is a resend (invoice was already sent)
      });
      setShowSuccessModal(true);
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

  // Handle success modal close - call onSuccess to refresh parent
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setSuccessModalData(null);
    onSuccess();
  };

  // Handle email type change for a recipient (checkbox click)
  const handleEmailTypeChange = (id: string, newType: 'to' | 'cc' | 'bcc') => {
    setRecipientEntries(recipientEntries.map(entry => {
      if (entry.id === id) {
        // Toggle: if same type clicked, uncheck (set to null); otherwise set to new type
        return {
          ...entry,
          emailType: entry.emailType === newType ? null : newType
        };
      }
      return entry;
    }));
  };

  // Check if there are valid To recipients for button enable state
  const hasValidToRecipients = recipientEntries.some(r => r.email?.trim() && r.emailType === 'to');

  if (!isOpen) return null;

  // Helper to format address for display
  const formatAddress = (addr: Address | null): string => {
    if (!addr) return 'No address on file';
    const parts = [
      addr.address_line1,
      addr.address_line2,
      [addr.city, addr.province_state_short, addr.postal_zip].filter(Boolean).join(', ')
    ].filter(Boolean);
    return parts.join('\n');
  };

  // Format date as "January 8, 2026"
  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // CREATE mode: Simple single-panel modal
  if (mode === 'create') {
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
                  <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-900`}>Create QB Invoice</h2>
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

          {/* Body - Invoice Preview */}
          <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-6'}`}>
            {loadingCreateData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading...</span>
              </div>
            ) : (
              <div className={`bg-gray-50 rounded-lg border border-gray-200 ${isMobile ? 'p-4' : 'p-6'}`}>
                {/* From/To/Date Header */}
                <div className={`${isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-2 gap-6'} mb-6`}>
                  {/* From - Company */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">From</h4>
                    <p className="text-sm font-medium text-gray-900">
                      {companySettings?.company_name || 'Sign House'}
                    </p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {companySettings?.company_address || ''}
                    </p>
                  </div>

                  {/* To - Customer */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill To</h4>
                    <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {formatAddress(customerBillingAddress)}
                    </p>
                  </div>
                </div>

                {/* Date */}
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Invoice Date</h4>
                  <p className="text-sm text-gray-900">{formattedDate}</p>
                </div>

                {/* Line Items Table */}
                <div className="mb-6">
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
                      {order.parts?.filter(p => !p.is_header_row && p.quantity && p.quantity > 0).map((part, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-2 text-gray-900">{part.qb_item_name || '-'}</td>
                          <td className="py-2 text-gray-600">{part.qb_description || '-'}</td>
                          <td className="py-2 text-right text-gray-600">{part.quantity}</td>
                          <td className="py-2 text-right text-gray-600">
                            ${Number(part.unit_price || 0).toFixed(2)}
                          </td>
                          <td className="py-2 text-right text-gray-900">
                            ${Number(part.extended_price || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {(!order.parts || order.parts.filter(p => !p.is_header_row && p.quantity).length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-gray-500 italic">
                            No line items
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="border-t border-gray-300 pt-4 space-y-2">
                  <div className="flex justify-end">
                    <span className="w-32 text-gray-600 text-sm">Subtotal:</span>
                    <span className="w-28 text-right font-medium text-sm">
                      ${totals.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {!order.cash && (
                    <div className="flex justify-end">
                      <span className="w-32 text-gray-600 text-sm">
                        Tax ({(totals.taxRate * 100).toFixed(0)}%):
                      </span>
                      <span className="w-28 text-right font-medium text-sm">
                        ${totals.tax.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end border-t border-gray-200 pt-2">
                    <span className="w-32 font-semibold text-gray-900">Total:</span>
                    <span className="w-28 text-right font-bold text-gray-900">
                      ${totals.total.toFixed(2)}
                    </span>
                  </div>
                  {!!order.deposit_required && (
                    <div className="flex justify-end bg-green-50 px-3 py-2 rounded mt-2">
                      <span className="w-32 font-semibold text-green-700">Deposit (50%):</span>
                      <span className="w-28 text-right font-bold text-green-700">
                        ${totals.deposit.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
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
                    <Link className="w-4 h-4" />
                    Link Existing
                  </button>
                )}
                <button
                  onClick={handleInvoiceOnly}
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
                      Create QB Invoice
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Success Modal */}
        <InvoiceSentSuccessModal
          isOpen={showSuccessModal}
          onClose={handleSuccessModalClose}
          orderNumber={order.order_number}
          orderName={order.order_name}
          invoiceNumber={order.qb_invoice_doc_number || undefined}
          recipients={successModalData?.recipients || { to: [], cc: [], bcc: [] }}
          scheduledFor={successModalData?.scheduledFor}
          wasResent={successModalData?.wasResent}
        />
      </div>
    );
  }

  // UPDATE/SEND/VIEW modes: Full multi-panel modal
  const modalTitle = {
    update: 'Update Invoice',
    send: 'Send Invoice',
    view: 'View Invoice'
  }[mode];

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile ? 'overflow-y-auto' : 'flex items-center justify-center p-4'
      }`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={modalContentRef} className={`bg-white shadow-2xl w-full flex ${
        isMobile ? 'flex-col min-h-full' : 'rounded-lg w-[96%] max-w-[1475px] h-[95vh] overflow-hidden'
      }`}>
        {/* Mobile Tab Bar */}
        {isMobile && (
          <div className="flex-shrink-0 border-b border-gray-200 bg-white sticky top-0 z-10">
            {/* Header */}
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
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            {/* Tab Buttons */}
            <div className="flex">
              <button
                onClick={() => setMobileTab('form')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  mobileTab === 'form'
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Mail className="w-4 h-4 inline-block mr-1.5" />
                Email Setup
              </button>
              <button
                onClick={() => setMobileTab('preview')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  mobileTab === 'preview'
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4 inline-block mr-1.5" />
                Preview
              </button>
            </div>
          </div>
        )}

        {/* Left Panel - Header + Form + Footer (37% on desktop, full width on mobile when form tab) */}
        {(!isMobile || mobileTab === 'form') && (
        <div className={`${isMobile ? 'flex-1' : 'w-[37%] border-r border-gray-200'} flex flex-col`}>
          {/* Header - Left side only (desktop) */}
          {!isMobile && (
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
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
            {/* Open in QuickBooks and Reassign buttons */}
            <div className="flex items-center gap-2 mt-3">
              {!!order.qb_invoice_id && (
                <button
                  onClick={() => window.open(`https://qbo.intuit.com/app/invoice?txnId=${order.qb_invoice_id}`, '_blank')}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Open in QuickBooks</span>
                </button>
              )}
              {onReassign && (
                <button
                  onClick={onReassign}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors border border-gray-300"
                >
                  <span>Reassign</span>
                </button>
              )}
            </div>
          </div>
          )}

          {/* Form Content */}
          <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-6'} space-y-6`}>
            {/* Mobile Quick Actions */}
            {isMobile && (
              <div className="flex flex-wrap items-center gap-2">
                {!!order.qb_invoice_id && (
                  <button
                    onClick={() => window.open(`https://qbo.intuit.com/app/invoice?txnId=${order.qb_invoice_id}`, '_blank')}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg text-xs font-medium transition-colors min-h-[40px]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open in QB</span>
                  </button>
                )}
                {onReassign && (
                  <button
                    onClick={onReassign}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 rounded-lg text-xs font-medium transition-colors border border-gray-300 min-h-[40px]"
                  >
                    <span>Reassign</span>
                  </button>
                )}
              </div>
            )}
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

              {/* Recipients - Unified Table with TO/CC/BCC Checkboxes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline-block mr-1" />
                  Recipients
                </label>

                {recipientEntries.length === 0 ? (
                  <div className="text-sm text-gray-500 italic py-3 text-center border border-gray-200 rounded-lg bg-gray-50">
                    No recipients configured. Add accounting emails or point persons on the order page.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[1fr_50px_50px_50px] bg-gray-100 border-b border-gray-200 text-xs font-medium text-gray-600">
                      <div className="px-3 py-2">Contact</div>
                      <div className="px-2 py-2 text-center">To</div>
                      <div className="px-2 py-2 text-center">CC</div>
                      <div className="px-2 py-2 text-center">BCC</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-gray-100">
                      {recipientEntries.map((entry) => {
                        const isAccounting = entry.source === 'accounting';

                        return (
                          <div
                            key={entry.id}
                            className={`grid grid-cols-[1fr_50px_50px_50px] items-center ${
                              isAccounting ? 'bg-green-50' : 'bg-white'
                            } hover:bg-gray-50`}
                          >
                            {/* Contact Info - Read Only */}
                            <div className="px-3 py-2 min-w-0">
                              <div className="flex items-center gap-2">
                                <UserCircle className={`w-4 h-4 flex-shrink-0 ${
                                  isAccounting ? 'text-green-600' : 'text-gray-400'
                                }`} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-900 truncate">
                                      {entry.name || entry.email}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                      isAccounting
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {entry.label || (isAccounting ? 'Accounting' : 'Contact')}
                                    </span>
                                  </div>
                                  {entry.name && (
                                    <p className="text-xs text-gray-500 truncate">{entry.email}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* TO Checkbox */}
                            <div className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={entry.emailType === 'to'}
                                onChange={() => handleEmailTypeChange(entry.id, 'to')}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </div>

                            {/* CC Checkbox */}
                            <div className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={entry.emailType === 'cc'}
                                onChange={() => handleEmailTypeChange(entry.id, 'cc')}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </div>

                            {/* BCC Checkbox */}
                            <div className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={entry.emailType === 'bcc'}
                                onChange={() => handleEmailTypeChange(entry.id, 'bcc')}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Helper Text */}
                <p className="text-xs text-gray-500 mt-1.5">
                  Select TO, CC, or BCC for each recipient. Manage contacts on the order page.
                </p>
              </div>

              {/* Email Composer - Subject, Beginning, Summary, Pay Button, End */}
              <InvoiceEmailComposer
                config={emailConfig}
                onChange={handleEmailConfigChange}
                invoiceData={invoiceEmailData}
                disabled={loadingPreview}
                pickupChecked={pickupChecked}
                shippingChecked={shippingChecked}
                completedChecked={completedChecked}
                onPickupChange={handlePickupChange}
                onShippingChange={handleShippingChange}
                onCompletedChange={handleCompletedChange}
                orderStatus={order.status}
              />

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
            <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} border-t border-gray-200 bg-white flex-shrink-0`}>
              <div className={`flex items-center ${isMobile ? 'flex-col gap-3' : 'justify-between gap-3'}`}>
                {/* Action Buttons - Top on mobile, Right on desktop */}
                <div className={`flex items-center gap-2 ${isMobile ? 'w-full order-1' : ''}`}>
                  {/* Update Button (update mode only) */}
                  {mode === 'update' && (
                    <button
                      onClick={handleInvoiceOnly}
                      disabled={loading}
                      className={`rounded-lg disabled:opacity-50 text-sm bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-medium ${
                        isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-3 py-2'
                      }`}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </span>
                      ) : (
                        'Update'
                      )}
                    </button>
                  )}

                  {/* Schedule Button */}
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    disabled={loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)}
                    className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
                      loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    } ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-4 py-2'}`}
                  >
                    <Clock className="w-4 h-4" />
                    {!isMobile && 'Schedule'}
                  </button>

                  {/* Send Button */}
                  <button
                    onClick={handleSendInvoice}
                    disabled={loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)}
                    className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
                      loading || !hasValidToRecipients || (mode === 'update' && !updateCompleted) || (mode === 'view' && isStale)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                    } ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-4 py-2'}`}
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

                {/* Cancel - Bottom on mobile, Left on desktop */}
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

        {/* Right Panel - Preview (63% on desktop, full width on mobile when preview tab) */}
        {(!isMobile || mobileTab === 'preview') && (
        <div className={`${isMobile ? 'flex-1' : 'w-[63%]'} bg-gray-50 flex flex-col`}>
            {/* Preview Tabs (desktop only - mobile uses main tab bar) */}
            {!isMobile && (
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
            )}

            {/* Mobile Preview Sub-tabs */}
            {isMobile && (
              <div className="flex border-b border-gray-300 bg-gray-100">
                <button
                  onClick={() => setPreviewTab('email')}
                  className={`flex-1 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                    previewTab === 'email'
                      ? 'border-blue-600 text-blue-700 bg-white'
                      : 'border-transparent text-gray-600'
                  }`}
                >
                  Email
                </button>
                <button
                  onClick={() => setPreviewTab('invoice')}
                  className={`flex-1 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                    previewTab === 'invoice'
                      ? 'border-blue-600 text-blue-700 bg-white'
                      : 'border-transparent text-gray-600'
                  }`}
                >
                  Invoice
                </button>
              </div>
            )}

            {/* Preview Content */}
            <div className={`flex-1 ${
              previewTab === 'email'
                ? 'overflow-hidden'
                : order.qb_invoice_id
                  ? 'overflow-hidden'  // PDF view - full height, no padding
                  : 'overflow-y-auto p-6'  // Local preview - with padding
            }`}>
              {previewTab === 'email' ? (
                /* Email Preview - Rendered HTML with dangerouslySetInnerHTML (like estimate) */
                loadingPreview ? (
                  <div className="flex items-center justify-center h-full bg-white">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">Loading preview...</span>
                  </div>
                ) : previewHtml ? (
                  <div
                    className="w-full h-full overflow-auto bg-white p-6"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
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
                      {!!order.deposit_required && (
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
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-[60] ${
            isMobile ? 'flex items-end' : 'flex items-center justify-center'
          }`}
          onMouseDown={handleScheduleBackdropMouseDown}
          onMouseUp={handleScheduleBackdropMouseUp}
        >
          <div ref={scheduleModalRef} className={`bg-white shadow-2xl w-full ${
            isMobile ? 'rounded-t-2xl p-4 pb-6' : 'rounded-lg max-w-sm p-6'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Schedule Email
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                  loading || !scheduledDate
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                } ${isMobile ? 'w-full py-3 min-h-[48px] order-1' : 'px-4 py-2'}`}
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
              <button
                onClick={() => setShowScheduleModal(false)}
                className={`text-gray-600 hover:text-gray-800 active:text-gray-900 text-sm ${
                  isMobile ? 'w-full py-3 min-h-[44px] order-2' : 'px-4 py-2'
                }`}
              >
                Cancel
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

      {/* Success Modal - shown after successful send/schedule */}
      <InvoiceSentSuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        orderNumber={order.order_number}
        orderName={order.order_name}
        invoiceNumber={order.qb_invoice_doc_number || undefined}
        recipients={successModalData?.recipients || { to: [], cc: [], bcc: [] }}
        scheduledFor={successModalData?.scheduledFor}
        wasResent={successModalData?.wasResent}
      />
    </div>
  );
};

export default InvoiceActionModal;
