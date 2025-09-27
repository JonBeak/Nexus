import React, { useState, useRef } from 'react';
import { Copy, FileText, AlertTriangle } from 'lucide-react';
import { EstimatePreviewData } from './core/layers/CalculationLayer';

interface EstimateTableProps {
  estimate: any; // Legacy estimate data (unused in new system)
  showNotification: (message: string, type?: 'success' | 'error') => void;
  hasValidationErrors?: boolean;
  validationErrorCount?: number;
  estimatePreviewData?: EstimatePreviewData | null; // NEW: Complete estimate preview data
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(amount);
};

const formatPercent = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`;
};

export const EstimateTable: React.FC<EstimateTableProps> = ({
  estimate,
  showNotification,
  hasValidationErrors = false,
  validationErrorCount = 0,
  estimatePreviewData = null
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
      const qty = item.quantity.toString();
      const unitPrice = formatCurrency(item.unitPrice);
      const extPrice = formatCurrency(item.extendedPrice);
      text += `${item.itemName}\t\t${qty}\t${unitPrice}\t${extPrice}\n`;
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
    <div className="bg-white rounded-lg shadow h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Estimate Preview</h3>
          {hasValidationErrors && (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{validationErrorCount} errors</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyToClipboard}
            disabled={!estimatePreviewData || estimatePreviewData.items.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-auto p-4">
        {!estimatePreviewData ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-2">No estimate data</p>
            <p className="text-sm">Complete the grid to see estimate preview</p>
          </div>
        ) : estimatePreviewData.items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-2">No items calculated</p>
            <p className="text-sm">Add products to the grid to see pricing</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Customer Info */}
            {(estimatePreviewData.customerName || estimatePreviewData.estimateId) && (
              <div className="bg-gray-50 p-3 rounded-lg">
                {estimatePreviewData.customerName && (
                  <div className="text-sm"><strong>Customer:</strong> {estimatePreviewData.customerName}</div>
                )}
                {estimatePreviewData.estimateId && (
                  <div className="text-sm"><strong>Estimate ID:</strong> {estimatePreviewData.estimateId}</div>
                )}
                {estimatePreviewData.cashCustomer && (
                  <div className="text-sm text-orange-600"><strong>Cash Customer</strong></div>
                )}
              </div>
            )}

            {/* Line Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-900">Grid #</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-900">Item</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-900">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-900">Unit Price</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-900">Ext. Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {estimatePreviewData.items.map((item, index) => (
                    <tr key={`${item.rowId}-${index}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{item.inputGridDisplayNumber}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{item.itemName}</div>
                        {item.calculationDisplay && (
                          <div className="text-xs text-gray-500 mt-1">{item.calculationDisplay}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900">{item.quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">{formatCurrency(item.extendedPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t pt-4">
              <div className="space-y-2 max-w-xs ml-auto">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(estimatePreviewData.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax ({formatPercent(estimatePreviewData.taxRate)}):</span>
                  <span className="font-medium">{formatCurrency(estimatePreviewData.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold text-lg text-gray-900">{formatCurrency(estimatePreviewData.total)}</span>
                </div>
              </div>
            </div>

            {/* Debug info (only shown if tax rate indicates failure) */}
            {estimatePreviewData.taxRate >= 1.0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm text-red-700">
                  <strong>Debug:</strong> Tax rate shows data flow issue
                  <ul className="mt-1 text-xs">
                    <li>Tax Rate: {estimatePreviewData.taxRate} (1+ indicates failure point)</li>
                    <li>Customer ID: {estimatePreviewData.customerId || 'undefined'}</li>
                    <li>Customer Name: {estimatePreviewData.customerName || 'undefined'}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};