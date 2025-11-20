/**
 * Generate Tasks Step Component (Compact)
 *
 * Step 4: Auto-generate production tasks
 * Features:
 * - Staleness detection (shares same hash as QB/PDFs)
 * - Unlike QB/PDFs, stays completed even if stale (tasks may have work-in-progress)
 * - Shows warning when stale but doesn't reset to pending
 * - Regenerating replaces all existing tasks
 */

import React, { useState, useEffect } from 'react';
import { CompactStepRow } from '../common/CompactStepRow';
import { CompactStepButton } from '../common/CompactStepButton';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { Order } from '@/types/orders';
import { updateStepStatus, canRunStep } from '@/utils/stepOrchestration';
import { ordersApi } from '@/services/api';

interface GenerateTasksStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  order: Order;
  isOpen: boolean;
}

export const GenerateTasksStep: React.FC<GenerateTasksStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  order,
  isOpen
}) => {
  const orderNumber = order.order_number;
  const [message, setMessage] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [taskIsStale, setTaskIsStale] = useState(false);
  const [taskCount, setTaskCount] = useState(0);

  // Check staleness when modal opens or reopens
  useEffect(() => {
    if (isOpen) {
      checkTaskStaleness();
    }
  }, [isOpen]);

  const checkTaskStaleness = async () => {
    try {
      setIsChecking(true);
      const result = await ordersApi.checkTaskStaleness(orderNumber);
      const staleness = result.staleness;

      setTaskIsStale(staleness.isStale);
      setTaskCount(staleness.taskCount);

      // Unlike QB/PDFs: Tasks stay completed even if stale
      // This is because tasks may have work-in-progress that shouldn't be lost
      if (staleness.exists && !staleness.isStale) {
        // Fresh tasks - complete step if pending
        if (step.status === 'pending') {
          onStateChange(prev => ({
            ...prev,
            steps: updateStepStatus(prev.steps, step.id, 'completed')
          }));
        }
        setMessage(`✓ ${staleness.taskCount} production tasks are up-to-date`);
      } else if (staleness.exists && staleness.isStale) {
        // Stale tasks - show warning but KEEP step completed
        setMessage(`⚠ ${staleness.taskCount} tasks may be outdated (order data changed)`);
      }
    } catch (error) {
      console.error('Error checking task staleness:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleGenerateTasks = async () => {
    try {
      // Use functional update to preserve other state (e.g., PDF URLs)
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'running')
      }));
      setMessage('Generating production tasks...');

      await ordersApi.generateProductionTasks(orderNumber);

      // Use functional update to preserve other state (e.g., PDF URLs)
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'completed')
      }));
      setMessage('✓ Production tasks generated (Phase 1.5.d placeholder)');
    } catch (error) {
      console.error('Error generating tasks:', error);
      // Use functional update to preserve other state (e.g., PDF URLs)
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(
          prev.steps,
          step.id,
          'failed',
          error instanceof Error ? error.message : 'Failed to generate tasks'
        )
      }));
      setMessage('');
    }
  };

  const canRun = canRunStep(step, steps);
  const buttonLabel = taskCount > 0
    ? (taskIsStale ? 'Regenerate Tasks (Stale)' : 'Regenerate Tasks')
    : 'Generate Tasks';

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <CompactStepRow
        stepNumber={step.order}
        name={step.name}
        description="Generate production tasks from order data (Phase 1.5.d)"
        status={step.status}
        message={isChecking ? 'Checking task status...' : message}
        error={step.error}
        disabled={!canRun}
        button={
          <CompactStepButton
            status={step.status}
            onClick={handleGenerateTasks}
            disabled={!canRun}
            label={buttonLabel}
          />
        }
      />
    </div>
  );
};
