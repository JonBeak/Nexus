/**
 * Generate PDFs Step Component (Compact)
 *
 * Step 3: Generate order form PDFs with staleness detection.
 * - Auto-completes if PDFs are fresh
 * - Shows simple staleness warning
 * - Generates all order forms and saves to SMB folder
 */

import React, { useState, useEffect, useRef } from 'react';
import { CompactStepRow } from '../common/CompactStepRow';
import { CompactStepButton } from '../common/CompactStepButton';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { Order } from '@/types/orders';
import { updateStepStatus, canRunStep } from '@/utils/stepOrchestration';
import { ordersApi } from '@/services/api';
import { buildPdfUrls } from '@/utils/pdfUrls';

interface GeneratePDFsStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  order: Order;
  isOpen: boolean;
}

export const GeneratePDFsStep: React.FC<GeneratePDFsStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  order,
  isOpen
}) => {
  const orderNumber = order.order_number;
  const [message, setMessage] = useState<string>('');
  const [isChecking, setIsChecking] = useState(true);
  const [pdfIsStale, setPdfIsStale] = useState(false);

  // Check staleness AFTER validation completes (when canRun becomes true)
  // This ensures empty spec rows are cleaned up before staleness is calculated
  const canRun = canRunStep(step, steps);
  const prevCanRunRef = useRef(false);

  useEffect(() => {
    // Only check when canRun transitions from false to true (validation just completed)
    if (canRun && !prevCanRunRef.current && isOpen) {
      checkPDFStaleness();
    }
    prevCanRunRef.current = canRun;
  }, [canRun, isOpen]);

  const checkPDFStaleness = async () => {
    try {
      const result = await ordersApi.checkPDFStaleness(orderNumber);
      const staleness = result.staleness;

      setPdfIsStale(staleness.isStale);

      // Don't overwrite failed or running status with staleness check results
      if (step.status === 'failed' || step.status === 'running') {
        setIsChecking(false);
        return;
      }

      // Determine correct step status based on staleness
      let newStatus: 'pending' | 'completed' = 'pending';
      let newMessage = '';

      if (staleness.exists && !staleness.isStale) {
        // Fresh PDFs - complete the step
        newStatus = 'completed';
        newMessage = '✓ PDFs are up-to-date';
      } else if (staleness.exists && staleness.isStale) {
        // Stale PDFs - reset to pending (even if was completed before)
        newStatus = 'pending';
        newMessage = '⚠ PDFs are stale - order data has changed';
      } else {
        // No PDFs - keep/reset to pending
        newStatus = 'pending';
        newMessage = '';
      }

      // Update step status if it needs to change
      if (step.status !== newStatus) {
        onStateChange(prev => ({
          ...prev,
          steps: updateStepStatus(prev.steps, step.id, newStatus)
        }));
      }

      setMessage(newMessage);
    } catch (error) {
      console.error('Error checking PDF staleness:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleGeneratePDFs = async () => {
    try {
      // Use functional update for running status
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'running')
      }));
      setMessage('Generating order form PDFs and saving to SMB folder...');

      await ordersApi.generateOrderFormPDF(orderNumber);

      // Refresh PDF URLs with new cache busters to force iframe reload
      const refreshedUrls = buildPdfUrls(order, true); // true = add cache buster

      // Use functional update for completion
      onStateChange(prev => ({
        ...prev,
        pdfs: {
          ...prev.pdfs,
          orderForm: refreshedUrls ? {
            url: refreshedUrls.master,  // Master Order Form
            loading: false,
            error: null
          } : prev.pdfs.orderForm,
          packingList: refreshedUrls ? {
            url: refreshedUrls.packing,  // Packing List
            loading: false,
            error: null
          } : prev.pdfs.packingList,
          internalEstimate: refreshedUrls ? {
            url: refreshedUrls.estimate,  // Internal Estimate
            loading: false,
            error: null
          } : prev.pdfs.internalEstimate
        },
        steps: updateStepStatus(prev.steps, step.id, 'completed')
      }));

      await checkPDFStaleness();
      setMessage('✓ PDFs generated and saved to SMB folder');
    } catch (error: any) {
      console.error('Error generating PDFs:', error);
      // Extract the actual error message from axios response (backend uses 'error' field)
      const errorMessage = error?.response?.data?.error
        || error?.response?.data?.message
        || (error instanceof Error ? error.message : 'Failed to generate PDFs');
      // Use functional update to prevent race conditions
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'failed', errorMessage)
      }));
      setMessage('');
    }
  };

  const buttonLabel = pdfIsStale ? 'Regenerate PDFs (Stale)' : 'Generate PDFs';

  return (
    <div className="border-b border-gray-200">
      <CompactStepRow
        stepNumber={step.order}
        name={step.name}
        description="Generate order form PDFs and save to SMB folder"
        status={step.status}
        message={isChecking ? 'Checking PDF status...' : message}
        error={step.error}
        disabled={!canRun}
        button={
          <CompactStepButton
            status={step.status}
            onClick={handleGeneratePDFs}
            disabled={!canRun}
            label={buttonLabel}
          />
        }
      />
    </div>
  );
};
