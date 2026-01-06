/**
 * Step List Component
 *
 * Maps step IDs to their corresponding step components.
 * Acts as a router for rendering the appropriate step component.
 */

import React from 'react';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { Order } from '@/types/orders';
import { ValidationStep } from './steps/ValidationStep';
import { QBEstimateStep } from './steps/QBEstimateStep';
import { GeneratePDFsStep } from './steps/GeneratePDFsStep';
import { GenerateTasksStep } from './steps/GenerateTasksStep';

interface StepListProps {
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  order: Order;
  isOpen: boolean;
  onDataChanged?: () => void;  // Called when order data changes (e.g., spec cleanup during validation)
}

export const StepList: React.FC<StepListProps> = ({
  steps,
  state,
  onStateChange,
  order,
  isOpen,
  onDataChanged
}) => {
  const getStepComponent = (step: PrepareStep) => {
    const commonProps = {
      step,
      steps,
      state,
      onStateChange,
      order,
      isOpen
    };

    switch (step.id) {
      case 'validation':
        return <ValidationStep key={step.id} {...commonProps} onDataChanged={onDataChanged} />;

      case 'create_qb_estimate':
        return <QBEstimateStep key={step.id} {...commonProps} />;

      case 'generate_pdfs':
        return <GeneratePDFsStep key={step.id} {...commonProps} />;

      case 'generate_tasks':
        return <GenerateTasksStep key={step.id} {...commonProps} />;

      default:
        console.warn(`Unknown step ID: ${step.id}`);
        return null;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {steps.map(step => getStepComponent(step))}
    </div>
  );
};
