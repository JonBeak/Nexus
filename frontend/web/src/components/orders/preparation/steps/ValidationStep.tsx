/**
 * Validation Step Component
 *
 * Step 1: Validate order for preparation.
 * PLACEHOLDER - Always succeeds after 1 second delay.
 * Future: Add actual validation logic (required fields, data consistency, etc.)
 */

import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { StepStatusBadge } from '../common/StepStatusBadge';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { updateStepStatus } from '@/utils/stepOrchestration';
import { canRunStep } from '@/utils/stepOrchestration';

interface ValidationStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  orderNumber: number;
}

export const ValidationStep: React.FC<ValidationStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  orderNumber
}) => {
  const [message, setMessage] = useState<string>('');

  const handleRunStep = async () => {
    try {
      // Update status to running
      const updatedSteps = updateStepStatus(steps, step.id, 'running');
      onStateChange({ ...state, steps: updatedSteps });
      setMessage('Validating order...');

      // Simulate 1 second delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // TODO: Add actual validation logic in future phase
      // For now, always succeed

      // Update status to completed
      const completedSteps = updateStepStatus(steps, step.id, 'completed');
      onStateChange({ ...state, steps: completedSteps });
      setMessage('Order validated successfully');
    } catch (error) {
      console.error('Validation error:', error);
      const failedSteps = updateStepStatus(
        steps,
        step.id,
        'failed',
        error instanceof Error ? error.message : 'Validation failed'
      );
      onStateChange({ ...state, steps: failedSteps });
      setMessage('Validation failed');
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
          onClick={handleRunStep}
          disabled={!canRun}
          label="Validate Order"
        />
      }
    >
      <div className="space-y-3">
        {/* Info Message */}
        <div className="flex items-start space-x-2 text-sm text-gray-600">
          <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-gray-700">Placeholder Step</p>
            <p className="text-xs mt-1">
              This step will validate order data in a future phase.
              Currently, it always succeeds after a 1-second delay.
            </p>
          </div>
        </div>

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
