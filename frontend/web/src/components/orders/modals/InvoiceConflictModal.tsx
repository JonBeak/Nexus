/**
 * Invoice Conflict Modal
 * Phase 2: Bi-directional Invoice Sync
 *
 * Shows differences between local order data and QuickBooks invoice,
 * allowing user to choose a resolution strategy.
 */

import React, { useState } from 'react';
import { X, Loader2, AlertOctagon, ArrowRight, ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { Order } from '../../../types/orders';
import { qbInvoiceApi, InvoiceDifference, ConflictResolution, InvoiceSyncStatus } from '../../../services/api/orders/qbInvoiceApi';

interface InvoiceConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  status: InvoiceSyncStatus;
  differences: InvoiceDifference[];
  onResolved: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
  amount: 'Amount',
  item: 'Line Item'
};

const formatValue = (value: string | number | undefined, field: string): string => {
  if (value === undefined || value === null) return '-';
  if (field === 'unitPrice' || field === 'amount') {
    return `$${Number(value).toFixed(2)}`;
  }
  return String(value);
};

export const InvoiceConflictModal: React.FC<InvoiceConflictModalProps> = ({
  isOpen,
  onClose,
  order,
  status,
  differences,
  onResolved
}) => {
  const [selectedResolution, setSelectedResolution] = useState<ConflictResolution>('use_local');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConflict = status === 'conflict';
  const isQBModified = status === 'qb_modified';

  const handleResolve = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await qbInvoiceApi.resolveConflict(order.order_number, selectedResolution);
      if (result.success) {
        onResolved();
        onClose();
      } else {
        setError(result.message || 'Failed to resolve conflict');
      }
    } catch (err) {
      console.error('Error resolving conflict:', err);
      setError(err instanceof Error ? err.message : 'Failed to resolve conflict');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isConflict ? 'bg-red-50' : 'bg-purple-50'
        }`}>
          <div className="flex items-center space-x-3">
            {isConflict ? (
              <AlertOctagon className="w-6 h-6 text-red-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-purple-600" />
            )}
            <div>
              <h2 className={`text-lg font-semibold ${
                isConflict ? 'text-red-900' : 'text-purple-900'
              }`}>
                {isConflict ? 'Invoice Sync Conflict' : 'Invoice Modified in QuickBooks'}
              </h2>
              <p className="text-sm text-gray-600">
                Order #{order.order_number} - {order.order_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Explanation */}
          <div className={`p-4 rounded-lg ${
            isConflict ? 'bg-red-50 border border-red-200' : 'bg-purple-50 border border-purple-200'
          }`}>
            {isConflict ? (
              <p className="text-sm text-red-800">
                <strong>Conflict detected:</strong> The order data has changed locally AND the invoice was modified directly in QuickBooks.
                You need to choose which version to keep.
              </p>
            ) : (
              <p className="text-sm text-purple-800">
                <strong>QB Modified:</strong> The invoice was edited directly in QuickBooks.
                Your local order data has not changed. Choose how to proceed.
              </p>
            )}
          </div>

          {/* Differences Table */}
          {differences.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Detected Differences</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Line</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Local Value</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">QB Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {differences.map((diff, index) => (
                      <tr key={index} className={
                        diff.type === 'added' ? 'bg-green-50' :
                        diff.type === 'removed' ? 'bg-red-50' :
                        'bg-yellow-50'
                      }>
                        <td className="px-4 py-2 text-sm text-gray-900">#{diff.lineNumber}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{FIELD_LABELS[diff.field] || diff.field}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                            diff.type === 'added' ? 'bg-green-100 text-green-800' :
                            diff.type === 'removed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {diff.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 font-mono">
                          {formatValue(diff.localValue, diff.field)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 font-mono">
                          {formatValue(diff.qbValue, diff.field)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {differences.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <p>No detailed differences available.</p>
              <p className="text-sm mt-1">The sync status indicates a change but specific differences could not be determined.</p>
            </div>
          )}

          {/* Resolution Options */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Choose Resolution</h3>
            <div className="space-y-3">
              {/* Use Local */}
              <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedResolution === 'use_local'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="resolution"
                  value="use_local"
                  checked={selectedResolution === 'use_local'}
                  onChange={() => setSelectedResolution('use_local')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-gray-900">Use Local Data</span>
                    {isConflict && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Recommended</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Update the QuickBooks invoice with your current order data.
                    {isConflict && ' Any changes made in QuickBooks will be overwritten.'}
                  </p>
                </div>
              </label>

              {/* Use QB */}
              <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedResolution === 'use_qb'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="resolution"
                  value="use_qb"
                  checked={selectedResolution === 'use_qb'}
                  onChange={() => setSelectedResolution('use_qb')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <ArrowLeft className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-gray-900">Accept QuickBooks Version</span>
                    {isQBModified && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Recommended</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Keep the QuickBooks invoice as-is and mark as synced.
                    {isConflict && ' Your local order data will remain unchanged but may differ from the invoice.'}
                  </p>
                </div>
              </label>

              {/* Keep Both */}
              <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedResolution === 'keep_both'
                  ? 'border-gray-500 bg-gray-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="resolution"
                  value="keep_both"
                  checked={selectedResolution === 'keep_both'}
                  onChange={() => setSelectedResolution('keep_both')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-900">Acknowledge & Review Later</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Dismiss this alert without making changes. You can review both versions manually.
                    The conflict warning will reappear on the next sync check.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={loading}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
              selectedResolution === 'use_local' ? 'bg-blue-600 hover:bg-blue-700' :
              selectedResolution === 'use_qb' ? 'bg-purple-600 hover:bg-purple-700' :
              'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Resolving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Apply Resolution</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceConflictModal;
