/**
 * QuickBooks Estimate Step Component (Compact)
 *
 * Step 2: Create QuickBooks estimate from order.
 * Features:
 * - QB connection status check with inline connect button
 * - Staleness detection (checks if order data changed since estimate created)
 * - Create/Recreate estimate functionality
 * - Auto-downloads PDF to SMB order folder
 */

import React, { useState, useEffect, useRef } from 'react';
import { CompactStepRow } from '../common/CompactStepRow';
import { CompactStepButton } from '../common/CompactStepButton';
import { PrepareStep, PreparationState, QBEstimateInfo } from '@/types/orderPreparation';
import { Order } from '@/types/orders';
import { updateStepStatus, canRunStep } from '@/utils/stepOrchestration';
import { ordersApi, quickbooksApi } from '@/services/api';
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

  // QB Connection state
  const [qbConnected, setQbConnected] = useState<boolean | null>(null); // null = checking
  const [isConnecting, setIsConnecting] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check QB connection when modal opens
  useEffect(() => {
    if (isOpen) {
      checkQBConnection();
    }

    // Cleanup polling on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen]);

  // Check staleness AFTER validation completes (when canRun becomes true)
  // This ensures empty spec rows are cleaned up before staleness is calculated
  const canRun = canRunStep(step, steps);
  const prevCanRunRef = useRef(false);

  useEffect(() => {
    // Only check when canRun transitions from false to true (validation just completed)
    if (canRun && !prevCanRunRef.current && isOpen) {
      checkStaleness();
    }
    prevCanRunRef.current = canRun;
  }, [canRun, isOpen]);

  const checkQBConnection = async () => {
    try {
      const status = await quickbooksApi.getStatus();
      setQbConnected(status.connected);
    } catch (error) {
      console.error('Error checking QB connection:', error);
      setQbConnected(false);
    }
  };

  const handleConnectToQuickBooks = async () => {
    try {
      setIsConnecting(true);

      // Check if credentials are configured
      const configStatus = await quickbooksApi.getConfigStatus();
      if (!configStatus.configured) {
        alert('QuickBooks credentials not configured. Please contact administrator.');
        setIsConnecting(false);
        return;
      }

      // Open OAuth window
      await quickbooksApi.startAuth();

      // Poll for connection status (OAuth happens in popup)
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await quickbooksApi.getStatus();
          if (status.connected) {
            setQbConnected(true);
            setIsConnecting(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch (error) {
          console.error('Error polling QB status:', error);
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsConnecting(false);
        }
      }, 120000);

    } catch (error) {
      console.error('Error connecting to QuickBooks:', error);
      alert('Failed to connect to QuickBooks. Please try again.');
      setIsConnecting(false);
    }
  };

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

  const buttonLabel = qbEstimate?.exists ? 'Recreate Estimate' : 'Create Estimate';

  // Determine what to show based on QB connection status
  const getStatusMessage = () => {
    if (qbConnected === null) return 'Checking QuickBooks connection...';
    if (isChecking) return 'Checking QB estimate status...';
    if (!qbConnected) return 'QuickBooks not connected';
    return message;
  };

  // Determine message type based on state
  const getMessageType = (): 'success' | 'info' | 'warning' => {
    if (qbConnected === false) return 'info'; // Not connected = gray
    if (qbEstimate?.isStale) return 'warning'; // Stale = red
    return 'success'; // Everything else = green
  };

  const renderButton = () => {
    // Still checking connection
    if (qbConnected === null) {
      return (
        <button
          disabled
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-400 rounded cursor-not-allowed"
        >
          Checking...
        </button>
      );
    }

    // Not connected - show connect button
    if (!qbConnected) {
      return (
        <button
          onClick={handleConnectToQuickBooks}
          disabled={isConnecting}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {isConnecting ? (
            <>
              <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
              Connecting...
            </>
          ) : (
            'Connect to QB'
          )}
        </button>
      );
    }

    // Connected - show normal create/recreate button
    return (
      <CompactStepButton
        status={step.status}
        onClick={handleCreateEstimate}
        disabled={!canRun}
        label={buttonLabel}
      />
    );
  };

  // Only disable row if prerequisites not met AND we're connected
  // Don't disable when not connected - we want the Connect button to be prominent
  const rowDisabled = qbConnected === true && !canRun;

  return (
    <div className="border-b border-gray-200">
      <CompactStepRow
        stepNumber={step.order}
        name={step.name}
        description={qbConnected === false
          ? "Connect to QuickBooks to create estimates"
          : "Create estimate in QuickBooks (auto-downloads PDF to SMB order folder)"
        }
        status={qbConnected === false ? 'pending' : step.status}
        message={getStatusMessage()}
        messageType={getMessageType()}
        error={step.error}
        disabled={rowDisabled}
        button={renderButton()}
      />
    </div>
  );
};
