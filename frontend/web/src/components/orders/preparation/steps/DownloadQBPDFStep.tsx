/**
 * Download QB PDF Step Component
 *
 * Step 4: Download QuickBooks estimate PDF.
 * Requires QB estimate to exist (dependency on step 2).
 * Downloads PDF from QuickBooks and saves to order folder.
 */

import React, { useState } from 'react';
import { Download, ArrowRight } from 'lucide-react';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { StepStatusBadge } from '../common/StepStatusBadge';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { updateStepStatus } from '@/utils/stepOrchestration';
import { canRunStep } from '@/utils/stepOrchestration';
import { ordersApi } from '@/services/api';

interface DownloadQBPDFStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  orderNumber: number;
}

export const DownloadQBPDFStep: React.FC<DownloadQBPDFStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  orderNumber
}) => {
  const [message, setMessage] = useState<string>('');

  const handleDownloadPDF = async () => {
    try {
      // Check if QB estimate exists
      if (!state.qbEstimate?.exists) {
        throw new Error('QB estimate must be created first');
      }

      // Update status to running
      const updatedSteps = updateStepStatus(steps, step.id, 'running');
      onStateChange({ ...state, steps: updatedSteps });
      setMessage('Downloading QB estimate PDF...');

      // Download QB estimate PDF (we'll need the QB estimate ID from the backend)
      // For now, we'll use a placeholder API call
      const result = await ordersApi.downloadQBEstimatePDF(orderNumber);

      // Update PDF URLs in state
      const updatedState: PreparationState = {
        ...state,
        pdfs: {
          ...state.pdfs,
          qbEstimate: {
            url: result.pdfUrl,
            loaded: false
          }
        }
      };

      // Update status to completed
      const completedSteps = updateStepStatus(steps, step.id, 'completed');
      onStateChange({
        ...updatedState,
        steps: completedSteps
      });

      setMessage('QB estimate PDF downloaded successfully (visible in preview panel →)');
    } catch (error) {
      console.error('Error downloading QB PDF:', error);
      const failedSteps = updateStepStatus(
        steps,
        step.id,
        'failed',
        error instanceof Error ? error.message : 'Failed to download QB PDF'
      );
      onStateChange({ ...state, steps: failedSteps });
      setMessage('Failed to download QB PDF');
    }
  };

  const canRun = canRunStep(step, steps);
  const hasQBEstimate = state.qbEstimate?.exists || false;

  return (
    <StepCard
      title={step.title}
      description={step.description}
      header={<StepStatusBadge status={step.status} />}
      footer={
        <StepButton
          status={step.status}
          onClick={handleDownloadPDF}
          disabled={!canRun || !hasQBEstimate}
          label="Download QB PDF"
        />
      }
    >
      <div className="space-y-3">
        {/* Dependency Warning */}
        {!hasQBEstimate && (
          <div className="flex items-start space-x-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200">
            <Download className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">QB Estimate Required</p>
              <p className="text-xs mt-1">
                Create a QB estimate in Step 2 before downloading the PDF.
              </p>
            </div>
          </div>
        )}

        {/* Info Message */}
        {hasQBEstimate && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <Download className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-700">QB Estimate PDF</p>
              <p className="text-xs mt-1">
                Downloads the QB estimate PDF from QuickBooks and saves it to the order folder.
              </p>
            </div>
          </div>
        )}

        {/* PDF Preview Indicator */}
        {state.pdfs.qbEstimate && (
          <div className="flex items-center space-x-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded border border-green-200">
            <Download className="w-4 h-4" />
            <span>QB PDF downloaded - preview available</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </div>
        )}

        {/* Status Message */}
        {message && (
          <div className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded border border-gray-200">
            {message}
          </div>
        )}

        {/* Error Display */}
        {step.error && (
          <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded border border-red-200">
            {step.error}
          </div>
        )}
      </div>
    </StepCard>
  );
};
