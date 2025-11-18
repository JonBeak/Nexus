/**
 * Generate PDFs Step Component
 *
 * Step 3: Generate order form PDFs.
 * Generates all order forms (master, estimate, shop, customer, packing list).
 * Updates PDF preview panel with generated URLs.
 */

import React, { useState } from 'react';
import { FileText, ArrowRight } from 'lucide-react';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { StepStatusBadge } from '../common/StepStatusBadge';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { updateStepStatus } from '@/utils/stepOrchestration';
import { canRunStep } from '@/utils/stepOrchestration';
import { ordersApi } from '@/services/api';

interface GeneratePDFsStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  orderNumber: number;
}

export const GeneratePDFsStep: React.FC<GeneratePDFsStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  orderNumber
}) => {
  const [message, setMessage] = useState<string>('');

  const handleGeneratePDFs = async () => {
    try {
      // Update status to running
      const updatedSteps = updateStepStatus(steps, step.id, 'running');
      onStateChange({ ...state, steps: updatedSteps });
      setMessage('Generating order form PDFs...');

      // Generate PDFs
      const result = await ordersApi.generateOrderFormPDF(orderNumber);

      // Update PDF URLs in state
      const updatedState: PreparationState = {
        ...state,
        pdfs: {
          ...state.pdfs,
          orderForm: {
            url: result.formPaths.estimateForm, // Use estimate form for preview
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

      setMessage('Order form PDFs generated successfully (visible in preview panel →)');
    } catch (error) {
      console.error('Error generating PDFs:', error);
      const failedSteps = updateStepStatus(
        steps,
        step.id,
        'failed',
        error instanceof Error ? error.message : 'Failed to generate PDFs'
      );
      onStateChange({ ...state, steps: failedSteps });
      setMessage('Failed to generate PDFs');
    }
  };

  const canRun = canRunStep(step, steps);

  return (
    <StepCard
      title={step.title}
      description={step.description}
      header={<StepStatusBadge status={step.status} />}
      footer={
        <StepButton
          status={step.status}
          onClick={handleGeneratePDFs}
          disabled={!canRun}
          label="Generate PDFs"
        />
      }
    >
      <div className="space-y-3">
        {/* Info Message */}
        <div className="flex items-start space-x-2 text-sm text-gray-600">
          <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-gray-700">Order Form PDFs</p>
            <p className="text-xs mt-1">
              Generates master form, estimate form, shop form, customer form, and packing list.
            </p>
          </div>
        </div>

        {/* PDF Preview Indicator */}
        {state.pdfs.orderForm && (
          <div className="flex items-center space-x-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded border border-green-200">
            <FileText className="w-4 h-4" />
            <span>PDF generated - preview available</span>
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
