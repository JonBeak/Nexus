/**
 * @deprecated Use DocumentActionModal from './document' instead.
 * This component will be removed in a future release.
 *
 * Invoice Action Modal
 * Phase 2.e: QuickBooks Invoice Automation
 *
 * Combined modal for Create/Update/Send invoice flow with:
 * - Invoice preview (line items from order parts)
 * - Email editor (recipients, subject, body)
 * - Schedule option for delayed send
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Loader2, Calendar, Send, FileText, RefreshCw, Clock, Mail, Eye, AlertTriangle, UserCircle, CheckCircle, Link as LinkIcon, Plus } from 'lucide-react';
import { Order, OrderPart } from '../../../types/orders';
import { Address } from '../../../types';
import { qbInvoiceApi, EmailPreview, InvoiceDetails, InvoiceSyncStatus, InvoiceDifference, InvoiceSyncResult, customerApi, settingsApi, CustomerInvoiceListItem } from '../../../services/api';
import { InvoiceConflictModal } from './InvoiceConflictModal';
import { InvoiceSentSuccessModal } from './InvoiceSentSuccessModal';
import InvoiceEmailComposer, { InvoiceEmailConfig, InvoiceSummaryConfig, InvoiceEmailData, DEFAULT_INVOICE_SUMMARY_CONFIG, DEFAULT_INVOICE_BEGINNING, DEFAULT_INVOICE_END } from './InvoiceEmailComposer';
import { InvoiceLinkingPanel } from './document';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { useAlert } from '../../../contexts/AlertContext';

interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

interface InvoiceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  mode: 'create' | 'update' | 'send' | 'view';
  onSuccess: () => void;
  onSkip?: () => void;  // For status change prompts - allows skipping
  onReassign?: (isDeleted: boolean) => void;  // For reassigning to a different invoice, isDeleted indicates if invoice was deleted in QB
  onLinkExisting?: () => void;  // For linking to existing QB invoice instead of creating
  taxRules?: TaxRule[];  // Optional tax rules for looking up actual tax rate
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
  onLinkExisting,
  taxRules = []
}) => {
  const { showConfirmation } = useAlert();

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
  const [isInitialized, setIsInitialized] = useState(false);
  const [previewTab, setPreviewTab] = useState<'invoice' | 'email'>('email');
  // Email preview HTML fetched from backend (4-part structure with logo/footer)
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  // Note: Uses iframe with srcDoc for email preview to isolate CSS from parent

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

  // Create mode: Two-panel state (left=create, right=link)
  const [selectedLinkInvoice, setSelectedLinkInvoice] = useState<CustomerInvoiceListItem | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  // Mobile: Tab to switch between Create and Link panels
  const [mobileCreateTab, setMobileCreateTab] = useState<'create' | 'link'>('create');

  // Refs for backdrop click handling
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);
  const scheduleModalRef = useRef<HTMLDivElement>(null);
  const scheduleMouseDownOutsideRef = useRef(false);

  // Ref to track if prefix has been auto-applied (prevents race conditions)
  const hasAutoAppliedPrefixRef = useRef(false);

  // Ref to prevent concurrent initialization (guards against effect re-runs during async init)
  const hasStartedInitRef = useRef(false);

  // Create mode: company and customer address data
  const [companySettings, setCompanySettings] = useState<{
    company_name: string | null;
    company_address: string | null;
  } | null>(null);
  const [customerBillingAddress, setCustomerBillingAddress] = useState<Address | null>(null);

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

  // Parts for display (includes headers in original order)
  const displayParts = useMemo(() => {
    if (!order.parts) return [];
    return order.parts.filter(p =>
      p.is_header_row ||
      (p.quantity && p.quantity > 0)
    );
  }, [order.parts]);

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    // Look up actual tax rate from tax_rules based on order's tax_name
    const isCashJob = !!order.cash;
    const hasTaxName = !!order.tax_name;
    const taxRule = hasTaxName ? taxRules.find(r => r.tax_name === order.tax_name) : null;

    // Fail clearly if tax name exists but rule not found (and taxRules loaded)
    const taxNotFound = hasTaxName && !isCashJob && taxRules.length > 0 && !taxRule;
    const taxRate = isCashJob ? 0 : (taxRule ? parseFloat(taxRule.tax_percent.toString()) : 0);
    const tax = taxNotFound ? 0 : subtotal * taxRate;
    const total = taxNotFound ? subtotal : subtotal + tax;
    const deposit = order.deposit_required ? total * 0.5 : 0;

    return { subtotal, tax, taxRate, total, deposit, taxNotFound, taxName: order.tax_name };
  }, [lineItems, order.cash, order.deposit_required, order.tax_name, taxRules]);

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

  // CONSOLIDATED INITIALIZATION EFFECT
  // Replaces multiple separate effects to prevent cascade of state updates and re-renders
  useEffect(() => {
    console.log('🔍 Init effect triggered:', {
      isOpen,
      mode,
      templateKey,
      orderNumber: order.order_number,
      qbInvoiceId: order.qb_invoice_id,
      customerId: order.customer_id,
      status: order.status
    });

    if (!isOpen) {
      // Reset all state when modal closes
      setIsInitialized(false);
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
      setPreviewHtml('');
      setEmailConfig({
        subject: '',
        beginning: DEFAULT_INVOICE_BEGINNING,
        end: DEFAULT_INVOICE_END,
        summaryConfig: DEFAULT_INVOICE_SUMMARY_CONFIG,
        includePayButton: true
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
      console.log('🚀 initializeModal called, hasStartedInitRef:', hasStartedInitRef.current);

      // Skip if initialization already started (ref is synchronous, prevents concurrent inits)
      if (hasStartedInitRef.current) return;
      hasStartedInitRef.current = true;

      setLoadingPreview(true);

      try {
        // 1. Start all parallel fetches
        const promises: Promise<any>[] = [];

        // Email preview (always needed)
        const emailPreviewPromise = qbInvoiceApi.getEmailPreview(order.order_number, templateKey);
        promises.push(emailPreviewPromise);

        // QB invoice data (if invoice exists and mode needs it)
        let qbInvoicePromise: Promise<InvoiceDetails | null> | null = null;
        if (order.qb_invoice_id && (mode === 'update' || mode === 'send' || mode === 'view')) {
          qbInvoicePromise = qbInvoiceApi.getInvoice(order.order_number);
          promises.push(qbInvoicePromise);
        }

        // Create mode data
        let createDataPromise: Promise<[any, Address[]]> | null = null;
        if (mode === 'create') {
          createDataPromise = Promise.all([
            settingsApi.getCompanySettings(),
            customerApi.getAddresses(order.customer_id)
          ]) as Promise<[any, Address[]]>;
          promises.push(createDataPromise);
        }

        // Email history (view mode only)
        let emailHistoryPromise: Promise<any> | null = null;
        if (mode === 'view') {
          emailHistoryPromise = qbInvoiceApi.getEmailHistory(order.order_number);
          promises.push(emailHistoryPromise);
        }

        // Invoice PDF (if QB invoice exists)
        let pdfPromise: Promise<any> | null = null;
        if (order.qb_invoice_id) {
          pdfPromise = qbInvoiceApi.getInvoicePdf(order.order_number).catch(() => null);
          promises.push(pdfPromise);
        }

        // 2. Wait for all fetches
        await Promise.all(promises);

        // 3. Get results
        const emailPreview = await emailPreviewPromise;
        const qbData = qbInvoicePromise ? await qbInvoicePromise : null;
        const createData = createDataPromise ? await createDataPromise : null;
        const historyData = emailHistoryPromise ? await emailHistoryPromise : null;
        const pdfData = pdfPromise ? await pdfPromise : null;

        // 4. Compute final subject with prefix
        let finalSubject = emailPreview.subject;
        let pickupCheck = false;
        let shippingCheck = false;
        let completedCheck = false;

        if (!hasAutoAppliedPrefixRef.current) {
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

        // 5. Compute emailConfig with auto-enabled Balance Due if needed
        let summaryConfig = { ...DEFAULT_INVOICE_SUMMARY_CONFIG };
        if (qbData?.balance !== undefined && qbData?.total !== undefined) {
          if (qbData.balance !== qbData.total) {
            summaryConfig.includeBalanceDue = true;
          }
        }

        const finalEmailConfig: InvoiceEmailConfig = {
          subject: finalSubject,
          beginning: DEFAULT_INVOICE_BEGINNING,
          end: DEFAULT_INVOICE_END,
          summaryConfig,
          includePayButton: true
        };

        // 6. Initialize recipients
        const entries: RecipientEntry[] = [];
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

        // 7. SET ALL STATE AT ONCE (minimizes re-renders)
        setSubject(finalSubject);
        setEmailConfig(finalEmailConfig);
        setPickupChecked(pickupCheck);
        setShippingChecked(shippingCheck);
        setCompletedChecked(completedCheck);
        setRecipientEntries(entries);

        if (qbData) setQbInvoiceData(qbData);
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
        if (pdfData?.pdf) setInvoicePdf(pdfData.pdf);

        // 8. Mark initialization complete
        console.log('✅ Initialization complete, setting isInitialized=true');
        setIsInitialized(true);

      } catch (err) {
        console.error('Failed to initialize modal:', err);
        // Fallback with defaults
        const fallbackSubject = order.qb_invoice_doc_number
          ? `${order.order_name} | Invoice #${order.qb_invoice_doc_number}`
          : `${order.order_name} | Order #${order.order_number}`;
        setSubject(fallbackSubject);
        setEmailConfig({
          subject: fallbackSubject,
          beginning: DEFAULT_INVOICE_BEGINNING,
          end: DEFAULT_INVOICE_END,
          summaryConfig: DEFAULT_INVOICE_SUMMARY_CONFIG,
          includePayButton: true
        });
        // Initialize empty recipients on error
        setRecipientEntries([]);
        setIsInitialized(true);
      } finally {
        setLoadingPreview(false);
      }
    };

    initializeModal();
  }, [isOpen, mode, templateKey, order.order_number, order.qb_invoice_id, order.customer_id, order.status]);

  // Fetch styled email preview from backend - ONLY after initialization
  // This effect handles UPDATES to emailConfig after initial load (user edits)
  useEffect(() => {
    // Skip if not open or not yet initialized (initialization effect handles first load)
    if (!isOpen || !isInitialized) return;

    const fetchPreview = async () => {
      try {
        // Don't show loading spinner for updates - keep old preview visible until new one arrives
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
        // Don't clear preview on error - keep showing last good preview
      }
    };

    // Debounce to avoid excessive requests while typing
    const timeoutId = setTimeout(fetchPreview, 300);
    return () => clearTimeout(timeoutId);
  }, [isOpen, isInitialized, order.order_number, emailConfig, invoiceEmailData, qbInvoiceData?.invoiceUrl]);

  // Handle email config changes from composer
  const handleEmailConfigChange = (config: InvoiceEmailConfig) => {
    setEmailConfig(config);
    const newSubject = config.subject;
    setSubject(newSubject);

    // Sync checkbox state with subject prefix (detect manual prefix removal)
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

  // Check sync status when modal opens with existing invoice (view or update mode)
  // Separate from initialization - runs after init to check for conflicts
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

  // Load invoice PDF (used for reload operations - initial load handled by initializeModal)
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

  // Handle marking invoice as sent without sending email
  const handleMarkAsSent = async () => {
    try {
      setLoading(true);
      setError(null);

      // If in create/update mode, create/update invoice first
      if (mode === 'create' || mode === 'update') {
        try {
          const result = mode === 'create'
            ? await qbInvoiceApi.createInvoice(order.order_number)
            : await qbInvoiceApi.updateInvoice(order.order_number);
          console.log(`Invoice ${mode}d:`, result);
        } catch (invoiceErr) {
          console.error(`Failed to ${mode} invoice:`, invoiceErr);
          const errMsg = invoiceErr instanceof Error ? invoiceErr.message : `Failed to ${mode} invoice`;
          setError(`Invoice ${mode} failed: ${errMsg}`);
          return;
        }
      }

      // Mark as sent
      await qbInvoiceApi.markAsSent(order.order_number);
      console.log('Invoice marked as sent');

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to mark invoice as sent:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as sent');
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

  // Handle linking existing invoice in create mode (two-panel)
  const handleLinkInvoiceFromCreate = async () => {
    if (!selectedLinkInvoice) return;

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

  // CREATE mode: Two-panel modal (Create New | Link Existing)
  if (mode === 'create') {
    // Order totals for link panel comparison
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
        onMouseDown={handleBackdropMouseDown}
        onMouseUp={handleBackdropMouseUp}
      >
        <div ref={modalContentRef} className={`bg-white shadow-2xl w-full flex flex-col ${
          isMobile ? 'min-h-full' : 'rounded-lg max-w-[1100px] max-h-[90vh]'
        }`}>
          {/* Header */}
          <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} border-b border-gray-200 flex-shrink-0`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-green-600`} />
                <div>
                  <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-900`}>Invoice Options</h2>
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
          {isMobile && (
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
          )}

          {/* Body - Two Panel Layout (Desktop) / Tabbed (Mobile) */}
          <div className={`flex-1 overflow-hidden flex ${isMobile ? 'flex-col' : ''}`}>
            {!isInitialized ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading...</span>
              </div>
            ) : (
              <>
                {/* Left Panel - Create New Invoice */}
                {(!isMobile || mobileCreateTab === 'create') && (
                  <div className={`${isMobile ? 'flex-1' : 'w-1/2 border-r border-gray-200'} flex flex-col overflow-hidden`}>
                    {/* Panel Header (Desktop only) */}
                    {!isMobile && (
                      <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-800 text-sm">Create New Invoice</span>
                        </div>
                      </div>
                    )}

                    {/* Invoice Preview Content */}
                    <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-4'}`}>
                      <div className={`bg-gray-50 rounded-lg border border-gray-200 ${isMobile ? 'p-4' : 'p-4'}`}>
                        {/* From/To/Date Header */}
                        <div className={`${isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-2 gap-4'} mb-4`}>
                          {/* From - Company */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">From</h4>
                            <p className="text-sm font-medium text-gray-900">
                              {companySettings?.company_name || 'Sign House'}
                            </p>
                            <p className="text-xs text-gray-600 whitespace-pre-line">
                              {companySettings?.company_address || ''}
                            </p>
                          </div>

                          {/* To - Customer */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill To</h4>
                            <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                            <p className="text-xs text-gray-600 whitespace-pre-line">
                              {formatAddress(customerBillingAddress)}
                            </p>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Invoice Date</h4>
                          <p className="text-sm text-gray-900">{formattedDate}</p>
                        </div>

                        {/* Line Items - Compact table */}
                        <div className="mb-4">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-300">
                                <th className="text-left py-1.5 font-medium text-gray-700">Item</th>
                                <th className="text-right py-1.5 font-medium text-gray-700 w-12">Qty</th>
                                <th className="text-right py-1.5 font-medium text-gray-700 w-16">Price</th>
                                <th className="text-right py-1.5 font-medium text-gray-700 w-16">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayParts.map((part, idx) => (
                                part.is_header_row ? (
                                  <tr key={idx} className="bg-gray-100">
                                    <td colSpan={4} className="py-1.5 px-1 font-semibold text-gray-900">
                                      {part.qb_description || part.invoice_description || 'Section Header'}
                                    </td>
                                  </tr>
                                ) : (
                                  <tr key={idx} className="border-b border-gray-200">
                                    <td className="py-1.5 text-gray-900">{part.qb_item_name || '-'}</td>
                                    <td className="py-1.5 text-right text-gray-600">{part.quantity}</td>
                                    <td className="py-1.5 text-right text-gray-600">
                                      ${Number(part.unit_price || 0).toFixed(2)}
                                    </td>
                                    <td className="py-1.5 text-right text-gray-900">
                                      ${Number(part.extended_price || 0).toFixed(2)}
                                    </td>
                                  </tr>
                                )
                              ))}
                              {displayParts.filter(p => !p.is_header_row).length === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-3 text-center text-gray-500 italic">
                                    No line items
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Totals */}
                        <div className="border-t border-gray-300 pt-3 space-y-1 text-sm">
                          <div className="flex justify-end">
                            <span className="w-24 text-gray-600">Subtotal:</span>
                            <span className="w-20 text-right font-medium">
                              ${totals.subtotal.toFixed(2)}
                            </span>
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
                            <span className="w-20 text-right font-bold text-gray-900">
                              ${totals.total.toFixed(2)}
                            </span>
                          </div>
                          {!!order.deposit_required && (
                            <div className="flex justify-end bg-green-50 px-2 py-1 rounded">
                              <span className="w-24 font-semibold text-green-700">Deposit (50%):</span>
                              <span className="w-20 text-right font-bold text-green-700">
                                ${totals.deposit.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Error Message */}
                      {error && (
                        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                          {error}
                        </div>
                      )}
                    </div>

                    {/* Left Panel Footer */}
                    <div className={`${isMobile ? 'px-4 py-3' : 'px-4 py-3'} border-t border-gray-200 bg-gray-50 flex-shrink-0`}>
                      <div className={`flex items-center ${isMobile ? 'flex-col-reverse gap-2' : 'justify-between'}`}>
                        <button
                          onClick={onSkip || onClose}
                          className={`text-gray-600 hover:text-gray-800 active:text-gray-900 text-sm ${
                            isMobile ? 'w-full py-2 min-h-[44px]' : 'px-3 py-2'
                          }`}
                        >
                          {onSkip ? 'Skip' : 'Cancel'}
                        </button>
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
                )}

                {/* Right Panel - Link Existing Invoice */}
                {(!isMobile || mobileCreateTab === 'link') && (
                  <div className={`${isMobile ? 'flex-1' : 'w-1/2'} flex flex-col overflow-hidden`}>
                    {/* Panel Header (Desktop only) */}
                    {!isMobile && (
                      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-blue-800 text-sm">Link Existing Invoice</span>
                        </div>
                      </div>
                    )}

                    {/* Invoice Linking Panel */}
                    <div className="flex-1 overflow-hidden">
                      <InvoiceLinkingPanel
                        orderNumber={order.order_number}
                        orderTotals={orderTotalsForLink}
                        onSelect={setSelectedLinkInvoice}
                        selectedInvoice={selectedLinkInvoice}
                        isMobile={isMobile}
                        compact={false}
                        isActive={isMobile ? mobileCreateTab === 'link' : true}
                      />
                    </div>

                    {/* Link Error */}
                    {linkError && (
                      <div className="mx-4 mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                        {linkError}
                      </div>
                    )}

                    {/* Right Panel Footer */}
                    <div className={`${isMobile ? 'px-4 py-3' : 'px-4 py-3'} border-t border-gray-200 bg-gray-50 flex-shrink-0`}>
                      <div className={`flex items-center ${isMobile ? 'flex-col-reverse gap-2' : 'justify-between'}`}>
                        <button
                          onClick={onSkip || onClose}
                          className={`text-gray-600 hover:text-gray-800 active:text-gray-900 text-sm ${
                            isMobile ? 'w-full py-2 min-h-[44px]' : 'px-3 py-2'
                          }`}
                        >
                          {onSkip ? 'Skip' : 'Cancel'}
                        </button>
                        <button
                          onClick={handleLinkInvoiceFromCreate}
                          disabled={linking || !selectedLinkInvoice}
                          className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
                            linking || !selectedLinkInvoice
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                          } ${isMobile ? 'w-full py-3 min-h-[44px]' : 'px-4 py-2'}`}
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
                )}
              </>
            )}
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

        {/* Loading State - Show spinner during first initialization */}
        {!isInitialized ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-gray-500 text-sm">Loading invoice...</span>
            </div>
          </div>
        ) : (
        <>
        {/* Left Panel - Header + Form + Footer (37% on desktop, full width on mobile when form tab) */}
        {(!isMobile || mobileTab === 'form') && (
        <div className={`${isMobile ? 'flex-1 overflow-hidden' : 'w-[37%] border-r border-gray-200'} flex flex-col`}>
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
                  onClick={() => onReassign(syncStatus === 'not_found')}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors border border-gray-300"
                >
                  <span>Reassign</span>
                </button>
              )}
            </div>
          </div>
          )}

          {/* Form Content */}
          <div className={`flex-1 overflow-y-auto min-h-0 ${isMobile ? 'p-4' : 'p-6'} space-y-6`}>
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
                    onClick={() => onReassign(syncStatus === 'not_found')}
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
                                  const confirmed = await showConfirmation({
                                    title: 'Cancel Scheduled Email',
                                    message: 'Cancel this scheduled email?',
                                    confirmText: 'Yes, Cancel',
                                    cancelText: 'No, Keep It',
                                    variant: 'danger'
                                  });
                                  if (confirmed) {
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

                  {/* Mark as Sent Button - for invoices not yet sent */}
                  {mode !== 'view' && (
                    <button
                      onClick={handleMarkAsSent}
                      disabled={loading || (mode === 'update' && !updateCompleted)}
                      className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
                        loading || (mode === 'update' && !updateCompleted)
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800'
                      } ${isMobile ? 'flex-1 py-3 min-h-[44px]' : 'px-4 py-2'}`}
                      title="Mark invoice as sent without sending an email"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {!isMobile && 'Mark Sent'}
                    </button>
                  )}
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
        <div className={`${isMobile ? 'flex-1 overflow-hidden' : 'w-[63%]'} bg-gray-50 flex flex-col`}>
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
              <div className="flex border-b border-gray-300 bg-gray-100 flex-shrink-0">
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
            <div className={`flex-1 min-h-0 ${
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
                  <iframe
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
                        {displayParts.map((part, idx) => (
                          part.is_header_row ? (
                            /* Header row - spans full width */
                            <tr key={idx} className="bg-gray-100">
                              <td colSpan={4} className="py-2 px-2 font-semibold text-gray-900">
                                {part.qb_description || part.invoice_description || 'Section Header'}
                              </td>
                            </tr>
                          ) : (
                            /* Regular billable row */
                            <tr key={idx} className="border-b border-gray-300">
                              <td className="py-2 text-gray-900">{part.invoice_description || part.qb_description || part.product_type}</td>
                              <td className="py-2 text-right text-gray-600">{part.quantity}</td>
                              <td className="py-2 text-right text-gray-600">${Number(part.unit_price || 0).toFixed(2)}</td>
                              <td className="py-2 text-right text-gray-900">${Number(part.extended_price || 0).toFixed(2)}</td>
                            </tr>
                          )
                        ))}
                        {displayParts.filter(p => !p.is_header_row).length === 0 && (
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
                          <span className={`w-32 ${totals.taxNotFound ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {totals.taxNotFound ? `⚠️ ${totals.taxName} (NOT FOUND):` : `Tax (${totals.taxName || 'Tax'} ${(totals.taxRate * 100).toFixed(0)}%):`}
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
        </>
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
