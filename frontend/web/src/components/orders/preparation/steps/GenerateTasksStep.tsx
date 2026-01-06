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

import React, { useState, useEffect, useRef } from 'react';
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

interface PaintingWarning {
  partId: number;
  partName: string;
  itemType: string;
  component: string;
  timing: string;
  colour: string;
  message: string;
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
  const [paintingWarnings, setPaintingWarnings] = useState<PaintingWarning[]>([]);

  // Check staleness AFTER validation completes (when canRun becomes true)
  // This ensures empty spec rows are cleaned up before staleness is calculated
  const canRun = canRunStep(step, steps);
  const prevCanRunRef = useRef(false);

  useEffect(() => {
    // Only check when canRun transitions from false to true (validation just completed)
    if (canRun && !prevCanRunRef.current && isOpen) {
      checkTaskStaleness();
    }
    prevCanRunRef.current = canRun;
  }, [canRun, isOpen]);

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
      setPaintingWarnings([]); // Clear previous warnings

      const result = await ordersApi.generateProductionTasks(orderNumber);

      // Capture painting warnings if present
      if (result.paintingWarnings && result.paintingWarnings.length > 0) {
        setPaintingWarnings(result.paintingWarnings);
      }

      // Use functional update to preserve other state (e.g., PDF URLs)
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'completed')
      }));
      setMessage('✓ Production tasks generated successfully');
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
      setPaintingWarnings([]); // Clear warnings on error
    }
  };

  const buttonLabel = taskCount > 0
    ? (taskIsStale ? 'Regenerate Tasks (Stale)' : 'Regenerate Tasks')
    : 'Generate Tasks';

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <CompactStepRow
        stepNumber={step.order}
        name={step.name}
        description="Generate production tasks from order specifications"
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

      {/* Painting Warnings - Orange Alert */}
      {paintingWarnings.length > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded-r">
            <div className="flex items-start">
              <span className="text-orange-600 text-lg mr-2">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800 mb-2">
                  Painting Tasks Require Manual Input
                </p>
                <ul className="space-y-1.5 text-sm text-orange-700">
                  {paintingWarnings.map((warning, idx) => (
                    <li key={idx} className="flex flex-col">
                      <div className="font-medium">
                        Part {warning.partName} ({warning.itemType})
                      </div>
                      <div className="text-xs text-orange-600 ml-4">
                        • Component: {warning.component}, Timing: {warning.timing}, Colour: {warning.colour}
                      </div>
                      <div className="text-xs text-orange-600 ml-4">
                        • Action: Add painting tasks manually in <span className="font-semibold">Progress</span> view
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
