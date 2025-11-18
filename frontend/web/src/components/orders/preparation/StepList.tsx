/**
 * Step List Component
 *
 * Maps step IDs to their corresponding step components.
 * Acts as a router for rendering the appropriate step component.
 */

import React from 'react';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { ValidationStep } from './steps/ValidationStep';
import { QBEstimateStep } from './steps/QBEstimateStep';
import { GeneratePDFsStep } from './steps/GeneratePDFsStep';
import { DownloadQBPDFStep } from './steps/DownloadQBPDFStep';
import { SaveToFolderStep } from './steps/SaveToFolderStep';
import { GenerateTasksStep } from './steps/GenerateTasksStep';

interface StepListProps {
  steps: PrepareStep[];
  state: PreparationState;
  onStateChange: (state: PreparationState) => void;
  orderNumber: number;
}

export const StepList: React.FC<StepListProps> = ({
  steps,
  state,
  onStateChange,
  orderNumber
}) => {
  const getStepComponent = (step: PrepareStep) => {
    const commonProps = {
      step,
      steps,
      state,
      onStateChange,
      orderNumber
    };

    switch (step.id) {
      case 'validation':
        return <ValidationStep key={step.id} {...commonProps} />;

      case 'create_qb_estimate':
        return <QBEstimateStep key={step.id} {...commonProps} />;

      case 'generate_pdfs':
        return <GeneratePDFsStep key={step.id} {...commonProps} />;

      case 'download_qb_pdf':
        return <DownloadQBPDFStep key={step.id} {...commonProps} />;

      case 'save_to_folder':
        return <SaveToFolderStep key={step.id} {...commonProps} />;

      case 'generate_tasks':
        return <GenerateTasksStep key={step.id} {...commonProps} />;

      default:
        console.warn(`Unknown step ID: ${step.id}`);
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {steps.map(step => getStepComponent(step))}
    </div>
  );
};
