/**
 * Compact Step Row Component
 *
 * Simplified linear layout for preparation steps.
 * Step number, name, description, and button in a single compact row.
 */

import React, { ReactNode } from 'react';
import { CheckCircle, Clock, AlertCircle, Loader } from 'lucide-react';
import { StepStatus } from '@/types/orderPreparation';

type MessageType = 'success' | 'info' | 'warning' | 'caution';

/**
 * Derive message type from message content for consistent coloring across all steps.
 * - success (green): ✓ prefix - completed/up-to-date
 * - caution (amber): ⚠ prefix - stale/needs attention but not failed
 * - warning (red): cancelled/failed messages
 * - info (gray): loading/checking/generating messages
 */
export function deriveMessageType(message: string): MessageType {
  if (!message) return 'info';

  // Success: checkmark prefix
  if (message.startsWith('✓')) return 'success';

  // Caution: warning symbol prefix (stale, unknown apps found)
  if (message.startsWith('⚠')) return 'caution';

  // Warning: explicit failure or cancellation
  if (message.toLowerCase().includes('cancelled') ||
      message.toLowerCase().includes('failed')) {
    return 'warning';
  }

  // Default to info (loading states, neutral messages)
  return 'info';
}

interface CompactStepRowProps {
  stepNumber: number;
  name: string;
  description: string;
  status: StepStatus;
  button: ReactNode;
  message?: string;
  messageType?: MessageType; // Optional override - auto-derived from message content if not provided
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
  messageType,
  error,
  disabled = false
}) => {
  // Auto-derive message type from content if not explicitly provided
  const effectiveMessageType = messageType ?? deriveMessageType(message || '');
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

      {/* Success/Info/Warning/Caution message - color auto-derived from message content */}
      {message && !error && (
        <div className={`mt-2 ml-9 text-xs px-2 py-1.5 rounded border ${
          effectiveMessageType === 'info'
            ? 'text-gray-700 bg-gray-50 border-gray-200'
            : effectiveMessageType === 'warning'
            ? 'text-red-700 bg-red-50 border-red-200'
            : effectiveMessageType === 'caution'
            ? 'text-amber-700 bg-amber-50 border-amber-200'
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
