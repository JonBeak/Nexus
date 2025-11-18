/**
 * Step Button Component
 *
 * Action button for preparation steps with loading, completed, and failed states.
 * Provides visual feedback and disabled states based on step status.
 */

import React from 'react';
import { Loader2, Check, AlertCircle, Play } from 'lucide-react';
import { StepStatus } from '@/types/orderPreparation';

interface StepButtonProps {
  status: StepStatus;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  completedLabel?: string;
  className?: string;
}

export const StepButton: React.FC<StepButtonProps> = ({
  status,
  onClick,
  disabled = false,
  label = 'Run Step',
  completedLabel = 'Completed',
  className = ''
}) => {
  // Determine button state
  const isRunning = status === 'running';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isDisabled = disabled || isRunning || isCompleted;

  // Button styles based on status
  const getButtonStyles = () => {
    if (isCompleted) {
      return 'bg-green-600 text-white cursor-default hover:bg-green-600';
    }
    if (isFailed) {
      return 'bg-red-600 text-white hover:bg-red-700';
    }
    if (isDisabled) {
      return 'bg-gray-300 text-gray-500 cursor-not-allowed';
    }
    return 'bg-blue-600 text-white hover:bg-blue-700';
  };

  // Button icon based on status
  const getButtonIcon = () => {
    if (isRunning) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    if (isCompleted) {
      return <Check className="w-4 h-4" />;
    }
    if (isFailed) {
      return <AlertCircle className="w-4 h-4" />;
    }
    return <Play className="w-4 h-4" />;
  };

  // Button label based on status
  const getButtonLabel = () => {
    if (isRunning) {
      return 'Running...';
    }
    if (isCompleted) {
      return completedLabel;
    }
    if (isFailed) {
      return 'Retry';
    }
    return label;
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        flex items-center space-x-2 px-4 py-2 rounded-lg
        text-sm font-medium transition-colors
        ${getButtonStyles()}
        ${className}
      `}
    >
      {getButtonIcon()}
      <span>{getButtonLabel()}</span>
    </button>
  );
};
