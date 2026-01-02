import React, { useState, useRef, useEffect } from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { EstimatePreviewData } from './core/layers/CalculationLayer';
import { generateEstimateSVG } from './utils/svgEstimateExporter';
import { EstimateVersion, EmailSummaryConfig } from './types';
import EstimatePointPersonsEditor, { PointPersonEntry } from './EstimatePointPersonsEditor';
import EstimateEmailComposer from './EstimateEmailComposer';
import { EstimateEmailPreviewModal, EmailRecipients } from './components/EstimateEmailPreviewModal';
import { EstimateTableHeader } from './components/EstimateTableHeader';
import { jobVersioningApi } from '@/services/jobVersioningApi';
import { PAGE_STYLES } from '@/constants/moduleColors';

interface EstimateTableProps {
  estimate: EstimateVersion | null; // Used to check is_draft for QB integration
  hasValidationErrors?: boolean;
  validationErrorCount?: number;
  estimatePreviewData?: EstimatePreviewData | null; // NEW: Complete estimate preview data
  hoveredRowId?: string | null; // Cross-component hover state
  onRowHover?: (rowId: string | null) => void; // Hover handler
  customerName?: string | null;
  jobName?: string | null;
  version?: string | null;
  // QuickBooks integration props
  qbEstimateId?: string | null;
  qbEstimateUrl?: string | null;
  qbCreatingEstimate?: boolean;
  qbConnected?: boolean;
  qbCheckingStatus?: boolean;
  isApproved?: boolean;
  onCreateQBEstimate?: () => void;
  onOpenQBEstimate?: () => void;
  onConnectQB?: () => void;
  onDisconnectQB?: () => void;
  // Phase 7: Point Persons
  customerId?: number;
  pointPersons?: PointPersonEntry[];
  onPointPersonsChange?: (pointPersons: PointPersonEntry[]) => void;
  onSavePointPersons?: () => Promise<void>;
  // Phase 7: Email Content (3-part structure)
  emailSubject?: string;
  emailBeginning?: string;
  emailEnd?: string;
  emailSummaryConfig?: EmailSummaryConfig;
  onEmailChange?: (subject: string, beginning: string, end: string, summaryConfig: EmailSummaryConfig) => void;
  // Phase 7: Workflow handlers
  onPrepareEstimate?: () => void;
  onSendToCustomer?: (recipients?: EmailRecipients) => void;
  isPreparing?: boolean;
  isSending?: boolean;
  // Hide send workflow sections when displayed in separate panel
  hideSendWorkflow?: boolean;
  // Hide all QB buttons in header (for Estimate Preview mode)
  hideQBButtons?: boolean;
}

// Split number into whole and decimal parts for alignment
const splitNumber = (amount: number): { whole: string; decimal: string } => {
  const hasDecimals = amount % 1 !== 0;
  if (hasDecimals) {
    const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const parts = formatted.split('.');
    return { whole: parts[0], decimal: `.${parts[1]}` };
  } else {
    return { whole: amount.toLocaleString(), decimal: '' };
  }
};

const formatCurrencyValue = (amount: number): string => {
  // Format just the number part with comma separators
  if (amount % 1 === 0) {
    // Add invisible padding to align with decimal numbers (.00)
    return `${amount.toLocaleString()}\u2007\u2007\u2007`; // \u2007 is figure space (same width as digits)
  } else {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

const formatNumber = (amount: number): string => {
  // Format number without $ sign, with comma separators
  if (amount % 1 === 0) {
    return `${amount.toLocaleString()}\u2007\u2007\u2007`;
  } else {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

// For clipboard copy - keep $ attached to number
const formatCurrency = (amount: number): string => {
  if (amount % 1 === 0) {
    return `$${amount.toLocaleString()}\u2007\u2007\u2007`;
  } else {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

const formatPercent = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`;
};

const getQuantityBackground = (quantity: number): string => {
  if (quantity <= 1) return 'transparent';

  // Scale from 1 to 10, capped at 10
  const cappedQty = Math.min(quantity, 10);
  const intensity = (cappedQty - 1) / 9; // 0 to 1

  // Interpolate from red-100 (254,226,226) to red-300 (252,165,165)
  const r = Math.round(254 - (intensity * 2)); // 254 to 252
  const g = Math.round(226 - (intensity * 61)); // 226 to 165
  const b = Math.round(226 - (intensity * 61)); // 226 to 165

  return `rgb(${r}, ${g}, ${b})`;
};

export const EstimateTable: React.FC<EstimateTableProps> = ({
  estimate,
  hasValidationErrors = false,
  validationErrorCount = 0,
  estimatePreviewData = null,
  hoveredRowId = null,
  onRowHover = () => {},
  customerName = null,
  jobName = null,
  version = null,
  qbEstimateId = null,
  qbEstimateUrl = null,
  qbCreatingEstimate = false,
  qbConnected = false,
  qbCheckingStatus = false,
  isApproved = false,
  onCreateQBEstimate,
  onOpenQBEstimate,
  onConnectQB,
  onDisconnectQB,
  // Phase 7: New props
  customerId,
  pointPersons,
  onPointPersonsChange,
  onSavePointPersons,
  emailSubject,
  emailBeginning,
  emailEnd,
  emailSummaryConfig,
  onEmailChange,
  onPrepareEstimate,
  onSendToCustomer,
  isPreparing = false,
  isSending = false,
  hideSendWorkflow = false,
  hideQBButtons = false
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isConvertedToOrder, setIsConvertedToOrder] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if estimate is converted to order
  useEffect(() => {
    if (!estimate?.id) {
      setIsConvertedToOrder(false);
      return;
    }

    setIsConvertedToOrder(estimate.status === 'ordered');
  }, [estimate?.status]);

  const handleCopyToClipboard = async () => {
    if (!estimatePreviewData || estimatePreviewData.items.length === 0) {
      console.error('No estimate data available');
      return;
    }

    try {
      // Generate SVG
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const svg = generateEstimateSVG(estimatePreviewData, {
        customerName: customerName || estimatePreviewData.customerName || undefined,
        jobName: jobName || undefined,
        version: version || undefined,
        description: estimate?.notes || undefined,
        date: currentDate
      });

      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(svg);
      } else {
        // Fallback for non-HTTPS/localhost environments

        const textArea = document.createElement('textarea');
        textArea.value = svg;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand('copy');
          if (!successful) {
            throw new Error('Fallback copy method failed');
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }

      // Show success feedback
      setCopySuccess(true);

      // Reset after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('❌ Copy failed:', error);
    }
  };

  return (
    <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow mb-8 w-full border ${PAGE_STYLES.border}`}>
      {/* Header */}
      <EstimateTableHeader
        isDraft={estimate?.is_draft ?? false}
        isPrepared={estimate?.is_prepared ?? false}
        isApproved={isApproved}
        qbEstimateId={qbEstimateId}
        qbEstimateUrl={qbEstimateUrl}
        qbConnected={qbConnected}
        qbCheckingStatus={qbCheckingStatus}
        qbCreatingEstimate={qbCreatingEstimate}
        hideQBButtons={hideQBButtons}
        hasValidationErrors={hasValidationErrors}
        hasEstimateData={!!estimatePreviewData && estimatePreviewData.items.length > 0}
        pointPersonsCount={pointPersons?.length ?? 0}
        onSavePointPersons={onSavePointPersons || (async () => {})}
        isPreparing={isPreparing}
        isSending={isSending}
        onConnectQB={onConnectQB || (() => {})}
        onCreateQBEstimate={onCreateQBEstimate || (() => {})}
        onOpenQBEstimate={onOpenQBEstimate || (() => {})}
        onPrepareEstimate={onPrepareEstimate || (() => {})}
        onOpenEmailPreview={() => setShowEmailPreview(true)}
      />

      {/* Content */}
      <div ref={contentRef} className="p-3">
        {!estimatePreviewData ? (
          <div className={`text-center py-6 ${PAGE_STYLES.panel.textMuted}`}>
            <FileText className={`w-8 h-8 mx-auto mb-2 ${PAGE_STYLES.panel.textMuted}`} />
            <p className="text-sm font-medium mb-1">No estimate data</p>
            <p className="text-xs">Complete the grid to see estimate preview</p>
          </div>
        ) : estimatePreviewData.items.length === 0 ? (
          <div className={`text-center py-6 ${PAGE_STYLES.panel.textMuted}`}>
            <FileText className={`w-8 h-8 mx-auto mb-2 ${PAGE_STYLES.panel.textMuted}`} />
            <p className="text-sm font-medium mb-1">No items calculated</p>
            <p className="text-xs">Add products to the grid to see pricing</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Validation Error Warning */}
            {hasValidationErrors ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <strong>Validation Errors Detected</strong>
                    <p className="mt-1">
                      {validationErrorCount} validation {validationErrorCount === 1 ? 'error' : 'errors'} found in grid.
                      Pricing calculation is <strong>disabled</strong> until all errors are resolved.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Customer Info */}
                {(estimatePreviewData.customerName || estimatePreviewData.estimateId) && (
                  <div className={`${PAGE_STYLES.header.background} p-2 rounded-lg`}>
                    {estimatePreviewData.customerName && (
                      <div className="text-xs"><strong>Customer:</strong> {estimatePreviewData.customerName}</div>
                    )}
                    {estimatePreviewData.estimateId && (
                      <div className="text-xs"><strong>Estimate ID:</strong> {estimatePreviewData.estimateId}</div>
                    )}
                    {estimatePreviewData.cashCustomer && (
                      <div className="text-xs text-orange-600"><strong>Cash Customer</strong></div>
                    )}
                  </div>
                )}

                {/* Line Items Table */}
                <div className={`rounded-lg overflow-hidden ${estimate?.is_draft ? `border ${PAGE_STYLES.border}` : `border-2 ${PAGE_STYLES.border}`}`}>
                  <table className="w-full text-xs">
                    <thead className={PAGE_STYLES.header.background}>
                      <tr>
                        <th className={`px-2 py-1 text-left font-medium ${PAGE_STYLES.panel.text} w-6 border-r ${PAGE_STYLES.border}`}>#</th>
                        <th className={`px-2 py-1 text-left font-medium ${PAGE_STYLES.panel.text} w-52`}>Item</th>
                        <th className={`px-2 py-1 text-left font-medium ${PAGE_STYLES.panel.text} w-64`}>Details</th>
                        <th className={`px-2 py-1 text-center font-medium ${PAGE_STYLES.panel.text} w-10 border-l ${PAGE_STYLES.border}`}>Qty</th>
                        <th className={`px-2 py-1 text-center font-medium ${PAGE_STYLES.panel.text} w-20 border-l ${PAGE_STYLES.border}`}>Unit Price</th>
                        <th className={`px-2 py-1 text-center font-medium ${PAGE_STYLES.panel.text} w-20 border-l ${PAGE_STYLES.border}`}>Ext. Price</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${PAGE_STYLES.divider}`}>
                      {estimatePreviewData.items.map((item, index) => {
                        // Check if this is an Empty Row (Product Type 27) or description-only Custom item
                        const isEmptyRow = item.productTypeId === 27 || item.isDescriptionOnly;
                        // Check if this is a Subtotal (Product Type 21)
                        const isSubtotal = item.productTypeId === 21;

                        return (
                          <tr
                            key={`${item.rowId}-${index}`}
                            className={`${PAGE_STYLES.interactive.hover} ${
                              hoveredRowId === item.rowId
                                ? `relative z-10 outline outline-2 outline-blue-300 ${PAGE_STYLES.interactive.selected}`
                                : ''
                            }`}
                            onMouseEnter={() => onRowHover(item.rowId)}
                            onMouseLeave={() => onRowHover(null)}
                          >
                            <td className={`px-2 py-1 ${PAGE_STYLES.panel.textMuted} text-sm border-r ${PAGE_STYLES.border}`}>{item.estimatePreviewDisplayNumber || item.inputGridDisplayNumber}</td>
                            <td className="px-2 py-1">
                              {isSubtotal ? (
                                <div></div>
                              ) : (
                                <div className={`font-medium ${PAGE_STYLES.panel.text} text-sm`}>{item.itemName}</div>
                              )}
                            </td>
                            <td className="px-2 py-1 w-64">
                              {item.calculationDisplay && (
                                <div className={`text-[11px] ${isSubtotal ? `${PAGE_STYLES.panel.textSecondary} font-medium` : PAGE_STYLES.panel.textMuted} whitespace-pre-wrap`}>{item.calculationDisplay}</div>
                              )}
                            </td>
                            <td
                              className={`px-2 py-1 text-center text-sm ${PAGE_STYLES.panel.text} border-l ${PAGE_STYLES.border} ${!isEmptyRow && !isSubtotal && item.quantity !== 1 ? 'font-bold' : ''}`}
                              style={{ backgroundColor: (isEmptyRow || isSubtotal) ? 'transparent' : getQuantityBackground(item.quantity) }}
                            >
                              {(isEmptyRow || isSubtotal) ? '' : item.quantity}
                            </td>
                            <td className={`pl-2 pr-1 py-1 ${PAGE_STYLES.panel.text} text-xs border-l ${PAGE_STYLES.border}`}>
                              {(isEmptyRow || isSubtotal) ? (
                                <div className="flex items-baseline">
                                  <span className="flex-1 text-right text-sm"></span>
                                </div>
                              ) : (
                                <div className="flex items-baseline">
                                  <span className="flex-1 text-right text-sm">{splitNumber(item.unitPrice).whole}</span>
                                  <span className={`${PAGE_STYLES.panel.textMuted} w-7 text-left ml-0.5`}>{splitNumber(item.unitPrice).decimal}</span>
                                </div>
                              )}
                            </td>
                            <td className={`pl-2 pr-1 py-1 ${PAGE_STYLES.panel.text} font-semibold text-xs border-l ${PAGE_STYLES.border}`}>
                              {(isEmptyRow || isSubtotal) ? (
                                <div className="flex items-baseline">
                                  <span className="flex-1 text-right text-sm"></span>
                                </div>
                              ) : (
                                <div className="flex items-baseline">
                                  <span className="flex-1 text-right text-sm">{splitNumber(item.extendedPrice).whole}</span>
                                  <span className={`${PAGE_STYLES.panel.textMuted} w-7 text-left ml-0.5`}>{splitNumber(item.extendedPrice).decimal}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className={`border-t ${PAGE_STYLES.border} pt-2`}>
                  <div className="space-y-1 w-64 ml-auto text-sm">
                    <div className="flex justify-between">
                      <span className={PAGE_STYLES.panel.textMuted}>Subtotal:</span>
                      <span className="font-semibold text-right">${formatCurrencyValue(estimatePreviewData.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={PAGE_STYLES.panel.textMuted}>Tax ({formatPercent(estimatePreviewData.taxRate)}):</span>
                      <span className="font-semibold text-right">${formatCurrencyValue(estimatePreviewData.taxAmount)}</span>
                    </div>
                    <div className={`flex justify-between border-t ${PAGE_STYLES.border} pt-1.5`}>
                      <span className={`font-semibold ${PAGE_STYLES.panel.text}`}>Total:</span>
                      <span className={`font-bold text-base ${PAGE_STYLES.panel.text} text-right`}>${formatCurrencyValue(estimatePreviewData.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Point Persons Section - only show in Prepare to Send stage (not draft) */}
                {!hideSendWorkflow && customerId && !estimate?.is_draft && (
                  <div className={`border-t ${PAGE_STYLES.border} pt-3 mt-3`}>
                    <h4 className={`text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>Point Person(s)</h4>
                    <EstimatePointPersonsEditor
                      customerId={customerId}
                      initialPointPersons={pointPersons?.map(pp => ({
                        id: typeof pp.id === 'string' ? parseInt(pp.id.replace('existing-', '').replace('new-', '')) || 0 : 0,
                        contact_id: pp.contact_id,
                        contact_email: pp.contact_email,
                        contact_name: pp.contact_name,
                        contact_phone: pp.contact_phone,
                        contact_role: pp.contact_role
                      }))}
                      onSave={async (newPointPersons) => {
                        if (onPointPersonsChange) {
                          await onPointPersonsChange(newPointPersons);
                        }
                      }}
                      disabled={isConvertedToOrder}
                    />
                  </div>
                )}

                {/* Email Composer Section - only show in Prepare to Send stage (not draft) */}
                {!hideSendWorkflow && estimate && customerId && !estimate?.is_draft && (
                  <div className={`border-t ${PAGE_STYLES.border} pt-3 mt-3`}>
                    <h4 className={`text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>Email to Customer</h4>
                    <EstimateEmailComposer
                      initialSubject={emailSubject}
                      initialBeginning={emailBeginning}
                      initialEnd={emailEnd}
                      initialSummaryConfig={emailSummaryConfig}
                      estimateData={{
                        jobName: jobName || undefined,
                        customerJobNumber: estimate.customer_job_number,
                        qbEstimateNumber: estimate.qb_doc_number,
                        subtotal: estimatePreviewData?.subtotal,
                        tax: estimatePreviewData?.tax,
                        total: estimatePreviewData?.total,
                        // Only use estimate_date from QB (undefined if not sent yet)
                        estimateDate: estimate.estimate_date || undefined
                      }}
                      onChange={onEmailChange || (() => {})}
                      disabled={isConvertedToOrder}
                    />
                  </div>
                )}

                {/* Debug info (only shown if tax rate indicates failure) */}
                {estimatePreviewData.taxRate >= 1.0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="text-xs text-red-700">
                      <strong>Debug:</strong> Tax rate shows data flow issue
                      <ul className="mt-0.5 text-[10px]">
                        <li>Tax Rate: {estimatePreviewData.taxRate} (1+ indicates failure point)</li>
                        <li>Customer ID: {estimatePreviewData.customerId || 'undefined'}</li>
                        <li>Customer Name: {estimatePreviewData.customerName || 'undefined'}</li>
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Email Preview Modal */}
      {estimate && pointPersons && (
        <EstimateEmailPreviewModal
          isOpen={showEmailPreview}
          onClose={() => setShowEmailPreview(false)}
          onConfirm={(recipients) => {
            setShowEmailPreview(false);
            onSendToCustomer?.(recipients);
          }}
          estimate={estimate}
          pointPersons={pointPersons}
          isSending={isSending || false}
          emailSubject={emailSubject}
          emailBeginning={emailBeginning}
          emailEnd={emailEnd}
          emailSummaryConfig={emailSummaryConfig}
          estimateData={{
            jobName: jobName || undefined,
            customerJobNumber: estimate.customer_job_number || undefined,
            qbEstimateNumber: estimate.qb_doc_number || undefined,
            subtotal: estimatePreviewData?.subtotal,
            tax: estimatePreviewData?.taxAmount,
            total: estimatePreviewData?.total,
            // Only use estimate_date from QB (undefined if not sent yet)
            estimateDate: estimate.estimate_date || undefined
          }}
        />
      )}
    </div>
  );
};