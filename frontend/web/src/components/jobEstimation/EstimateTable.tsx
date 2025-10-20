import React, { useState, useRef } from 'react';
import { Copy, FileText, AlertTriangle } from 'lucide-react';
import { EstimatePreviewData } from './core/layers/CalculationLayer';

interface EstimateTableProps {
  estimate: any; // Legacy estimate data (unused in new system)
  showNotification: (message: string, type?: 'success' | 'error') => void;
  hasValidationErrors?: boolean;
  validationErrorCount?: number;
  estimatePreviewData?: EstimatePreviewData | null; // NEW: Complete estimate preview data
  hoveredRowId?: string | null; // Cross-component hover state
  onRowHover?: (rowId: string | null) => void; // Hover handler
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
  showNotification,
  hasValidationErrors = false,
  validationErrorCount = 0,
  estimatePreviewData = null,
  hoveredRowId = null,
  onRowHover = () => {}
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopyToClipboard = () => {
    if (!estimatePreviewData || estimatePreviewData.items.length === 0) {
      showNotification('No estimate data to copy', 'error');
      return;
    }

    // Build text representation
    let text = `ESTIMATE PREVIEW\n`;
    text += `================\n\n`;

    if (estimatePreviewData.customerName) {
      text += `Customer: ${estimatePreviewData.customerName}\n`;
    }
    if (estimatePreviewData.estimateId) {
      text += `Estimate ID: ${estimatePreviewData.estimateId}\n`;
    }
    text += `\n`;

    // Line items
    text += `ITEM\t\t\tQTY\tUNIT PRICE\tEXT. PRICE\n`;
    text += `----\t\t\t---\t----------\t----------\n`;

    estimatePreviewData.items.forEach(item => {
      const isEmptyRow = item.productTypeId === 27;
      const isSubtotal = item.productTypeId === 21;

      if (isEmptyRow || isSubtotal) {
        // Empty Row or Subtotal: show calculation display but no qty/prices
        const displayText = item.calculationDisplay || '';
        text += `${displayText}\t\t\t\t\n`;
      } else {
        const qty = item.quantity.toString();
        const unitPrice = formatNumber(item.unitPrice);
        const extPrice = formatCurrency(item.extendedPrice);
        text += `${item.itemName}\t\t${qty}\t${unitPrice}\t${extPrice}\n`;
      }
    });

    text += `\n`;
    text += `Subtotal: ${formatCurrency(estimatePreviewData.subtotal)}\n`;
    text += `Tax (${formatPercent(estimatePreviewData.taxRate)}): ${formatCurrency(estimatePreviewData.taxAmount)}\n`;
    text += `Total: ${formatCurrency(estimatePreviewData.total)}\n`;

    navigator.clipboard.writeText(text).then(() => {
      showNotification('Estimate copied to clipboard', 'success');
    }).catch(() => {
      showNotification('Failed to copy to clipboard', 'error');
    });
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
          <button
            onClick={handleCopyToClipboard}
            disabled={!estimatePreviewData || estimatePreviewData.items.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
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
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-gray-900 w-6 border-r border-gray-200">#</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-900 w-52">Item</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-900 max-w-xs">Details</th>
                        <th className="px-2 py-1 text-center font-medium text-gray-900 w-10 border-l border-gray-200">Qty</th>
                        <th className="px-2 py-1 text-center font-medium text-gray-900 w-20 border-l border-gray-200">Unit Price</th>
                        <th className="px-2 py-1 text-center font-medium text-gray-900 w-20 border-l border-gray-200">Ext. Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {estimatePreviewData.items.map((item, index) => {
                        // Check if this is an Empty Row (Product Type 27)
                        const isEmptyRow = item.productTypeId === 27;
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
                            <td className="px-2 py-1 text-gray-600 text-sm border-r border-gray-200">{item.inputGridDisplayNumber}</td>
                            <td className="px-2 py-1">
                              {isSubtotal ? (
                                <div></div>
                              ) : (
                                <div className="font-medium text-gray-900 text-sm">{item.itemName}</div>
                              )}
                            </td>
                            <td className="px-2 py-1 max-w-xs">
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
    </div>
  );
};