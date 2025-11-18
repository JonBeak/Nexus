/**
 * Generate Tasks Step Component
 *
 * Step 6: Generate production tasks.
 * PLACEHOLDER - For Phase 1.5.d
 * Currently simulates task generation with 1.5 second delay.
 */

import React, { useState } from 'react';
import { ListTodo } from 'lucide-react';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { StepStatusBadge } from '../common/StepStatusBadge';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { updateStepStatus } from '@/utils/stepOrchestration';
import { canRunStep } from '@/utils/stepOrchestration';

interface GenerateTasksStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  orderNumber: number;
}

export const GenerateTasksStep: React.FC<GenerateTasksStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  orderNumber
}) => {
  const [message, setMessage] = useState<string>('');

  const handleGenerateTasks = async () => {
    try {
      // Update status to running
      const updatedSteps = updateStepStatus(steps, step.id, 'running');
      onStateChange({ ...state, steps: updatedSteps });
      setMessage('Generating production tasks...');

      // Simulate 1.5 second delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // TODO: Add actual task generation logic in Phase 1.5.d
      // For now, always succeed

      // Update status to completed
      const completedSteps = updateStepStatus(steps, step.id, 'completed');
      onStateChange({ ...state, steps: completedSteps });
      setMessage('Production tasks will be generated in Phase 1.5.d');
    } catch (error) {
      console.error('Task generation error:', error);
      const failedSteps = updateStepStatus(
        steps,
        step.id,
        'failed',
        error instanceof Error ? error.message : 'Task generation failed'
      );
      onStateChange({ ...state, steps: failedSteps });
      setMessage('Task generation failed');
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
          onClick={handleGenerateTasks}
          disabled={!canRun}
          label="Generate Tasks"
        />
      }
    >
      <div className="space-y-3">
        {/* Info Message */}
        <div className="flex items-start space-x-2 text-sm text-gray-600">
          <ListTodo className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-gray-700">Placeholder Step</p>
            <p className="text-xs mt-1">
              This step will generate production tasks in Phase 1.5.d.
              Currently, it simulates task generation with a 1.5-second delay.
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
