import React, { useState, useCallback } from 'react';
import { X, ArrowLeft, Copy } from 'lucide-react';
import { EstimateSelector, SelectedEstimate } from './EstimateSelector';
import { RowSelector } from './RowSelector';
import { GridRowCore } from '../../core/types/CoreTypes';

interface CopyRowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyRows: (rows: GridRowCore[], sourceEstimateId: number) => void;
  currentEstimateId?: number;
}

type Step = 'select-estimate' | 'select-rows';

export const CopyRowsModal: React.FC<CopyRowsModalProps> = ({
  isOpen,
  onClose,
  onCopyRows,
  currentEstimateId
}) => {
  const [step, setStep] = useState<Step>('select-estimate');
  const [selectedEstimate, setSelectedEstimate] = useState<SelectedEstimate | null>(null);
  const [selectedRows, setSelectedRows] = useState<GridRowCore[]>([]);

  const handleClose = useCallback(() => {
    setStep('select-estimate');
    setSelectedEstimate(null);
    setSelectedRows([]);
    onClose();
  }, [onClose]);

  const handleEstimateSelected = useCallback((estimate: SelectedEstimate) => {
    setSelectedEstimate(estimate);
    setStep('select-rows');
  }, []);

  const handleBack = useCallback(() => {
    setStep('select-estimate');
    setSelectedRows([]);
  }, []);

  const handleRowsSelected = useCallback((rows: GridRowCore[]) => {
    setSelectedRows(rows);
  }, []);

  const handleCopy = useCallback(() => {
    if (selectedRows.length > 0 && selectedEstimate) {
      onCopyRows(selectedRows, selectedEstimate.id);
      handleClose();
    }
  }, [selectedRows, selectedEstimate, onCopyRows, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {step === 'select-rows' && (
              <button
                onClick={handleBack}
                className="p-1 hover:bg-gray-100 rounded"
                title="Back to estimate selection"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'select-estimate' ? 'Copy Rows - Select Estimate' : 'Copy Rows - Select Rows'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === 'select-estimate' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'select-estimate' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Select Estimate</span>
            </div>
            <div className="flex-1 h-px bg-gray-300" />
            <div className={`flex items-center space-x-2 ${step === 'select-rows' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'select-rows' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Select Rows</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {step === 'select-estimate' ? (
            <EstimateSelector
              onEstimateSelected={handleEstimateSelected}
              currentEstimateId={currentEstimateId}
            />
          ) : selectedEstimate ? (
            <RowSelector
              estimate={selectedEstimate}
              onRowsSelected={handleRowsSelected}
              selectedRows={selectedRows}
            />
          ) : null}
        </div>

        {/* Footer */}
        {step === 'select-rows' && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedRows.length} row{selectedRows.length !== 1 ? 's' : ''} selected
              {selectedEstimate && (
                <span className="ml-2 text-gray-400">
                  from {selectedEstimate.customer_name} - {selectedEstimate.job_name} v{selectedEstimate.version_number}
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCopy}
                disabled={selectedRows.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Copy className="w-4 h-4" />
                <span>Copy {selectedRows.length} Row{selectedRows.length !== 1 ? 's' : ''}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
