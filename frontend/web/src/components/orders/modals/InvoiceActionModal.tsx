/**
 * Invoice Action Modal
 * Phase 2.e: QuickBooks Invoice Automation
 *
 * Combined modal for Create/Update/Send invoice flow with:
 * - Invoice preview (line items from order parts)
 * - Email editor (recipients, subject, body)
 * - Schedule option for delayed send
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, Calendar, Send, FileText, RefreshCw, Clock, Mail, Eye, Truck, Package } from 'lucide-react';
import { Order, OrderPart } from '../../../types/orders';
import { qbInvoiceApi, EmailPreview, InvoiceDetails } from '../../../services/api/orders/qbInvoiceApi';

interface InvoiceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  mode: 'create' | 'update' | 'send';
  onSuccess: () => void;
  onSkip?: () => void;  // For status change prompts - allows skipping
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
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
  const [recipients, setRecipients] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // UI State
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'invoice' | 'email'>('email');
  const [htmlBody, setHtmlBody] = useState(''); // Full HTML for preview
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Custom message and subject prefix state
  const [customMessage, setCustomMessage] = useState('');
  const [pickupChecked, setPickupChecked] = useState(false);
  const [shippingChecked, setShippingChecked] = useState(false);

  // QB Invoice data for Invoice Details tab
  const [qbInvoiceData, setQbInvoiceData] = useState<InvoiceDetails | null>(null);
  const [loadingQbInvoice, setLoadingQbInvoice] = useState(false);

  // Determine template based on order type
  const templateKey = useMemo(() => {
    return order.deposit_required ? 'deposit_request' : 'full_invoice';
  }, [order.deposit_required]);

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

  // Initialize recipients from point persons
  useEffect(() => {
    if (isOpen && order.point_persons) {
      const emails = order.point_persons
        .map(pp => pp.contact_email)
        .filter((email): email is string => !!email);

      setRecipients(emails.length > 0 ? emails : []);
    }
  }, [isOpen, order.point_persons]);

  // Load email preview/template
  useEffect(() => {
    if (isOpen && (mode === 'create' || mode === 'send')) {
      loadEmailPreview();
    }
  }, [isOpen, mode, templateKey, order.order_number]);

  // Default subject format: {orderName} | Invoice #{orderNumber}
  const defaultSubject = `${order.order_name} | Invoice #${order.order_number}`;

  const loadEmailPreview = async () => {
    try {
      setLoadingPreview(true);
      const preview = await qbInvoiceApi.getEmailPreview(order.order_number, templateKey);
      // Use our default subject format instead of template's
      setSubject(defaultSubject);
      setHtmlBody(preview.body); // Store full HTML for preview
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
      setCustomMessage('');
      setPickupChecked(false);
      setShippingChecked(false);
      setQbInvoiceData(null);
    }
  }, [isOpen]);

  // Handle creating/updating invoice only (no email)
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

      onSuccess();
    } catch (err) {
      console.error(`Failed to ${mode} invoice:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${mode} invoice`);
    } finally {
      setLoading(false);
    }
  };

  // Handle sending invoice email
  const handleSendInvoice = async () => {
    if (recipients.length === 0) {
      setError('Please add at least one recipient');
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

      // Send or schedule email
      if (scheduleEnabled && scheduledDate) {
        const scheduledFor = `${scheduledDate}T${scheduledTime}:00`;
        await qbInvoiceApi.scheduleEmail(order.order_number, {
          recipients,
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          subject,
          body,
          templateKey,
          scheduledFor,
          attachPdf: true
        });
        console.log('Email scheduled for:', scheduledFor);
      } else {
        await qbInvoiceApi.sendEmail(order.order_number, {
          recipients,
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          subject,
          body,
          templateKey,
          attachPdf: true
        });
        console.log('Email sent immediately');
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to send invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invoice');
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

  // Add/remove recipient
  const addRecipient = (email: string) => {
    if (email && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  if (!isOpen) return null;

  const modalTitle = {
    create: 'Create Invoice',
    update: 'Update Invoice',
    send: 'Send Invoice'
  }[mode];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[95%] max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              {mode === 'create' && <FileText className="w-6 h-6 text-green-600" />}
              {mode === 'update' && <RefreshCw className="w-6 h-6 text-orange-500" />}
              {mode === 'send' && <Send className="w-6 h-6 text-blue-600" />}
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
        </div>

        {/* Content - Two Panels */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Form (45%) */}
          <div className="w-[45%] border-r border-gray-200 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Invoice Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Invoice Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{order.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                  </div>
                  {!order.cash && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax ({(totals.taxRate * 100).toFixed(0)}%):</span>
                      <span className="font-medium">${totals.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-gray-900 font-semibold">Total:</span>
                    <span className="text-gray-900 font-semibold">${totals.total.toFixed(2)}</span>
                  </div>
                  {order.deposit_required && (
                    <div className="flex justify-between text-green-700 bg-green-50 px-2 py-1 rounded">
                      <span className="font-medium">Deposit (50%):</span>
                      <span className="font-semibold">${totals.deposit.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline-block mr-1" />
                  Recipients
                </label>
                <div className="space-y-2">
                  {recipients.map((email, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-gray-100 rounded px-3 py-2"
                    >
                      <span className="text-sm">{email}</span>
                      <button
                        onClick={() => removeRecipient(email)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Add recipient email..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          addRecipient(input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                        if (input) {
                          addRecipient(input.value);
                          input.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm hover:bg-gray-200"
                    >
                      Add
                    </button>
                  </div>
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
                <p className="text-xs text-gray-500 mt-1">
                  This will appear between the greeting and invoice details.
                </p>
              </div>

              {/* Schedule Option */}
              <div className="bg-blue-50 rounded-lg p-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Schedule for later</span>
                </label>
                {scheduleEnabled && (
                  <div className="mt-3 flex gap-3">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Preview (55%) */}
          <div className="w-[55%] bg-gray-50 flex flex-col">
            {/* Preview Tabs */}
            <div className="flex border-b border-gray-200 px-6 pt-4">
              <button
                onClick={() => setPreviewTab('email')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  previewTab === 'email'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Eye className="w-4 h-4 inline-block mr-1.5" />
                Email Preview
              </button>
              <button
                onClick={() => setPreviewTab('invoice')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  previewTab === 'invoice'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4 inline-block mr-1.5" />
                Invoice Details
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {previewTab === 'email' ? (
                /* Email Preview - Rendered HTML */
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  {loadingPreview ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-500">Loading preview...</span>
                    </div>
                  ) : htmlBody ? (
                    <iframe
                      ref={iframeRef}
                      srcDoc={htmlBody}
                      title="Email Preview"
                      className="w-full h-[600px] border-0"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No email preview available
                    </div>
                  )}
                </div>
              ) : (
                /* Invoice Details - QB Data or Local Preview */
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  {loadingQbInvoice ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-500">Loading invoice from QuickBooks...</span>
                    </div>
                  ) : qbInvoiceData ? (
                    /* QB Invoice Data */
                    <>
                      {/* Header */}
                      <div className="flex justify-between items-start mb-6 pb-4 border-b">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">INVOICE</h4>
                          <p className="text-sm text-gray-600">#{qbInvoiceData.docNumber}</p>
                          <p className="text-xs text-green-600 mt-1">From QuickBooks</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-medium">{qbInvoiceData.customerName}</p>
                          <p className="text-gray-600">{new Date(qbInvoiceData.txnDate).toLocaleDateString()}</p>
                          {qbInvoiceData.dueDate && (
                            <p className="text-gray-500">Due: {new Date(qbInvoiceData.dueDate).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>

                      {/* QB Totals */}
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-end">
                          <span className="w-32 font-semibold text-gray-900">Total:</span>
                          <span className="w-28 text-right font-bold text-gray-900">${qbInvoiceData.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-end">
                          <span className="w-32 text-gray-600">Balance Due:</span>
                          <span className={`w-28 text-right font-semibold ${qbInvoiceData.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${qbInvoiceData.balance.toFixed(2)}
                          </span>
                        </div>
                        {qbInvoiceData.balance === 0 && (
                          <div className="flex justify-end">
                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                              Paid in Full
                            </span>
                          </div>
                        )}
                        <div className="pt-4 mt-4 border-t">
                          <a
                            href={qbInvoiceData.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View in QuickBooks →
                          </a>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Local Preview - No QB Invoice Yet */
                    <>
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
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              {onSkip ? 'Skip' : 'Cancel'}
            </button>

            <div className="flex items-center space-x-3">
              {/* Invoice Only Button (for create/update modes) */}
              {(mode === 'create' || mode === 'update') && (
                <button
                  onClick={handleInvoiceOnly}
                  disabled={loading}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    `${mode === 'create' ? 'Create' : 'Update'} Only`
                  )}
                </button>
              )}

              {/* Send Button */}
              <button
                onClick={handleSendInvoice}
                disabled={loading || recipients.length === 0}
                className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 ${
                  loading || recipients.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : scheduleEnabled
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : scheduleEnabled ? (
                  <>
                    <Calendar className="w-4 h-4" />
                    Schedule Email
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {mode === 'send' ? 'Send Now' : `${mode === 'create' ? 'Create' : 'Update'} & Send`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceActionModal;
