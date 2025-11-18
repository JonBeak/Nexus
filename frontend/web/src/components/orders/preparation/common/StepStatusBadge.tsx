/**
 * Step Status Badge Component
 *
 * Visual status indicator for preparation steps.
 * Shows color-coded badge with icon for pending, running, completed, and failed states.
 */

import React from 'react';
import { Clock, Loader2, Check, XCircle } from 'lucide-react';
import { StepStatus } from '@/types/orderPreparation';

interface StepStatusBadgeProps {
  status: StepStatus;
  className?: string;
}

export const StepStatusBadge: React.FC<StepStatusBadgeProps> = ({
  status,
  className = ''
}) => {
  // Badge configuration based on status
  const getBadgeConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="w-3 h-3" />,
          label: 'Pending',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-300'
        };
      case 'running':
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          label: 'Running',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-300'
        };
      case 'completed':
        return {
          icon: <Check className="w-3 h-3" />,
          label: 'Completed',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          borderColor: 'border-green-300'
        };
      case 'failed':
        return {
          icon: <XCircle className="w-3 h-3" />,
          label: 'Failed',
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          borderColor: 'border-red-300'
        };
      default:
        return {
          icon: <Clock className="w-3 h-3" />,
          label: 'Unknown',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-300'
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div
      className={`
        inline-flex items-center space-x-1.5 px-2.5 py-1
        text-xs font-medium rounded-full border
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        ${className}
      `}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
};
