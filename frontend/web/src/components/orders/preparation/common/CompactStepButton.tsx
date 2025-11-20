/**
 * Compact Step Button Component
 *
 * Button that visually indicates step status through color and text.
 * More compact than full StepButton component.
 */

import React from 'react';
import { Loader, CheckCircle } from 'lucide-react';
import { StepStatus } from '@/types/orderPreparation';

interface CompactStepButtonProps {
  status: StepStatus;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}

export const CompactStepButton: React.FC<CompactStepButtonProps> = ({
  status,
  onClick,
  disabled = false,
  label
}) => {
  // Button styling based on status
  const getButtonClass = () => {
    if (disabled) {
      return 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200';
    }

    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100';
      case 'running':
        return 'bg-blue-50 text-blue-700 border-blue-300 cursor-not-allowed';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100';
      default:
        return 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400';
    }
  };

  const isDisabled = disabled || status === 'running';

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        w-32 px-3 py-1.5 text-xs font-medium rounded border transition-colors
        flex items-center justify-center gap-1.5
        ${getButtonClass()}
      `}
    >
      {status === 'running' && <Loader className="w-3 h-3 animate-spin" />}
      {status === 'completed' && <CheckCircle className="w-3 h-3" />}
      <span className="truncate">{label}</span>
    </button>
  );
};
