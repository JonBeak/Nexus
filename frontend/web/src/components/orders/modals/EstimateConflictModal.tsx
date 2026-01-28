/**
 * @deprecated Use DocumentConflictModal from './document' with documentType="estimate" instead.
 * This component will be removed in a future release.
 *
 * Estimate Conflict Modal
 * Cash Job Conflict Resolution
 *
 * Shows differences between local order data and QuickBooks estimate,
 * allowing user to choose a resolution strategy.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertOctagon, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import { orderPreparationApi } from '../../../services/api';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

// Types matching backend cashEstimateSyncService
export type EstimateSyncStatus = 'in_sync' | 'local_stale' | 'qb_modified' | 'conflict' | 'not_found' | 'error';

export interface EstimateDifference {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  field: 'description' | 'quantity' | 'unitPrice' | 'amount' | 'item';
  localValue?: string | number;
  qbValue?: string | number;
}

export type EstimateConflictResolution = 'use_local' | 'use_qb';

interface EstimateConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  syncStatus: EstimateSyncStatus;
  differences: EstimateDifference[];
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

export const EstimateConflictModal: React.FC<EstimateConflictModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  syncStatus,
  differences,
  onResolved
}) => {
  const [selectedResolution, setSelectedResolution] = useState<EstimateConflictResolution>('use_local');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);

  // Mobile detection
  const isMobile = useIsMobile();
  useBodyScrollLock(isOpen && isMobile);

  // Handle ESC key - stop propagation to prevent parent modals from closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click - only close if both mousedown and mouseup are outside modal content
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownOutsideRef.current = modalContentRef.current ? !modalContentRef.current.contains(e.target as Node) : false;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (mouseDownOutsideRef.current && modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      onClose();
    }
    mouseDownOutsideRef.current = false;
  };

  if (!isOpen) return null;

  const isConflict = syncStatus === 'conflict';
  const isQBModified = syncStatus === 'qb_modified';
  const isLocalStale = syncStatus === 'local_stale';

  const handleResolve = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await orderPreparationApi.resolveEstimateConflict(orderNumber, selectedResolution);
      if (result.success) {
        onResolved();
        onClose();
      } else {
        setError(result.message || 'Failed to resolve conflict');
      }
    } catch (err: any) {
      console.error('Error resolving estimate conflict:', err);
      // Extract error message from axios response or error object
      const errorMessage = err?.response?.data?.message
        || err?.response?.data?.error
        || err?.message
        || 'Failed to resolve conflict';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile
          ? 'overflow-y-auto'
          : 'flex items-center justify-center'
      }`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={modalContentRef} className={`bg-white rounded-lg shadow-xl w-full flex flex-col ${
        isMobile
          ? 'min-h-full'
          : 'max-w-3xl mx-4 max-h-[90vh] overflow-hidden'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isConflict ? 'bg-red-50' : isLocalStale ? 'bg-orange-50' : 'bg-purple-50'
        }`}>
          <div className="flex items-center space-x-3">
            {isConflict ? (
              <AlertOctagon className="w-6 h-6 text-red-600" />
            ) : (
              <AlertTriangle className={`w-6 h-6 ${isLocalStale ? 'text-orange-600' : 'text-purple-600'}`} />
            )}
            <div>
              <h2 className={`text-lg font-semibold ${
                isConflict ? 'text-red-900' : isLocalStale ? 'text-orange-900' : 'text-purple-900'
              }`}>
                {isConflict ? 'Estimate Sync Conflict' :
                 isLocalStale ? 'Local Data Changed' :
                 'Estimate Modified in QuickBooks'}
              </h2>
              <p className="text-sm text-gray-600">
                Order #{orderNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Explanation */}
          <div className={`p-4 rounded-lg ${
            isConflict ? 'bg-red-50 border border-red-200' :
            isLocalStale ? 'bg-orange-50 border border-orange-200' :
            'bg-purple-50 border border-purple-200'
          }`}>
            {isConflict ? (
              <p className="text-sm text-red-800">
                <strong>Conflict detected:</strong> The order data has changed locally AND the estimate was modified directly in QuickBooks.
                You need to choose which version to keep.
              </p>
            ) : isLocalStale ? (
              <p className="text-sm text-orange-800">
                <strong>Local changes detected:</strong> The order data (Dual Table) has changed since the estimate was created.
                You can create a new estimate with the updated data or keep the existing QuickBooks estimate.
              </p>
            ) : (
              <p className="text-sm text-purple-800">
                <strong>QB Modified:</strong> The estimate was edited directly in QuickBooks.
                You can sync these changes back to the order or create a new estimate from local data.
              </p>
            )}
          </div>

          {/* Differences Table/Cards */}
          {differences.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Detected Differences</h3>

              {/* Desktop: Table view */}
              {!isMobile && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Line</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dual Table Value</th>
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
              )}

              {/* Mobile: Card view */}
              {isMobile && (
                <div className="space-y-3">
                  {differences.map((diff, index) => (
                    <div
                      key={index}
                      className={`rounded-lg p-3 border ${
                        diff.type === 'added' ? 'bg-green-50 border-green-200' :
                        diff.type === 'removed' ? 'bg-red-50 border-red-200' :
                        'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                          Line #{diff.lineNumber} - {FIELD_LABELS[diff.field] || diff.field}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          diff.type === 'added' ? 'bg-green-100 text-green-800' :
                          diff.type === 'removed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {diff.type}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500 block text-xs">Dual Table</span>
                          <span className="font-mono text-gray-700">
                            {formatValue(diff.localValue, diff.field)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-xs">QuickBooks</span>
                          <span className="font-mono text-gray-700">
                            {formatValue(diff.qbValue, diff.field)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {differences.length === 0 && !isLocalStale && (
            <div className="text-center py-6 text-gray-500">
              <p>No detailed differences available.</p>
              <p className="text-sm mt-1">The sync status indicates a change but specific differences could not be determined.</p>
            </div>
          )}

          {/* Resolution Options */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Choose Resolution</h3>
            <div className="space-y-3">
              {/* Use Local (Dual Table) */}
              <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                isMobile ? 'min-h-[60px] active:bg-gray-100' : ''
              } ${
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
                    <span className="font-medium text-gray-900">Use Dual Table Data</span>
                    {(isConflict || isLocalStale) && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Recommended</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Create a new QuickBooks estimate with current order data.
                    {isConflict && ' Any changes made in QuickBooks will be replaced.'}
                  </p>
                </div>
              </label>

              {/* Use QB */}
              <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                isMobile ? 'min-h-[60px] active:bg-gray-100' : ''
              } ${
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
                    <span className="font-medium text-gray-900">Use QuickBooks Data</span>
                    {isQBModified && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Recommended</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Sync the QuickBooks estimate data back to your order (invoice columns only).
                    {isLocalStale && ' Your local specs will be preserved.'}
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
        <div className={`px-6 py-4 border-t bg-gray-50 flex ${
          isMobile ? 'flex-col-reverse gap-2' : 'justify-end space-x-3'
        }`}>
          <button
            onClick={onClose}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 ${
              isMobile ? 'min-h-[44px]' : ''
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={loading}
            className={`flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
              isMobile ? 'min-h-[44px]' : ''
            } ${
              selectedResolution === 'use_local' ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800' :
              'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Resolving...</span>
              </>
            ) : (
              <span>
                {selectedResolution === 'use_local' ? 'Create New Estimate' : 'Sync from QuickBooks'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EstimateConflictModal;
