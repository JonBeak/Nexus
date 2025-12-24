import React, { useState, useRef, useEffect } from 'react';
import { Copy, FileText, AlertTriangle, Check, CheckCircle, ExternalLink, Mail } from 'lucide-react';
import { EstimatePreviewData } from './core/layers/CalculationLayer';
import { generateEstimateSVG } from './utils/svgEstimateExporter';
import { EstimateVersion, EmailSummaryConfig } from './types';
import EstimatePointPersonsEditor, { PointPersonEntry } from './EstimatePointPersonsEditor';
import EstimateEmailComposer from './EstimateEmailComposer';
import { EstimateLineDescriptionCell } from './components/EstimateLineDescriptionCell';
import { EstimateEmailPreviewModal } from './components/EstimateEmailPreviewModal';
import { jobVersioningApi } from '@/services/jobVersioningApi';

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
  onApproveEstimate?: () => void;
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
  onSendToCustomer?: () => void;
  isPreparing?: boolean;
  isSending?: boolean;
  // Hide send workflow sections when displayed in separate panel
  hideSendWorkflow?: boolean;
  // QB line descriptions (lifted to parent for QB integration)
  lineDescriptions?: Map<number, string>;
  onLineDescriptionChange?: (lineIndex: number, value: string) => void;
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
  onApproveEstimate,
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
  lineDescriptions: lineDescriptionsProp,
  onLineDescriptionChange
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  // Use prop if provided (lifted state), otherwise use local state
  const [localLineDescriptions, setLocalLineDescriptions] = useState<Map<number, string>>(new Map());
  const lineDescriptions = lineDescriptionsProp || localLineDescriptions;
  const [isConvertedToOrder, setIsConvertedToOrder] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [isSavingPointPersons, setIsSavingPointPersons] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load QB descriptions for non-draft estimates (only if using local state)
  useEffect(() => {
    // Skip if parent is providing lineDescriptions via prop
    if (lineDescriptionsProp) return;

    if (!estimate?.id || estimate.is_draft) {
      setLocalLineDescriptions(new Map());
      return;
    }

    const loadDescriptions = async () => {
      try {
        const response = await jobVersioningApi.getEstimateLineDescriptions(estimate.id);
        const descMap = new Map<number, string>();
        // Note: apiClient interceptor unwraps { success, data } to just the data array
        if (Array.isArray(response)) {
          response.forEach((desc: any) => {
            if (desc.qb_description) {
              descMap.set(desc.line_index, desc.qb_description);
            }
          });
        }
        setLocalLineDescriptions(descMap);
      } catch (error) {
        console.error('Failed to load QB descriptions:', error);
      }
    };

    loadDescriptions();
  }, [estimate?.id, estimate?.is_draft, lineDescriptionsProp]);

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

  const handleQBDescriptionUpdate = async (lineIndex: number, value: string) => {
    if (!estimate?.id) return;

    try {
      await jobVersioningApi.updateEstimateLineDescriptions(estimate.id, [
        { line_index: lineIndex, qb_description: value }
      ]);

      // Update state - use parent callback if provided, otherwise local state
      if (onLineDescriptionChange) {
        onLineDescriptionChange(lineIndex, value);
      } else {
        const newDescriptions = new Map(localLineDescriptions);
        newDescriptions.set(lineIndex, value);
        setLocalLineDescriptions(newDescriptions);
      }

    } catch (error) {
      console.error('Failed to save QB description:', error);
      // TODO: Show error toast to user
    }
  };

  return (
    <div className="bg-white rounded-lg shadow mb-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
          <h3 className="text-base font-medium text-gray-900 whitespace-nowrap">Estimate Preview</h3>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* QuickBooks Buttons */}
          {qbCheckingStatus ? (
            // Checking QB status
            <span className="text-xs text-gray-500">Checking QB...</span>
          ) : qbEstimateId && qbEstimateUrl ? (
            // QB estimate exists - show "Open in QB", "Send to Customer", and optionally "Approve"
            <>
              <button
                onClick={onOpenQBEstimate}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                title="Open this estimate in QuickBooks"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in QB
              </button>
              {!isApproved && (
                <button
                  onClick={async () => {
                    if (pointPersons && pointPersons.length === 0) {
                      alert('Please add at least one point person before sending');
                      return;
                    }

                    // Auto-save point persons before opening modal
                    if (onSavePointPersons) {
                      try {
                        setIsSavingPointPersons(true);
                        await onSavePointPersons();
                      } catch (error) {
                        console.error('Failed to auto-save point persons:', error);
                        alert('Failed to save point persons. Please try again.');
                        return;
                      } finally {
                        setIsSavingPointPersons(false);
                      }
                    }

                    setShowEmailPreview(true);
                  }}
                  disabled={isSending || isSavingPointPersons}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
                  title="Send estimate to customer via email"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {isSavingPointPersons ? 'Saving...' : isSending ? 'Sending...' : 'Send to Customer'}
                </button>
              )}
            </>
          ) : !qbConnected ? (
            // Not connected - show "Connect to QuickBooks" and "Approve"
            <>
              <button
                onClick={onConnectQB}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                title="Connect to QuickBooks to create estimates"
              >
                <FileText className="w-3.5 h-3.5" />
                Connect to QB
              </button>
            </>
          ) : (
            // Connected - show workflow buttons based on state
            <>
              {estimate?.is_draft ? (
                // DRAFT STATE: Show "Prepare to Send"
                <button
                  onClick={onPrepareEstimate}
                  disabled={isPreparing || hasValidationErrors || !estimatePreviewData || estimatePreviewData.items.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded whitespace-nowrap bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={hasValidationErrors ? 'Fix validation errors first' : 'Prepare estimate for sending'}
                >
                  {isPreparing ? '⏳ Preparing...' : 'Prepare to Send'}
                </button>
              ) : estimate?.is_prepared && !qbEstimateId ? (
                // PREPARED STATE: Show "Create QB Estimate" (must create QB before sending)
                <button
                  onClick={onCreateQBEstimate}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  title="Create estimate in QuickBooks"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Create QB Estimate
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="p-3">
        {!estimatePreviewData ? (
          <div className="text-center py-6 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium mb-1">No estimate data</p>
            <p className="text-xs">Complete the grid to see estimate preview</p>
          </div>
        ) : estimatePreviewData.items.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
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
                  <div className="bg-gray-50 p-2 rounded-lg">
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
                <div className={`rounded-lg overflow-hidden ${estimate?.is_draft ? 'border' : 'border-2 border-gray-400'}`}>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-gray-900 w-6 border-r border-gray-200">#</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-900 w-52">Item</th>
                        {!estimate?.is_draft && (
                          <th className="px-2 py-1 text-left font-medium text-gray-900 border-l border-gray-200">QB Description</th>
                        )}
                        <th className="px-2 py-1 text-left font-medium text-gray-900 w-64">Details</th>
                        <th className="px-2 py-1 text-center font-medium text-gray-900 w-10 border-l border-gray-200">Qty</th>
                        <th className="px-2 py-1 text-center font-medium text-gray-900 w-20 border-l border-gray-200">Unit Price</th>
                        <th className="px-2 py-1 text-center font-medium text-gray-900 w-20 border-l border-gray-200">Ext. Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {estimatePreviewData.items.map((item, index) => {
                        // Check if this is an Empty Row (Product Type 27) or description-only Custom item
                        const isEmptyRow = item.productTypeId === 27 || item.isDescriptionOnly;
                        // Check if this is a Subtotal (Product Type 21)
                        const isSubtotal = item.productTypeId === 21;

                        return (
                          <tr
                            key={`${item.rowId}-${index}`}
                            className={`hover:bg-gray-50 ${
                              hoveredRowId === item.rowId
                                ? 'relative z-10 outline outline-2 outline-blue-300 bg-gray-50'
                                : ''
                            }`}
                            onMouseEnter={() => onRowHover(item.rowId)}
                            onMouseLeave={() => onRowHover(null)}
                          >
                            <td className="px-2 py-1 text-gray-600 text-sm border-r border-gray-200">{item.estimatePreviewDisplayNumber || item.inputGridDisplayNumber}</td>
                            <td className="px-2 py-1">
                              {isSubtotal ? (
                                <div></div>
                              ) : (
                                <div className="font-medium text-gray-900 text-sm">{item.itemName}</div>
                              )}
                            </td>
                            {/* QB Description Column - Shown for all non-draft states */}
                            {!estimate?.is_draft && (
                              <td className="px-2 py-1 border-l border-gray-200 min-w-[200px]">
                                <EstimateLineDescriptionCell
                                  lineIndex={index}
                                  initialValue={lineDescriptions.get(index) || ''}
                                  estimateId={estimate.id}
                                  readOnly={isConvertedToOrder || !!estimate?.qb_estimate_id}
                                  onUpdate={handleQBDescriptionUpdate}
                                />
                              </td>
                            )}
                            <td className="px-2 py-1 w-64">
                              {item.calculationDisplay && (
                                <div className={`text-[11px] ${isSubtotal ? 'text-gray-700 font-medium' : 'text-gray-500'} whitespace-pre-wrap`}>{item.calculationDisplay}</div>
                              )}
                            </td>
                            <td
                              className={`px-2 py-1 text-center text-sm text-gray-900 border-l border-gray-200 ${!isEmptyRow && !isSubtotal && item.quantity !== 1 ? 'font-bold' : ''}`}
                              style={{ backgroundColor: (isEmptyRow || isSubtotal) ? 'transparent' : getQuantityBackground(item.quantity) }}
                            >
                              {(isEmptyRow || isSubtotal) ? '' : item.quantity}
                            </td>
                            <td className="pl-2 pr-1 py-1 text-gray-900 text-xs border-l border-gray-200">
                              {(isEmptyRow || isSubtotal) ? (
                                <div className="flex items-baseline">
                                  <span className="flex-1 text-right text-sm"></span>
                                </div>
                              ) : (
                                <div className="flex items-baseline">
                                  <span className="flex-1 text-right text-sm">{splitNumber(item.unitPrice).whole}</span>
                                  <span className="text-gray-500 w-7 text-left ml-0.5">{splitNumber(item.unitPrice).decimal}</span>
                                </div>
                              )}
                            </td>
                            <td className="pl-2 pr-1 py-1 text-gray-900 font-semibold text-xs border-l border-gray-200">
                              {(isEmptyRow || isSubtotal) ? (
                                <div className="flex items-baseline">
                                  <span className="flex-1 text-right text-sm"></span>
                                </div>
                              ) : (
                                <div className="flex items-baseline">
                                  <span className="flex-1 text-right text-sm">{splitNumber(item.extendedPrice).whole}</span>
                                  <span className="text-gray-500 w-7 text-left ml-0.5">{splitNumber(item.extendedPrice).decimal}</span>
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
                <div className="border-t pt-2">
                  <div className="space-y-1 w-64 ml-auto text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold text-right">${formatCurrencyValue(estimatePreviewData.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax ({formatPercent(estimatePreviewData.taxRate)}):</span>
                      <span className="font-semibold text-right">${formatCurrencyValue(estimatePreviewData.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5">
                      <span className="font-semibold text-gray-900">Total:</span>
                      <span className="font-bold text-base text-gray-900 text-right">${formatCurrencyValue(estimatePreviewData.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Point Persons Section - hidden when using separate SendWorkflowPanel */}
                {!hideSendWorkflow && customerId && (
                  <div className="border-t pt-3 mt-3">
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Point Person(s)</h4>
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

                {/* Email Composer Section - hidden when using separate SendWorkflowPanel */}
                {!hideSendWorkflow && estimate && customerId && (
                  <div className="border-t pt-3 mt-3">
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Email to Customer</h4>
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
                        estimateDate: estimate.created_at
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
          onConfirm={() => {
            setShowEmailPreview(false);
            onSendToCustomer?.();
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
            // Use saved date for resends, or today's date for new sends (preview)
            estimateDate: estimate.estimate_date || new Date().toISOString().split('T')[0]
          }}
        />
      )}
    </div>
  );
};