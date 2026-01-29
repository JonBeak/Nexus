/**
 * InvoiceEmailComposer Component
 * 4-part email editor: Beginning + Summary + Pay Button + End
 * Based on EstimateEmailComposer pattern
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Package, Truck, CheckCircle } from 'lucide-react';
import { formatDateLong } from '../../../utils/dateUtils';
import { useIsMobile } from '../../../hooks/useMediaQuery';

// Summary config for invoice email
export interface InvoiceSummaryConfig {
  includeJobName: boolean;
  includeJobNumber: boolean;  // Customer Job # (auto-included if exists)
  includePO: boolean;         // PO # (auto-included if exists)
  includeOrderNumber: boolean; // Internal order # (estimate mode)
  includeInvoiceNumber: boolean;
  includeInvoiceDate: boolean;
  includeDueDate: boolean;
  // Estimate-specific fields
  includeEstimateNumber: boolean;
  includeEstimateDate: boolean;
  includeValidUntil: boolean;
  // Common fields
  includeSubtotal: boolean;
  includeTax: boolean;
  includeTotal: boolean;
  includeBalanceDue: boolean;
}

export const DEFAULT_INVOICE_SUMMARY_CONFIG: InvoiceSummaryConfig = {
  includeJobName: true,
  includeJobNumber: true,   // Auto-include if exists
  includePO: true,          // Auto-include if exists
  includeOrderNumber: false,
  includeInvoiceNumber: true,
  includeInvoiceDate: false,
  includeDueDate: true,
  includeEstimateNumber: false,
  includeEstimateDate: false,
  includeValidUntil: false,
  includeSubtotal: false,
  includeTax: false,
  includeTotal: true,
  includeBalanceDue: false
};

// Default config for estimate emails
export const DEFAULT_ESTIMATE_SUMMARY_CONFIG: InvoiceSummaryConfig = {
  includeJobName: true,
  includeJobNumber: true,   // Customer Ref # (auto-include if exists)
  includePO: true,          // PO # (auto-include if exists)
  includeOrderNumber: true, // Internal order #
  includeInvoiceNumber: false,
  includeInvoiceDate: false,
  includeDueDate: false,
  includeEstimateNumber: true,  // QB Estimate #
  includeEstimateDate: true,
  includeValidUntil: false,     // Off by default
  includeSubtotal: false,
  includeTax: false,
  includeTotal: true,
  includeBalanceDue: true       // Balance Due if > 0
};

export interface InvoiceEmailData {
  jobName?: string;
  jobNumber?: string;       // Customer Job #
  customerPO?: string;      // PO #
  customerJobNumber?: string; // Legacy alias for jobNumber
  orderNumber?: number;     // Internal order number
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  // Estimate-specific fields
  estimateNumber?: string;  // QB Estimate #
  estimateDate?: string;
  validUntil?: string;
  // Common fields
  subtotal?: number;
  tax?: number;
  total?: number;
  balanceDue?: number;
}

export interface InvoiceEmailConfig {
  subject: string;
  beginning: string;
  end: string;
  summaryConfig: InvoiceSummaryConfig;
  includePayButton: boolean;
}

interface InvoiceEmailComposerProps {
  // Document type determines which fields are shown
  documentType?: 'invoice' | 'estimate';
  // Config-based initialization (preferred)
  config?: InvoiceEmailConfig;
  // OR individual initial values (backwards compatible)
  initialSubject?: string;
  initialBeginning?: string;
  initialEnd?: string;
  initialSummaryConfig?: InvoiceSummaryConfig;
  initialIncludePayButton?: boolean;
  // Common props
  invoiceData?: InvoiceEmailData;
  onChange: (config: InvoiceEmailConfig) => void;
  disabled?: boolean;
  // Subject prefix options (Ready for Pickup/Shipping/Completed)
  pickupChecked?: boolean;
  shippingChecked?: boolean;
  completedChecked?: boolean;
  onPickupChange?: (checked: boolean) => void;
  onShippingChange?: (checked: boolean) => void;
  onCompletedChange?: (checked: boolean) => void;
  // Order status for auto-checking pickup/shipping on mount
  orderStatus?: string;
}

export const DEFAULT_INVOICE_BEGINNING = `Dear {{customerName}},

Please find attached the invoice for your order.`;

export const DEFAULT_INVOICE_END = `Payment Options:
• Interac e-Transfer to info@signhouse.ca
• Credit Card (please call our office)
• Cheque
• QuickBooks Online payment portal

If you have any questions, please don't hesitate to reach out.

Thank you for your business!

Best regards,
The Sign House Team`;

// Internal aliases for backwards compatibility
const DEFAULT_BEGINNING = DEFAULT_INVOICE_BEGINNING;
const DEFAULT_END = DEFAULT_INVOICE_END;

// Format currency helper
const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return '-';
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};


const InvoiceEmailComposer: React.FC<InvoiceEmailComposerProps> = ({
  documentType = 'invoice',
  config,
  initialSubject = '',
  initialBeginning = '',
  initialEnd = '',
  initialSummaryConfig,
  initialIncludePayButton = true,
  invoiceData,
  onChange,
  disabled = false,
  pickupChecked = false,
  shippingChecked = false,
  completedChecked = false,
  onPickupChange,
  onShippingChange,
  onCompletedChange,
  orderStatus
}) => {
  const isEstimate = documentType === 'estimate';
  // Use config prop if provided, otherwise fall back to individual initial props
  const [subject, setSubject] = useState(config?.subject || initialSubject);
  const [beginning, setBeginning] = useState(config?.beginning || initialBeginning || DEFAULT_BEGINNING);
  const [end, setEnd] = useState(config?.end || initialEnd || DEFAULT_END);
  const [summaryConfig, setSummaryConfig] = useState<InvoiceSummaryConfig>(
    config?.summaryConfig || initialSummaryConfig || DEFAULT_INVOICE_SUMMARY_CONFIG
  );
  const [includePayButton, setIncludePayButton] = useState(config?.includePayButton ?? initialIncludePayButton);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const isMobile = useIsMobile();

  // Refs for auto-resizing textareas
  const beginningRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea helper
  const autoResize = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Auto-resize on content change
  useEffect(() => {
    autoResize(beginningRef.current);
  }, [beginning]);

  useEffect(() => {
    autoResize(endRef.current);
  }, [end]);

  // Calculate if any summary fields are enabled
  const anySummaryEnabled = Object.values(summaryConfig).some(v => v);

  // Sync with config prop when it changes (takes priority over initial* props)
  useEffect(() => {
    if (config?.subject) setSubject(config.subject);
    else if (initialSubject) setSubject(initialSubject);
  }, [config?.subject, initialSubject]);

  useEffect(() => {
    if (config?.beginning) setBeginning(config.beginning);
    else setBeginning(initialBeginning || DEFAULT_BEGINNING);
  }, [config?.beginning, initialBeginning]);

  useEffect(() => {
    if (config?.end) setEnd(config.end);
    else setEnd(initialEnd || DEFAULT_END);
  }, [config?.end, initialEnd]);

  useEffect(() => {
    if (config?.summaryConfig) setSummaryConfig(config.summaryConfig);
    else if (initialSummaryConfig) setSummaryConfig(initialSummaryConfig);
  }, [config?.summaryConfig, initialSummaryConfig]);

  useEffect(() => {
    if (config?.includePayButton !== undefined) setIncludePayButton(config.includePayButton);
    else setIncludePayButton(initialIncludePayButton);
  }, [config?.includePayButton, initialIncludePayButton]);

  // Note: Auto-apply prefix based on order status is now handled in the parent component
  // (InvoiceActionModal) to avoid race conditions between child and parent state updates

  // Notify parent of changes
  const notifyChange = useCallback((
    newSubject: string,
    newBeginning: string,
    newEnd: string,
    newConfig: InvoiceSummaryConfig,
    newIncludePayButton: boolean
  ) => {
    onChange({
      subject: newSubject,
      beginning: newBeginning,
      end: newEnd,
      summaryConfig: newConfig,
      includePayButton: newIncludePayButton
    });
  }, [onChange]);

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    notifyChange(value, beginning, end, summaryConfig, includePayButton);
  };

  const handleBeginningChange = (value: string) => {
    setBeginning(value);
    notifyChange(subject, value, end, summaryConfig, includePayButton);
  };

  const handleEndChange = (value: string) => {
    setEnd(value);
    notifyChange(subject, beginning, value, summaryConfig, includePayButton);
  };

  const handleConfigChange = (key: keyof InvoiceSummaryConfig, value: boolean) => {
    const newConfig = { ...summaryConfig, [key]: value };
    setSummaryConfig(newConfig);
    notifyChange(subject, beginning, end, newConfig, includePayButton);
  };

  const handleIncludePayButtonChange = (value: boolean) => {
    setIncludePayButton(value);
    notifyChange(subject, beginning, end, summaryConfig, value);
  };

  // Regex to match any of the subject prefixes
  const prefixRegex = /^\[(Ready for Pickup|Ready for Shipping|Order Completed)\]\s*/;

  // Handle pickup checkbox - add/remove [Ready for Pickup] prefix
  const handlePickupCheckbox = (checked: boolean) => {
    let newSubject = subject;
    if (checked) {
      // Remove any existing prefix and add pickup prefix
      const cleanSubject = subject.replace(prefixRegex, '');
      newSubject = `[Ready for Pickup] ${cleanSubject}`;
    } else {
      // Remove the prefix
      newSubject = subject.replace(/^\[Ready for Pickup\]\s*/, '');
    }
    setSubject(newSubject);
    notifyChange(newSubject, beginning, end, summaryConfig, includePayButton);
    onPickupChange?.(checked);
  };

  // Handle shipping checkbox - add/remove [Ready for Shipping] prefix
  const handleShippingCheckbox = (checked: boolean) => {
    let newSubject = subject;
    if (checked) {
      // Remove any existing prefix and add shipping prefix
      const cleanSubject = subject.replace(prefixRegex, '');
      newSubject = `[Ready for Shipping] ${cleanSubject}`;
    } else {
      // Remove the prefix
      newSubject = subject.replace(/^\[Ready for Shipping\]\s*/, '');
    }
    setSubject(newSubject);
    notifyChange(newSubject, beginning, end, summaryConfig, includePayButton);
    onShippingChange?.(checked);
  };

  // Handle completed checkbox - add/remove [Order Completed] prefix
  const handleCompletedCheckbox = (checked: boolean) => {
    let newSubject = subject;
    if (checked) {
      // Remove any existing prefix and add completed prefix
      const cleanSubject = subject.replace(prefixRegex, '');
      newSubject = `[Order Completed] ${cleanSubject}`;
    } else {
      // Remove the prefix
      newSubject = subject.replace(/^\[Order Completed\]\s*/, '');
    }
    setSubject(newSubject);
    notifyChange(newSubject, beginning, end, summaryConfig, includePayButton);
    onCompletedChange?.(checked);
  };

  const handleToggleAllSummary = (enabled: boolean) => {
    const newConfig: InvoiceSummaryConfig = {
      includeJobName: enabled,
      includeJobNumber: enabled,
      includePO: enabled,
      includeOrderNumber: enabled,
      includeInvoiceNumber: enabled,
      includeInvoiceDate: enabled,
      includeDueDate: enabled,
      includeEstimateNumber: enabled,
      includeEstimateDate: enabled,
      includeValidUntil: enabled,
      includeSubtotal: enabled,
      includeTax: enabled,
      includeTotal: enabled,
      includeBalanceDue: enabled
    };
    setSummaryConfig(newConfig);
    notifyChange(subject, beginning, end, newConfig, includePayButton);
  };

  // Reset to defaults
  const resetToDefaults = () => {
    const defaultConfig = { ...DEFAULT_INVOICE_SUMMARY_CONFIG };
    setBeginning(DEFAULT_BEGINNING);
    setEnd(DEFAULT_END);
    setSummaryConfig(defaultConfig);
    setIncludePayButton(true);
    notifyChange(subject, DEFAULT_BEGINNING, DEFAULT_END, defaultConfig, true);
  };

  return (
    <div className="space-y-3">
      {/* Subject */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Email Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          disabled={disabled}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          placeholder="Enter email subject..."
        />
        {/* Subject Prefix Checkboxes - Ready for Pickup/Shipping */}
        {(onPickupChange || onShippingChange) && (
          <div className={`mt-2 ${isMobile ? 'flex flex-col gap-2' : 'flex gap-4'}`}>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={pickupChecked}
                onChange={(e) => handlePickupCheckbox(e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <Package className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">Ready for Pickup</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={shippingChecked}
                onChange={(e) => handleShippingCheckbox(e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <Truck className="w-4 h-4 text-blue-600" />
              <span className="text-gray-700">Ready for Shipping</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={completedChecked}
                onChange={(e) => handleCompletedCheckbox(e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <CheckCircle className="w-4 h-4 text-purple-600" />
              <span className="text-gray-700">Order Completed</span>
            </label>
          </div>
        )}
      </div>

      {/* Beginning (Opening Message) */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Opening Message
        </label>
        <textarea
          ref={beginningRef}
          value={beginning}
          onChange={(e) => handleBeginningChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-none overflow-hidden"
          placeholder="Enter opening message..."
          style={{ minHeight: '70px' }}
        />
      </div>

      {/* Summary Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Summary Header */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100"
          onClick={() => setSummaryExpanded(!summaryExpanded)}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={anySummaryEnabled}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleAllSummary(e.target.checked);
              }}
              disabled={disabled}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-gray-700">
              Include {isEstimate ? 'Estimate' : 'Invoice'} Summary
            </span>
          </div>
          {summaryExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>

        {/* Summary Content */}
        {summaryExpanded && (
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className={`${isMobile ? 'flex flex-col gap-4' : 'flex gap-4'}`}>
              {/* Checkboxes - Left Side (Top on mobile) */}
              <div className={`flex flex-col ${isMobile ? 'gap-2' : 'gap-1.5'}`}>
                {/* Common: Job Name */}
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeJobName}
                    onChange={(e) => handleConfigChange('includeJobName', e.target.checked)}
                    disabled={disabled}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Job Name</span>
                </label>
                {/* Common: Customer Ref # (Job #) */}
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeJobNumber && !!invoiceData?.jobNumber}
                    onChange={(e) => handleConfigChange('includeJobNumber', e.target.checked)}
                    disabled={disabled || !invoiceData?.jobNumber}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={!invoiceData?.jobNumber ? 'text-gray-400' : ''}>
                    {isEstimate ? 'Customer Ref #' : 'Job #'} {!invoiceData?.jobNumber && '(none)'}
                  </span>
                </label>
                {/* Common: PO # */}
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includePO && !!invoiceData?.customerPO}
                    onChange={(e) => handleConfigChange('includePO', e.target.checked)}
                    disabled={disabled || !invoiceData?.customerPO}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={!invoiceData?.customerPO ? 'text-gray-400' : ''}>
                    PO # {!invoiceData?.customerPO && '(none)'}
                  </span>
                </label>
                {/* Estimate only: Order # */}
                {isEstimate && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={summaryConfig.includeOrderNumber}
                      onChange={(e) => handleConfigChange('includeOrderNumber', e.target.checked)}
                      disabled={disabled}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Order #</span>
                  </label>
                )}
                {/* Invoice only: Invoice # */}
                {!isEstimate && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={summaryConfig.includeInvoiceNumber}
                      onChange={(e) => handleConfigChange('includeInvoiceNumber', e.target.checked)}
                      disabled={disabled}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Invoice #</span>
                  </label>
                )}
                {/* Invoice only: Invoice Date */}
                {!isEstimate && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={summaryConfig.includeInvoiceDate}
                      onChange={(e) => handleConfigChange('includeInvoiceDate', e.target.checked)}
                      disabled={disabled}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Invoice Date</span>
                  </label>
                )}
                {/* Invoice only: Due Date */}
                {!isEstimate && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={summaryConfig.includeDueDate}
                      onChange={(e) => handleConfigChange('includeDueDate', e.target.checked)}
                      disabled={disabled}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Due Date</span>
                  </label>
                )}
                {/* Estimate only: QB Estimate # */}
                {isEstimate && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={summaryConfig.includeEstimateNumber && !!invoiceData?.estimateNumber}
                      onChange={(e) => handleConfigChange('includeEstimateNumber', e.target.checked)}
                      disabled={disabled || !invoiceData?.estimateNumber}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={!invoiceData?.estimateNumber ? 'text-gray-400' : ''}>
                      QB Estimate # {!invoiceData?.estimateNumber && '(none)'}
                    </span>
                  </label>
                )}
                {/* Estimate only: Estimate Date */}
                {isEstimate && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={summaryConfig.includeEstimateDate}
                      onChange={(e) => handleConfigChange('includeEstimateDate', e.target.checked)}
                      disabled={disabled}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Estimate Date</span>
                  </label>
                )}
                {/* Estimate only: Valid Until */}
                {isEstimate && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={summaryConfig.includeValidUntil}
                      onChange={(e) => handleConfigChange('includeValidUntil', e.target.checked)}
                      disabled={disabled}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Valid Until</span>
                  </label>
                )}
                {/* Common: Subtotal */}
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeSubtotal}
                    onChange={(e) => handleConfigChange('includeSubtotal', e.target.checked)}
                    disabled={disabled}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Subtotal</span>
                </label>
                {/* Common: Tax */}
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeTax}
                    onChange={(e) => handleConfigChange('includeTax', e.target.checked)}
                    disabled={disabled}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Tax</span>
                </label>
                {/* Common: Total */}
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeTotal}
                    onChange={(e) => handleConfigChange('includeTotal', e.target.checked)}
                    disabled={disabled}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Total</span>
                </label>
                {/* Common: Balance Due */}
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={summaryConfig.includeBalanceDue && (invoiceData?.balanceDue === undefined || invoiceData.balanceDue > 0)}
                    onChange={(e) => handleConfigChange('includeBalanceDue', e.target.checked)}
                    disabled={disabled || (invoiceData?.balanceDue !== undefined && invoiceData.balanceDue <= 0)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={(invoiceData?.balanceDue !== undefined && invoiceData.balanceDue <= 0) ? 'text-gray-400' : ''}>
                    Balance Due {(invoiceData?.balanceDue !== undefined && invoiceData.balanceDue <= 0) && '(none)'}
                  </span>
                </label>
              </div>

              {/* Live Preview - Right Side (Bottom on mobile) */}
              {anySummaryEnabled && invoiceData && (
                <div className={`${isMobile ? 'w-full' : 'w-56 ml-auto'} p-2 bg-gray-50 rounded border border-gray-200 text-xs`}>
                  <div className="text-gray-500 mb-1.5 font-medium">Preview</div>
                  <div className="space-y-0.5">
                    {summaryConfig.includeJobName && invoiceData.jobName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Job Name:</span>
                        <span className="font-medium text-gray-800">{invoiceData.jobName}</span>
                      </div>
                    )}
                    {summaryConfig.includeJobNumber && invoiceData.jobNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isEstimate ? 'Customer Ref #:' : 'Job #:'}</span>
                        <span className="font-medium text-gray-800">{invoiceData.jobNumber}</span>
                      </div>
                    )}
                    {summaryConfig.includePO && invoiceData.customerPO && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">PO #:</span>
                        <span className="font-medium text-gray-800">{invoiceData.customerPO}</span>
                      </div>
                    )}
                    {/* Estimate only: Order # */}
                    {isEstimate && summaryConfig.includeOrderNumber && invoiceData.orderNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Order #:</span>
                        <span className="font-medium text-gray-800">{invoiceData.orderNumber}</span>
                      </div>
                    )}
                    {/* Invoice only fields */}
                    {!isEstimate && summaryConfig.includeInvoiceNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Invoice #:</span>
                        <span className="font-medium text-gray-800">{invoiceData.invoiceNumber || '-'}</span>
                      </div>
                    )}
                    {!isEstimate && summaryConfig.includeInvoiceDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Invoice Date:</span>
                        <span className="font-medium text-gray-800">{formatDateLong(invoiceData.invoiceDate)}</span>
                      </div>
                    )}
                    {!isEstimate && summaryConfig.includeDueDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Due Date:</span>
                        <span className="font-medium text-gray-800">{formatDateLong(invoiceData.dueDate)}</span>
                      </div>
                    )}
                    {/* Estimate only fields */}
                    {isEstimate && summaryConfig.includeEstimateNumber && invoiceData.estimateNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">QB Estimate #:</span>
                        <span className="font-medium text-gray-800">{invoiceData.estimateNumber}</span>
                      </div>
                    )}
                    {isEstimate && summaryConfig.includeEstimateDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Estimate Date:</span>
                        <span className="font-medium text-gray-800">{formatDateLong(invoiceData.estimateDate)}</span>
                      </div>
                    )}
                    {isEstimate && summaryConfig.includeValidUntil && invoiceData.validUntil && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Valid Until:</span>
                        <span className="font-medium text-gray-800">{formatDateLong(invoiceData.validUntil)}</span>
                      </div>
                    )}
                    {/* Common financial fields */}
                    {summaryConfig.includeSubtotal && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal:</span>
                        <span className="font-medium text-gray-800">{formatCurrency(invoiceData.subtotal)}</span>
                      </div>
                    )}
                    {summaryConfig.includeTax && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tax:</span>
                        <span className="font-medium text-gray-800">{formatCurrency(invoiceData.tax)}</span>
                      </div>
                    )}
                    {summaryConfig.includeTotal && (
                      <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                        <span className="font-medium text-gray-700">Total:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(invoiceData.total)}</span>
                      </div>
                    )}
                    {summaryConfig.includeBalanceDue && invoiceData.balanceDue !== undefined && invoiceData.balanceDue > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span className="font-medium">Balance Due:</span>
                        <span className="font-bold">{formatCurrency(invoiceData.balanceDue)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Include Pay Button Checkbox - Invoice only */}
      {!isEstimate && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <input
            type="checkbox"
            checked={includePayButton}
            onChange={(e) => handleIncludePayButtonChange(e.target.checked)}
            disabled={disabled}
            className="rounded border-green-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-xs font-medium text-green-800">
            Include "View & Pay Invoice" button
          </span>
        </div>
      )}

      {/* End (Closing Message) */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Closing Message
        </label>
        <textarea
          ref={endRef}
          value={end}
          onChange={(e) => handleEndChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-none overflow-hidden"
          placeholder="Enter closing message..."
          style={{ minHeight: '80px' }}
        />
      </div>

      {/* Reset Button */}
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={resetToDefaults}
          disabled={disabled}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset to Default
        </button>
        <span className="text-gray-400 italic">
          Footer added automatically
        </span>
      </div>
    </div>
  );
};

export default InvoiceEmailComposer;
