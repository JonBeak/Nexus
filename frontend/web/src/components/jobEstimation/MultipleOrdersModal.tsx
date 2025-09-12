import React, { useState, useEffect } from 'react';
import { X, Package, AlertTriangle } from 'lucide-react';
import { jobVersioningApi } from '../../services/api';

interface MultipleOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newJobName: string) => void;
  originalJobName: string;
  originalJobNumber: string;
  estimateVersion: number;
  jobId: number;
  loading?: boolean;
}

export const MultipleOrdersModal: React.FC<MultipleOrdersModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  originalJobName,
  originalJobNumber,
  estimateVersion,
  jobId,
  loading = false
}) => {
  const [newJobName, setNewJobName] = useState(`${originalJobName} (B)`);
  const [suggestingName, setSuggestingName] = useState(false);

  // Fetch suggested job name when modal opens
  useEffect(() => {
    if (isOpen && jobId && originalJobName) {
      fetchSuggestedName();
    }
  }, [isOpen, jobId, originalJobName]);

  const fetchSuggestedName = async () => {
    setSuggestingName(true);
    try {
      const response = await jobVersioningApi.suggestJobNameSuffix(jobId, originalJobName);
      if (response.data?.suggestedJobName) {
        setNewJobName(response.data.suggestedJobName);
      }
    } catch (error) {
      console.error('Error fetching suggested job name:', error);
      // Fallback to default if API fails
      setNewJobName(`${originalJobName} (B)`);
    } finally {
      setSuggestingName(false);
    }
  };

  const handleConfirm = () => {
    if (newJobName.trim()) {
      onConfirm(newJobName.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold">Multiple Orders Detected</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-medium mb-1">Order Already Exists</p>
                <p>
                  Job <span className="font-mono font-medium">{originalJobNumber}</span> already has an existing order. 
                  A new job will be created for this additional estimate.
                </p>
              </div>
            </div>
          </div>

          {/* Current Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="text-sm">
              <span className="font-medium text-gray-700">Current Job:</span>
              <span className="ml-2 font-mono">{originalJobNumber}</span> - {originalJobName}
            </div>
            <div className="text-sm">
              <span className="font-medium text-gray-700">Version to Duplicate:</span>
              <span className="ml-2">v{estimateVersion}</span>
            </div>
          </div>

          {/* New Job Name Input */}
          <div className="space-y-2">
            <label htmlFor="newJobName" className="block text-sm font-medium text-gray-700">
              New Job Name
            </label>
            <input
              id="newJobName"
              type="text"
              value={newJobName}
              onChange={(e) => setNewJobName(e.target.value)}
              disabled={loading || suggestingName}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
              placeholder={suggestingName ? "Suggesting name..." : "Enter name for new job"}
            />
            <p className="text-xs text-gray-500">
              The new job will inherit customer info and settings from the original job.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-2 py-1 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !newJobName.trim()}
            className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>{loading ? 'Creating...' : 'Create New Job & Estimate'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};