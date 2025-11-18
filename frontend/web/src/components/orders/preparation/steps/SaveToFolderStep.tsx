/**
 * Save to Folder Step Component
 *
 * Step 5: Save all PDFs to order folder.
 * Coordination step - verifies both order form and QB estimate PDFs are saved.
 * Requires steps 3 and 4 to be completed.
 */

import React, { useState } from 'react';
import { Folder, CheckCircle } from 'lucide-react';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { StepStatusBadge } from '../common/StepStatusBadge';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { updateStepStatus } from '@/utils/stepOrchestration';
import { canRunStep } from '@/utils/stepOrchestration';
import { ordersApi } from '@/services/api';

interface SaveToFolderStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  orderNumber: number;
}

export const SaveToFolderStep: React.FC<SaveToFolderStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  orderNumber
}) => {
  const [message, setMessage] = useState<string>('');

  const handleSaveToFolder = async () => {
    try {
      // Check if both PDFs are generated
      if (!state.pdfs.orderForm) {
        throw new Error('Order form PDF must be generated first');
      }
      if (!state.pdfs.qbEstimate) {
        throw new Error('QB estimate PDF must be downloaded first');
      }

      // Update status to running
      const updatedSteps = updateStepStatus(steps, step.id, 'running');
      onStateChange({ ...state, steps: updatedSteps });
      setMessage('Saving PDFs to order folder...');

      // Save PDFs to folder (coordination endpoint)
      await ordersApi.savePDFsToFolder(orderNumber);

      // Update status to completed
      const completedSteps = updateStepStatus(steps, step.id, 'completed');
      onStateChange({
        ...state,
        steps: completedSteps
      });

      setMessage('All PDFs saved to order folder successfully');
    } catch (error) {
      console.error('Error saving PDFs to folder:', error);
      const failedSteps = updateStepStatus(
        steps,
        step.id,
        'failed',
        error instanceof Error ? error.message : 'Failed to save PDFs to folder'
      );
      onStateChange({ ...state, steps: failedSteps });
      setMessage('Failed to save PDFs to folder');
    }
  };

  const canRun = canRunStep(step, steps);
  const hasOrderFormPDF = !!state.pdfs.orderForm;
  const hasQBPDF = !!state.pdfs.qbEstimate;
  const hasBothPDFs = hasOrderFormPDF && hasQBPDF;

  return (
    <StepCard
      title={step.title}
      description={step.description}
      header={<StepStatusBadge status={step.status} />}
      footer={
        <StepButton
          status={step.status}
          onClick={handleSaveToFolder}
          disabled={!canRun || !hasBothPDFs}
          label="Save to Folder"
        />
      }
    >
      <div className="space-y-3">
        {/* Dependency Warning */}
        {!hasBothPDFs && (
          <div className="flex items-start space-x-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200">
            <Folder className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">PDFs Required</p>
              <p className="text-xs mt-1">
                Generate order form PDF (Step 3) and download QB estimate PDF (Step 4) first.
              </p>
              <ul className="text-xs mt-2 space-y-1">
                <li className="flex items-center space-x-1">
                  <CheckCircle className={`w-3 h-3 ${hasOrderFormPDF ? 'text-green-600' : 'text-gray-400'}`} />
                  <span>Order form PDF {hasOrderFormPDF ? 'ready' : 'not generated'}</span>
                </li>
                <li className="flex items-center space-x-1">
                  <CheckCircle className={`w-3 h-3 ${hasQBPDF ? 'text-green-600' : 'text-gray-400'}`} />
                  <span>QB estimate PDF {hasQBPDF ? 'ready' : 'not downloaded'}</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Info Message */}
        {hasBothPDFs && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <Folder className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-700">Ready to Save</p>
              <p className="text-xs mt-1">
                All PDFs are ready. Click "Save to Folder" to finalize the file organization.
              </p>
            </div>
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
