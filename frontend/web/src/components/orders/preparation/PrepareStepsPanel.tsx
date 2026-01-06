/**
 * Prepare Steps Panel Component
 *
 * Main container for the left panel in "prepare" phase.
 * Displays progress bar, step list, and quick actions.
 */

import React from 'react';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { Order } from '@/types/orders';
import { calculateProgress } from '@/utils/stepOrchestration';
import { StepList } from './StepList';
import { QuickActions } from './QuickActions';

interface PrepareStepsPanelProps {
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  order: Order;
  isOpen: boolean;
  onDataChanged?: () => void;  // Called when order data changes (e.g., spec cleanup during validation)
}

export const PrepareStepsPanel: React.FC<PrepareStepsPanelProps> = ({
  state,
  onStateChange,
  order,
  isOpen,
  onDataChanged
}) => {
  const progress = calculateProgress(state.steps);

  return (
    <div className="h-full flex flex-col">
      {/* Header with Quick Actions */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Preparation Steps</h3>
          <p className="text-sm text-gray-600 mt-1">
            Complete the steps below to prepare the order for sending to customer
          </p>
        </div>
        <QuickActions
          steps={state.steps}
          state={state}
          onStateChange={onStateChange}
          order={order}
        />
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-medium text-gray-900">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step List (scrollable) */}
      <div className="flex-1 overflow-y-auto pr-2">
        <StepList
          steps={state.steps}
          state={state}
          onStateChange={onStateChange}
          order={order}
          isOpen={isOpen}
          onDataChanged={onDataChanged}
        />
      </div>
    </div>
  );
};
