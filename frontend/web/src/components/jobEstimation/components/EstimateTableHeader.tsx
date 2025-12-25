import React, { useState } from 'react';
import { FileText, ExternalLink, Mail } from 'lucide-react';

interface EstimateTableHeaderProps {
  // Workflow state
  isDraft: boolean;
  isPrepared: boolean;
  isApproved: boolean;

  // QB state
  qbEstimateId: string | null;
  qbEstimateUrl: string | null;
  qbConnected: boolean;
  qbCheckingStatus: boolean;
  qbCreatingEstimate: boolean;

  // Validation
  hasValidationErrors: boolean;
  hasEstimateData: boolean;

  // Point persons
  pointPersonsCount: number;
  onSavePointPersons: () => Promise<void>;

  // Loading states
  isPreparing: boolean;
  isSending: boolean;

  // Handlers
  onConnectQB: () => void;
  onCreateQBEstimate: () => void;
  onOpenQBEstimate: () => void;
  onPrepareEstimate: () => void;
  onOpenEmailPreview: () => void;
}

export const EstimateTableHeader: React.FC<EstimateTableHeaderProps> = ({
  isDraft,
  isPrepared,
  isApproved,
  qbEstimateId,
  qbEstimateUrl,
  qbConnected,
  qbCheckingStatus,
  qbCreatingEstimate,
  hasValidationErrors,
  hasEstimateData,
  pointPersonsCount,
  onSavePointPersons,
  isPreparing,
  isSending,
  onConnectQB,
  onCreateQBEstimate,
  onOpenQBEstimate,
  onPrepareEstimate,
  onOpenEmailPreview
}) => {
  const [isSavingPointPersons, setIsSavingPointPersons] = useState(false);

  const handleSendClick = async () => {
    // Validate point persons
    if (pointPersonsCount === 0) {
      alert('Please add at least one point person before sending');
      return;
    }

    // Save point persons first
    try {
      setIsSavingPointPersons(true);
      await onSavePointPersons();
    } catch (error) {
      console.error('Failed to auto-save point persons:', error);
      alert('Failed to save point persons. Please try again.');
      return;
    } finally {
      setIsSavingPointPersons(false);
    }

    // Open email preview modal (parent handles)
    onOpenEmailPreview();
  };

  return (
    <div className="flex items-center justify-between p-2 border-b min-w-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <h3 className="text-base font-medium text-gray-900 whitespace-nowrap">Estimate Preview</h3>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* QuickBooks Buttons - 5 workflow states */}
        {qbCheckingStatus ? (
          // State 1: Checking QB status
          <span className="text-xs text-gray-500">Checking QB...</span>
        ) : qbEstimateId && qbEstimateUrl ? (
          // State 2: QB estimate exists - show "Open in QB" and "Send to Customer"
          <>
            <button
              onClick={onOpenQBEstimate}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              title="Open this estimate in QuickBooks"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in QB
            </button>
            {!isApproved && (
              <button
                onClick={handleSendClick}
                disabled={isSending || isSavingPointPersons}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
                title="Send estimate to customer via email"
              >
                <Mail className="w-3.5 h-3.5" />
                {isSavingPointPersons ? 'Saving...' : isSending ? 'Sending...' : 'Send to Customer'}
              </button>
            )}
          </>
        ) : !qbConnected ? (
          // State 3: Not connected to QB
          <button
            onClick={onConnectQB}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            title="Connect to QuickBooks to create estimates"
          >
            <FileText className="w-3.5 h-3.5" />
            Connect to QB
          </button>
        ) : isDraft ? (
          // State 4: Connected, draft - show "Prepare to Send"
          <button
            onClick={onPrepareEstimate}
            disabled={isPreparing || hasValidationErrors || !hasEstimateData}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded whitespace-nowrap bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={hasValidationErrors ? 'Fix validation errors first' : 'Prepare estimate for sending'}
          >
            {isPreparing ? '⏳ Preparing...' : 'Prepare to Send'}
          </button>
        ) : isPrepared && !qbEstimateId ? (
          // State 5: Prepared, no QB estimate yet - show "Create QB Estimate"
          <button
            onClick={onCreateQBEstimate}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            title="Create estimate in QuickBooks"
          >
            <FileText className="w-3.5 h-3.5" />
            Create QB Estimate
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default EstimateTableHeader;
