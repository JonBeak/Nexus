/**
 * QuickBooks Estimate Step Component
 *
 * Step 2: Create QuickBooks estimate from order.
 * Features:
 * - Staleness detection (checks if order data changed since estimate created)
 * - Create/Recreate estimate functionality
 * - Link to open estimate in QuickBooks
 * - Visual warning for stale estimates
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, FileText } from 'lucide-react';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { StepStatusBadge } from '../common/StepStatusBadge';
import { PrepareStep, PreparationState, QBEstimateInfo } from '@/types/orderPreparation';
import { updateStepStatus } from '@/utils/stepOrchestration';
import { canRunStep } from '@/utils/stepOrchestration';
import { ordersApi } from '@/services/api';

interface QBEstimateStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  orderNumber: number;
}

export const QBEstimateStep: React.FC<QBEstimateStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  orderNumber
}) => {
  const [qbEstimate, setQbEstimate] = useState<QBEstimateInfo | null>(state.qbEstimate);
  const [message, setMessage] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);

  // Check staleness on mount
  useEffect(() => {
    checkStaleness();
  }, []);

  const checkStaleness = async () => {
    try {
      setIsChecking(true);
      const result = await ordersApi.checkQBEstimateStaleness(orderNumber);

      const estimateInfo: QBEstimateInfo = {
        exists: result.staleness.exists,
        estimateNumber: result.staleness.qbEstimateNumber,
        createdAt: result.staleness.createdAt,
        isStale: result.staleness.isStale,
        dataHash: result.staleness.currentHash
      };

      setQbEstimate(estimateInfo);
      onStateChange({
        ...state,
        qbEstimate: estimateInfo
      });
    } catch (error) {
      console.error('Error checking QB estimate staleness:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleCreateEstimate = async () => {
    try {
      // Update status to running
      const updatedSteps = updateStepStatus(steps, step.id, 'running');
      onStateChange({ ...state, steps: updatedSteps });
      setMessage('Creating QuickBooks estimate...');

      // Create QB estimate
      const result = await ordersApi.createQBEstimate(orderNumber);

      // Update QB estimate info
      const newEstimateInfo: QBEstimateInfo = {
        exists: true,
        estimateNumber: result.estimateNumber,
        createdAt: new Date().toISOString(),
        isStale: false,
        dataHash: result.dataHash
      };

      setQbEstimate(newEstimateInfo);

      // Update status to completed
      const completedSteps = updateStepStatus(steps, step.id, 'completed');
      onStateChange({
        ...state,
        steps: completedSteps,
        qbEstimate: newEstimateInfo
      });

      setMessage(`QB Estimate ${result.estimateNumber} created successfully`);
    } catch (error) {
      console.error('Error creating QB estimate:', error);
      const failedSteps = updateStepStatus(
        steps,
        step.id,
        'failed',
        error instanceof Error ? error.message : 'Failed to create QB estimate'
      );
      onStateChange({ ...state, steps: failedSteps });
      setMessage('Failed to create QB estimate');
    }
  };

  const canRun = canRunStep(step, steps);
  const buttonLabel = qbEstimate?.exists ? 'Recreate QB Estimate' : 'Create QB Estimate';

  return (
    <StepCard
      title={step.title}
      description={step.description}
      header={<StepStatusBadge status={step.status} />}
      footer={
        <StepButton
          status={step.status}
          onClick={handleCreateEstimate}
          disabled={!canRun}
          label={buttonLabel}
        />
      }
    >
      <div className="space-y-3">
        {/* Loading State */}
        {isChecking && (
          <div className="text-sm text-gray-600 flex items-center space-x-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span>Checking QB estimate...</span>
          </div>
        )}

        {/* QB Estimate Info */}
        {!isChecking && qbEstimate && (
          <>
            {/* Exists and Current */}
            {qbEstimate.exists && !qbEstimate.isStale && (
              <div className="flex items-start space-x-2 text-sm">
                <FileText className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-gray-700">
                    QB Estimate: <span className="text-green-600">{qbEstimate.estimateNumber}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Created: {qbEstimate.createdAt && new Date(qbEstimate.createdAt).toLocaleString()}
                  </p>
                  <a
                    href="#"
                    className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 mt-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open in QuickBooks</span>
                  </a>
                </div>
              </div>
            )}

            {/* Exists but Stale */}
            {qbEstimate.exists && qbEstimate.isStale && (
              <div className="flex items-start space-x-2 text-sm bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-800">
                    Estimate is Stale
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Order data has changed since estimate {qbEstimate.estimateNumber} was created.
                    Consider recreating the estimate.
                  </p>
                  <a
                    href="#"
                    className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 mt-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View Current Estimate in QuickBooks</span>
                  </a>
                </div>
              </div>
            )}

            {/* Does Not Exist */}
            {!qbEstimate.exists && (
              <div className="flex items-start space-x-2 text-sm text-gray-600">
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-700">No QB Estimate</p>
                  <p className="text-xs mt-1">
                    Click "Create QB Estimate" to create an estimate in QuickBooks.
                  </p>
                </div>
              </div>
            )}
          </>
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
