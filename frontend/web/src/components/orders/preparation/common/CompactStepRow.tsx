/**
 * Compact Step Row Component
 *
 * Simplified linear layout for preparation steps.
 * Step number, name, description, and button in a single compact row.
 */

import React, { ReactNode } from 'react';
import { CheckCircle, Clock, AlertCircle, Loader } from 'lucide-react';
import { StepStatus } from '@/types/orderPreparation';

interface CompactStepRowProps {
  stepNumber: number;
  name: string;
  description: string;
  status: StepStatus;
  button: ReactNode;
  message?: string;
  messageType?: 'success' | 'info' | 'warning'; // 'success' = green, 'info' = gray, 'warning' = red
  error?: string;
  disabled?: boolean;
}

export const CompactStepRow: React.FC<CompactStepRowProps> = ({
  stepNumber,
  name,
  description,
  status,
  button,
  message,
  messageType = 'success',
  error,
  disabled = false
}) => {
  // Status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'running':
        return <Loader className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className={`px-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
      {/* Main row: Number, Name/Description, Button */}
      <div className="flex items-start gap-3">
        {/* Step number + status icon */}
        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
          <span className="text-sm font-medium text-gray-700 w-4">{stepNumber}.</span>
          {getStatusIcon()}
        </div>

        {/* Name and description */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">{name}</div>
          <div className="text-xs text-gray-600 mt-0.5">{description}</div>
        </div>

        {/* Button */}
        <div className="flex-shrink-0">
          {button}
        </div>
      </div>

      {/* Success/Info/Warning message */}
      {message && !error && (
        <div className={`mt-2 ml-9 text-xs px-2 py-1.5 rounded border ${
          messageType === 'info'
            ? 'text-gray-700 bg-gray-50 border-gray-200'
            : messageType === 'warning'
            ? 'text-red-700 bg-red-50 border-red-200'
            : 'text-green-700 bg-green-50 border-green-200'
        }`}>
          {message}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 ml-9 text-xs text-red-700 bg-red-50 px-2 py-1.5 rounded border border-red-200">
          {error}
        </div>
      )}
    </div>
  );
};
