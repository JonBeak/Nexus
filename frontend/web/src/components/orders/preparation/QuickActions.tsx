/**
 * Quick Actions Component
 *
 * Provides "Do All Steps" button to run all pending steps in optimal order.
 * Respects dependencies and runs steps sequentially.
 */

import React, { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { getNextStep, updateStepStatus } from '@/utils/stepOrchestration';
import { ordersApi } from '@/services/api';

interface QuickActionsProps {
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  orderNumber: number;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  steps,
  state,
  onStateChange,
  orderNumber
}) => {
  const [isRunningAll, setIsRunningAll] = useState(false);

  const handleDoAllSteps = async () => {
    try {
      setIsRunningAll(true);
      let currentSteps = [...steps];
      let currentState = { ...state };

      // Run steps sequentially until all complete
      while (true) {
        const nextStep = getNextStep(currentSteps);
        if (!nextStep) {
          break; // No more pending steps
        }

        // Update status to running
        currentSteps = updateStepStatus(currentSteps, nextStep.id, 'running');
        onStateChange({ ...currentState, steps: currentSteps });

        try {
          // Execute step based on ID
          await executeStep(nextStep.id, orderNumber, currentState);

          // Update status to completed
          currentSteps = updateStepStatus(currentSteps, nextStep.id, 'completed');
          currentState = { ...currentState, steps: currentSteps };
          onStateChange(currentState);
        } catch (error) {
          console.error(`Error executing step ${nextStep.id}:`, error);

          // Update status to failed
          currentSteps = updateStepStatus(
            currentSteps,
            nextStep.id,
            'failed',
            error instanceof Error ? error.message : 'Step failed'
          );
          currentState = { ...currentState, steps: currentSteps };
          onStateChange(currentState);

          // Stop on first failure
          break;
        }

        // Small delay between steps for UX
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error running all steps:', error);
    } finally {
      setIsRunningAll(false);
    }
  };

  const executeStep = async (stepId: string, orderNumber: number, currentState: PreparationState) => {
    switch (stepId) {
      case 'validation':
        await new Promise(resolve => setTimeout(resolve, 1000));
        break;

      case 'create_qb_estimate':
        await ordersApi.createQBEstimate(orderNumber);
        break;

      case 'generate_pdfs':
        const pdfResult = await ordersApi.generateOrderFormPDF(orderNumber);
        currentState.pdfs.orderForm = { url: pdfResult.formPaths.estimateForm, loaded: false };
        break;

      case 'download_qb_pdf':
        const qbPdfResult = await ordersApi.downloadQBEstimatePDF(orderNumber);
        currentState.pdfs.qbEstimate = { url: qbPdfResult.pdfUrl, loaded: false };
        break;

      case 'save_to_folder':
        await ordersApi.savePDFsToFolder(orderNumber);
        break;

      case 'generate_tasks':
        await new Promise(resolve => setTimeout(resolve, 1500));
        break;

      default:
        console.warn(`Unknown step ID: ${stepId}`);
    }
  };

  const allCompleted = steps.every(s => s.status === 'completed');
  const someRunning = steps.some(s => s.status === 'running') || isRunningAll;
  const isDisabled = allCompleted || someRunning;

  return (
    <div>
      <button
        onClick={handleDoAllSteps}
        disabled={isDisabled}
        className={`
          w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg
          text-sm font-medium transition-colors
          ${
            isDisabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }
        `}
      >
        {isRunningAll ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Running All Steps...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            <span>{allCompleted ? 'All Steps Complete' : 'Do All Steps'}</span>
          </>
        )}
      </button>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Runs all pending steps in optimal order
      </p>
    </div>
  );
};
