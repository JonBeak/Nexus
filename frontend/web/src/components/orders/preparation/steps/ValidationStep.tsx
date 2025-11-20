/**
 * Validation Step Component (Compact)
 *
 * Step 1: Validate order data before processing.
 */

import React, { useState, useEffect, useRef } from 'react';
import { CompactStepRow } from '../common/CompactStepRow';
import { CompactStepButton } from '../common/CompactStepButton';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { Order } from '@/types/orders';
import { updateStepStatus, canRunStep } from '@/utils/stepOrchestration';
import { ordersApi } from '@/services/api';
import { AlertCircle } from 'lucide-react';

interface ValidationError {
  field: string;
  message: string;
  partNumber?: number;
  templateName?: string;
}

interface ValidationStepProps {
  step: PrepareStep;
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  order: Order;
  isOpen: boolean;
}

export const ValidationStep: React.FC<ValidationStepProps> = ({
  step,
  steps,
  state,
  onStateChange,
  order,
  isOpen
}) => {
  const orderNumber = order.order_number;
  const [message, setMessage] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const prevIsOpenRef = React.useRef(false);

  const handleValidate = async () => {
    try {
      // Use functional update to preserve other state (e.g., PDF URLs)
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'running')
      }));
      setMessage('Validating order data...');
      setValidationErrors([]);

      await ordersApi.validateForPreparation(orderNumber);

      // Use functional update to preserve other state (e.g., PDF URLs)
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'completed')
      }));
      setMessage('✓ Order validation successful');
    } catch (error: any) {
      console.error('Error validating order:', error);

      // Extract validation errors from API response
      const errors = error?.response?.data?.details?.errors || [];
      setValidationErrors(errors);

      // Mark step as failed but don't pass error message (we'll show detailed errors below)
      // Use functional update to preserve other state (e.g., PDF URLs)
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'failed', undefined)
      }));
      setMessage('');
    }
  };

  // Auto-run validation when modal opens (isOpen transitions false → true)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Modal just opened, simulate button press
      handleValidate();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  const canRun = canRunStep(step, steps);

  return (
    <div className="border-b border-gray-200">
      <CompactStepRow
        stepNumber={step.order}
        name={step.name}
        description={step.description}
        status={step.status}
        message={message}
        error={step.error}
        disabled={!canRun}
        button={
          <CompactStepButton
            status={step.status}
            onClick={handleValidate}
            disabled={!canRun}
            label="Run Validation"
          />
        }
      />

      {/* Detailed validation errors */}
      {validationErrors.length > 0 && (
        <div className="px-4 pb-3">
          <div className="ml-9 bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm font-medium text-red-900">
                Found {validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''}
              </div>
            </div>
            <div className="ml-6 space-y-1.5">
              {validationErrors.map((error, index) => (
                <div key={index} className="text-xs text-red-800">
                  <span className="font-medium">
                    Part {error.partNumber}
                    {error.templateName && ` - ${error.templateName}`}:
                  </span>{' '}
                  <span>{error.message}</span>
                </div>
              ))}
            </div>
            <div className="ml-6 mt-3 pt-2 border-t border-red-200 text-xs text-red-700 italic">
              Please fix these issues in the order details before proceeding with preparation.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
