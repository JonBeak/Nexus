/**
 * Document Conflict Modal (Unified)
 *
 * Handles sync conflicts for both invoices and estimates.
 * Shows differences between local order data and QuickBooks document,
 * allowing user to choose a resolution strategy.
 *
 * Key differences by document type:
 * - Invoice: 3 resolution options (use_local, use_qb, keep_both)
 * - Estimate: 2 resolution options (use_local, use_qb)
 * - Different column labels ("Local Value" vs "Dual Table Value")
 * - Different button text for create action
 */

import React, { useState } from 'react';
import { X, Loader2, AlertOctagon, ArrowRight, ArrowLeft, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  DocumentType,
  DocumentSyncStatus,
  DocumentConflictResolution,
  DocumentDifference,
  getDocumentConfig,
  DOCUMENT_FIELD_LABELS,
  formatDocumentValue,
} from '../../../../types/document';
import { createDocumentApi } from './documentApi';
import { useModalBackdrop } from '../../../../hooks/useModalBackdrop';

interface DocumentConflictModalProps {
  /** Document type determines resolution options and labels */
  documentType: DocumentType;
  isOpen: boolean;
  onClose: () => void;
  orderNumber: number;
  orderName?: string;
  /** Current sync status */
  syncStatus: DocumentSyncStatus;
  /** Detected differences between local and QB data */
  differences: DocumentDifference[];
  /** Called when conflict is successfully resolved */
  onResolved: () => void;
  /** Called to return to parent modal */
  onBack?: () => void;
}

export const DocumentConflictModal: React.FC<DocumentConflictModalProps> = ({
  documentType,
  isOpen,
  onClose,
  orderNumber,
  orderName,
  syncStatus,
  differences,
  onResolved,
  onBack,
}) => {
  const [selectedResolution, setSelectedResolution] = useState<DocumentConflictResolution>('use_local');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = getDocumentConfig(documentType);
  const api = createDocumentApi(documentType);

  // Modal backdrop handling
  const { modalContentRef, handleBackdropMouseDown, handleBackdropMouseUp, isMobile } = useModalBackdrop({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const isConflict = syncStatus === 'conflict';
  const isQBModified = syncStatus === 'qb_modified';
  const isLocalStale = syncStatus === 'local_stale';

  const handleResolve = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.resolveConflict(orderNumber, selectedResolution);
      if (result.success) {
        onResolved();
        onClose();
      } else {
        setError(result.message || 'Failed to resolve conflict');
      }
    } catch (err: any) {
      console.error('Error resolving conflict:', err);
      const errorMessage = err?.response?.data?.message
        || err?.response?.data?.error
        || err?.message
        || 'Failed to resolve conflict';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get header colors based on sync status
  const headerBgColor = isConflict ? 'bg-red-50' : isLocalStale ? 'bg-orange-50' : 'bg-purple-50';
  const headerTextColor = isConflict ? 'text-red-900' : isLocalStale ? 'text-orange-900' : 'text-purple-900';
  const iconColor = isConflict ? 'text-red-600' : isLocalStale ? 'text-orange-600' : 'text-purple-600';
  const explanationBg = isConflict ? 'bg-red-50 border-red-200' : isLocalStale ? 'bg-orange-50 border-orange-200' : 'bg-purple-50 border-purple-200';
  const explanationText = isConflict ? 'text-red-800' : isLocalStale ? 'text-orange-800' : 'text-purple-800';

  // Get title based on sync status
  const getTitle = () => {
    if (isConflict) return `${config.labels.documentName} Sync Conflict`;
    if (isLocalStale) return documentType === 'invoice' ? 'Review Changes Before Update' : 'Local Data Changed';
    return `${config.labels.documentName} Modified in QuickBooks`;
  };

  // Get explanation text
  const getExplanation = () => {
    if (isConflict) {
      return (
        <>
          <strong>Conflict detected:</strong> The order data has changed locally AND the {config.labels.documentName.toLowerCase()} was modified directly in QuickBooks.
          You need to choose which version to keep.
        </>
      );
    }
    if (isLocalStale) {
      if (documentType === 'invoice') {
        return (
          <>
            <strong>Local changes detected:</strong> Your order data has changed since the last sync.
            Review the differences below before updating the QuickBooks invoice.
          </>
        );
      }
      return (
        <>
          <strong>Local changes detected:</strong> The order data (Dual Table) has changed since the {config.labels.documentName.toLowerCase()} was created.
          You can create a new {config.labels.documentName.toLowerCase()} with the updated data or keep the existing QuickBooks {config.labels.documentName.toLowerCase()}.
        </>
      );
    }
    return (
      <>
        <strong>QB Modified:</strong> The {config.labels.documentName.toLowerCase()} was edited directly in QuickBooks.
        {documentType === 'invoice'
          ? ' Your local order data has not changed. Choose how to proceed.'
          : ' You can sync these changes back to the order or create a new estimate from local data.'
        }
      </>
    );
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${
        isMobile ? 'overflow-y-auto' : 'flex items-center justify-center'
      }`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalContentRef}
        className={`bg-white rounded-lg shadow-xl w-full flex flex-col ${
          isMobile ? 'min-h-full' : 'max-w-3xl mx-4 max-h-[90vh] overflow-hidden'
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${headerBgColor}`}>
          <div className="flex items-center space-x-3">
            {isConflict ? (
              <AlertOctagon className={`w-6 h-6 ${iconColor}`} />
            ) : isLocalStale ? (
              <RefreshCw className={`w-6 h-6 ${iconColor}`} />
            ) : (
              <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
            )}
            <div>
              <h2 className={`text-lg font-semibold ${headerTextColor}`}>
                {getTitle()}
              </h2>
              <p className="text-sm text-gray-600">
                Order #{orderNumber}{orderName ? ` - ${orderName}` : ''}
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
          <div className={`p-4 rounded-lg border ${explanationBg}`}>
            <p className={`text-sm ${explanationText}`}>
              {getExplanation()}
            </p>
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
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {config.labels.localValueLabel}
                        </th>
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
                          <td className="px-4 py-2 text-sm text-gray-900">{DOCUMENT_FIELD_LABELS[diff.field] || diff.field}</td>
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
                            {formatDocumentValue(diff.localValue, diff.field)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 font-mono">
                            {formatDocumentValue(diff.qbValue, diff.field)}
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
                          Line #{diff.lineNumber} - {DOCUMENT_FIELD_LABELS[diff.field] || diff.field}
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
                          <span className="text-gray-500 block text-xs">
                            {documentType === 'estimate' ? 'Dual Table' : 'Local'}
                          </span>
                          <span className="font-mono text-gray-700">
                            {formatDocumentValue(diff.localValue, diff.field)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-xs">QuickBooks</span>
                          <span className="font-mono text-gray-700">
                            {formatDocumentValue(diff.qbValue, diff.field)}
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {isLocalStale && documentType === 'invoice' ? 'Confirm Action' : 'Choose Resolution'}
            </h3>
            <div className="space-y-3">
              {/* Use Local / Push to QuickBooks */}
              <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                isMobile ? 'min-h-[60px] active:bg-gray-100' : ''
              } ${
                selectedResolution === 'use_local'
                  ? isLocalStale && documentType === 'invoice' ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50'
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
                    <ArrowRight className={`w-4 h-4 ${isLocalStale && documentType === 'invoice' ? 'text-orange-600' : 'text-blue-600'}`} />
                    <span className="font-medium text-gray-900">
                      {isLocalStale && documentType === 'invoice'
                        ? 'Push to QuickBooks'
                        : documentType === 'estimate'
                          ? 'Use Dual Table Data'
                          : 'Use Local Data'
                      }
                    </span>
                    {(isConflict || isLocalStale) && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isLocalStale && documentType === 'invoice' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                      }`}>Recommended</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {documentType === 'estimate'
                      ? `Create a new QuickBooks estimate with current order data.${isConflict ? ' Any changes made in QuickBooks will be replaced.' : ''}`
                      : isLocalStale
                        ? 'Update the QuickBooks invoice with your current order data.'
                        : `Update the QuickBooks invoice with your current order data.${isConflict ? ' Any changes made in QuickBooks will be overwritten.' : ''}`
                    }
                  </p>
                </div>
              </label>

              {/* Use QB - Hide for invoice local_stale since QB hasn't changed */}
              {!(documentType === 'invoice' && isLocalStale) && (
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
                      <span className="font-medium text-gray-900">
                        {documentType === 'estimate' ? 'Use QuickBooks Data' : 'Accept QuickBooks Version'}
                      </span>
                      {isQBModified && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Recommended</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {documentType === 'estimate'
                        ? `Sync the QuickBooks estimate data back to your order (invoice columns only).${isLocalStale ? ' Your local specs will be preserved.' : ''}`
                        : `Keep the QuickBooks invoice as-is and mark as synced.${isConflict ? ' Your local order data will remain unchanged but may differ from the invoice.' : ''}`
                      }
                    </p>
                  </div>
                </label>
              )}

              {/* Keep Both - Invoice only, hide for local_stale */}
              {config.features.hasKeepBoth && !isLocalStale && (
                <label className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                  isMobile ? 'min-h-[60px] active:bg-gray-100' : ''
                } ${
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
              )}
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
            onClick={onBack || onClose}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 ${
              isMobile ? 'min-h-[44px]' : ''
            }`}
          >
            {onBack ? 'Back' : 'Cancel'}
          </button>
          <button
            onClick={handleResolve}
            disabled={loading}
            className={`flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
              isMobile ? 'min-h-[44px]' : ''
            } ${
              selectedResolution === 'use_local'
                ? isLocalStale && documentType === 'invoice'
                  ? 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                : selectedResolution === 'use_qb'
                  ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                  : 'bg-gray-600 hover:bg-gray-700 active:bg-gray-800'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isLocalStale && documentType === 'invoice' ? 'Updating...' : 'Resolving...'}</span>
              </>
            ) : (
              <>
                {isLocalStale && documentType === 'invoice' ? <RefreshCw className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                <span>
                  {isLocalStale && documentType === 'invoice'
                    ? 'Push to QuickBooks'
                    : documentType === 'estimate' && selectedResolution === 'use_local'
                      ? 'Create New Estimate'
                      : documentType === 'estimate' && selectedResolution === 'use_qb'
                        ? 'Sync from QuickBooks'
                        : 'Apply Resolution'
                  }
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentConflictModal;
