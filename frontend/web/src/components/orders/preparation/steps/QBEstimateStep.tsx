/**
 * QuickBooks Estimate Step Component (Compact)
 *
 * Step 2: Create QuickBooks estimate from order.
 * Features:
 * - Staleness detection (checks if order data changed since estimate created)
 * - Create/Recreate estimate functionality
 * - Auto-downloads PDF to SMB order folder
 */

import React, { useState, useEffect } from 'react';
import { CompactStepRow } from '../common/CompactStepRow';
import { CompactStepButton } from '../common/CompactStepButton';
import { PrepareStep, PreparationState, QBEstimateInfo } from '@/types/orderPreparation';
import { Order } from '@/types/orders';
import { updateStepStatus, canRunStep } from '@/utils/stepOrchestration';
import { ordersApi } from '@/services/api';
import { buildPdfUrls } from '@/utils/pdfUrls';

interface QBEstimateStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  order: Order;
  isOpen: boolean;
}

export const QBEstimateStep: React.FC<QBEstimateStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  order,
  isOpen
}) => {
  const orderNumber = order.order_number;
  const [qbEstimate, setQbEstimate] = useState<QBEstimateInfo | null>(state.qbEstimate);
  const [message, setMessage] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);

  // Check staleness when modal opens or reopens
  useEffect(() => {
    if (isOpen) {
      checkStaleness();
    }
  }, [isOpen]);

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

      // Determine correct step status based on staleness
      let newStatus: 'pending' | 'completed' = 'pending';
      let newMessage = '';

      if (estimateInfo.exists && !estimateInfo.isStale) {
        // Fresh estimate - complete the step
        newStatus = 'completed';
        newMessage = `✓ QB Estimate ${estimateInfo.estimateNumber} is up-to-date`;
      } else if (estimateInfo.exists && estimateInfo.isStale) {
        // Stale estimate - reset to pending (even if was completed before)
        newStatus = 'pending';
        newMessage = `⚠ QB Estimate ${estimateInfo.estimateNumber} is stale - order data has changed`;
      } else {
        // No estimate - keep/reset to pending
        newStatus = 'pending';
        newMessage = '';
      }

      // Update step status if it needs to change
      if (step.status !== newStatus) {
        onStateChange(prev => ({
          ...prev,
          qbEstimate: estimateInfo,
          steps: updateStepStatus(prev.steps, step.id, newStatus)
        }));
      } else {
        // Just update QB estimate info, status unchanged
        onStateChange(prev => ({
          ...prev,
          qbEstimate: estimateInfo
        }));
      }

      setMessage(newMessage);
    } catch (error) {
      console.error('Error checking QB estimate staleness:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleCreateEstimate = async () => {
    try {
      // Use functional update for running status
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'running')
      }));
      setMessage('Creating QuickBooks estimate and downloading PDF...');

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

      // Refresh QB Estimate PDF URL with new cache buster to force iframe reload
      const refreshedUrls = buildPdfUrls(order, true); // true = add cache buster

      // Use functional update for completion
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'completed'),
        qbEstimate: newEstimateInfo,
        pdfs: {
          ...prev.pdfs,
          qbEstimate: refreshedUrls ? {
            url: refreshedUrls.qbEstimate,
            loading: false,
            error: null
          } : prev.pdfs.qbEstimate
        }
      }));

      setMessage(`✓ QB Estimate ${result.estimateNumber} created and PDF auto-downloaded to Specs folder`);
    } catch (error) {
      console.error('Error creating QB estimate:', error);
      const failedSteps = updateStepStatus(
        steps,
        step.id,
        'failed',
        error instanceof Error ? error.message : 'Failed to create QB estimate'
      );
      onStateChange({ ...state, steps: failedSteps });
      setMessage('');
    }
  };

  const canRun = canRunStep(step, steps);
  const buttonLabel = qbEstimate?.exists ? 'Recreate Estimate' : 'Create Estimate';

  return (
    <div className="border-b border-gray-200">
      <CompactStepRow
        stepNumber={step.order}
        name={step.name}
        description="Create estimate in QuickBooks (auto-downloads PDF to SMB order folder)"
        status={step.status}
        message={isChecking ? 'Checking QB estimate status...' : message}
        error={step.error}
        disabled={!canRun}
        button={
          <CompactStepButton
            status={step.status}
            onClick={handleCreateEstimate}
            disabled={!canRun}
            label={buttonLabel}
          />
        }
      />
    </div>
  );
};
