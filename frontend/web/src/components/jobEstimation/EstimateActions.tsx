import React, { useState } from 'react';
import { 
  Save, 
  Send, 
  CheckCircle, 
  Package, 
  RotateCcw, 
  AlertTriangle, 
  Shield,
  ChevronDown,
  Clock,
  Copy
} from 'lucide-react';
import { jobVersioningApi } from '../../services/api';
import { EstimateActionsProps, EstimateFinalizationData } from './types';
import { getEstimateStatusText } from './utils/statusUtils';
import { MultipleOrdersModal } from './MultipleOrdersModal';

export const EstimateActions: React.FC<EstimateActionsProps> = ({
  estimateId,
  estimate,
  onSaveDraft,
  onFinalize,
  onStatusChange,
  onNavigateToEstimate,
  user
}) => {
  const [showFinalizeDropdown, setShowFinalizeDropdown] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState<string | null>(null);
  const [showMultipleOrdersModal, setShowMultipleOrdersModal] = useState(false);
  const [showRetractModal, setShowRetractModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [retractType, setRetractType] = useState<'internal' | 'notify'>('internal');
  const [loading, setLoading] = useState<string | null>(null);
  const [multipleOrdersLoading, setMultipleOrdersLoading] = useState(false);

  const handleSaveDraft = async () => {
    setLoading('draft');
    try {
      await jobVersioningApi.saveDraft(estimateId);
      onSaveDraft();
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleFinalize = async (status: EstimateFinalizationData['status']) => {
    setShowConfirmationModal(status);
  };

  const confirmFinalization = async () => {
    if (!showConfirmationModal) return;
    
    setLoading('finalize');
    try {
      await jobVersioningApi.finalizeEstimate(estimateId, { 
        status: showConfirmationModal as EstimateFinalizationData['status'] 
      });
      onFinalize(showConfirmationModal as EstimateFinalizationData['status']);
      setShowConfirmationModal(null);
    } catch (error) {
      console.error('Error finalizing estimate:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleStatusAction = async (action: string) => {
    setLoading(action);
    try {
      switch (action) {
        case 'send':
          await jobVersioningApi.sendEstimate(estimateId);
          break;
        case 'approve':
          await jobVersioningApi.approveEstimate(estimateId);
          break;
        case 'not-approved':
          await jobVersioningApi.markNotApproved(estimateId);
          break;
        case 'retract':
          setShowRetractModal(true);
          setLoading(null); // Reset loading since we're showing a modal
          return;
        case 'convert-order':
          await handleConvertToOrder();
          break;
      }
      onStatusChange(action);
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
    } finally {
      setLoading(null);
    }
  };

  const handleConvertToOrder = async () => {
    try {
      // Check if job already has existing orders
      const response = await jobVersioningApi.checkExistingOrders(estimate.job_id);
      
      if (response.data.has_existing_orders) {
        // Show multiple orders modal
        setShowMultipleOrdersModal(true);
      } else {
        // Proceed with normal order conversion
        await jobVersioningApi.convertToOrder(estimateId);
        onStatusChange('convert-order');
      }
    } catch (error) {
      console.error('Error checking existing orders:', error);
      
      // Check if this is a multiple orders error from backend
      if (error instanceof Error && error.message.includes('multiple orders')) {
        // Show multiple orders modal
        setShowMultipleOrdersModal(true);
      } else {
        // Try fallback conversion
        try {
          await jobVersioningApi.convertToOrder(estimateId);
          onStatusChange('convert-order');
        } catch (fallbackError) {
          console.error('Fallback conversion also failed:', fallbackError);
          if (fallbackError instanceof Error && fallbackError.message.includes('multiple orders')) {
            setShowMultipleOrdersModal(true);
          }
        }
      }
    }
  };

  const handleDuplicate = () => {
    setShowDuplicateModal(true);
  };

  const confirmDuplicate = async () => {
    setShowDuplicateModal(false);
    setLoading('duplicate');
    try {
      const response = await jobVersioningApi.duplicateEstimate(estimateId);
      
      // Navigate to the new duplicated estimate
      if (onNavigateToEstimate && response.data?.job_id && response.data?.estimate_id) {
        onNavigateToEstimate(response.data.job_id, response.data.estimate_id);
      } else {
        // Fallback to status change if navigation not available
        onStatusChange('duplicate');
      }
    } catch (error) {
      console.error('Error duplicating estimate:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleCreateAdditionalJob = async (newJobName: string) => {
    setMultipleOrdersLoading(true);
    try {
      const response = await jobVersioningApi.createAdditionalJobForOrder(
        estimate.job_id,
        estimateId,
        newJobName
      );
      
      setShowMultipleOrdersModal(false);
      onStatusChange('convert-order');
      
      // Navigate to the new draft estimate
      if (onNavigateToEstimate && response.data?.newJobId && response.data?.newEstimateId) {
        onNavigateToEstimate(response.data.newJobId, response.data.newEstimateId);
      }
      
      
    } catch (error) {
      console.error('Error creating additional job:', error);
    } finally {
      setMultipleOrdersLoading(false);
    }
  };

  const handleConfirmRetract = async () => {
    setLoading('retract');
    try {
      await jobVersioningApi.retractEstimate(estimateId);
      onStatusChange('retract');
      setShowRetractModal(false);
      
      // If notify customer was selected, show a notification about the action
      if (retractType === 'notify') {
        // NOTE: Email notifications require integration with backend email service
        // Implementation pending: Send automated email to customer about estimate retraction
        showNotification('Customer will be notified via email when email system is integrated', 'success');
      }
    } catch (error) {
      console.error('Error retracting estimate:', error);
    } finally {
      setLoading(null);
    }
  };

  const getStatusText = () => {
    return getEstimateStatusText(estimate);
  };

  const canPerformAction = (action: string) => {
    // Check permissions based on action - duplicate has more lenient permissions
    
    switch (action) {
      case 'save-draft':
        return (user.role === 'manager' || user.role === 'owner') && estimate.is_draft;
      case 'finalize':
        return (user.role === 'manager' || user.role === 'owner') && estimate.is_draft;
      case 'send':
        // Can send if: has permission AND not draft AND (never sent OR retracted OR sent but want to send again)
        return (user.role === 'manager' || user.role === 'owner') && !estimate.is_draft && (!estimate.is_sent || estimate.is_retracted || estimate.is_sent);
      case 'approve':
        // Can approve if: has permission AND not draft AND sent AND not currently approved AND not retracted
        return (user.role === 'manager' || user.role === 'owner') && !estimate.is_draft && estimate.is_sent && !estimate.is_approved && !estimate.is_retracted;
      case 'not-approved':
        // Can mark not approved if: has permission AND not draft AND currently approved AND not retracted
        return (user.role === 'manager' || user.role === 'owner') && !estimate.is_draft && estimate.is_approved && !estimate.is_retracted;
      case 'retract':
        // Can retract if: has permission AND not draft AND (sent or approved) AND not already retracted
        return (user.role === 'manager' || user.role === 'owner') && !estimate.is_draft && (estimate.is_sent || estimate.is_approved) && !estimate.is_retracted;
      case 'convert-order':
        // Can convert to order if: has permission AND not draft AND approved AND not already ordered AND not retracted
        return (user.role === 'manager' || user.role === 'owner') && !estimate.is_draft && estimate.is_approved && estimate.status !== 'ordered' && !estimate.is_retracted;
      case 'duplicate':
        // Duplicate available to more roles (designers can duplicate for reference)
        return (user.role === 'manager' || user.role === 'owner' || user.role === 'designer');
      default:
        return false;
    }
  };

  const getFinalizeOptions = () => [
    {
      value: 'sent' as const,
      label: 'Send to Customer',
      icon: Send,
      description: 'Mark as sent and make immutable',
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      value: 'approved' as const,
      label: 'Mark Approved',
      icon: CheckCircle,
      description: 'Customer approved this estimate',
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      value: 'ordered' as const,
      label: 'Convert to Order',
      icon: Package,
      description: 'Convert to production order',
      color: 'bg-purple-600 hover:bg-purple-700'
    },
    {
      value: 'deactivated' as const,
      label: 'Deactivate',
      icon: Clock,
      description: 'Deactivate this estimate',
      color: 'bg-gray-600 hover:bg-gray-700'
    }
  ];

  const getActionButtons = () => {
    if (estimate.is_draft) {
      return (
        <div className="flex items-center space-x-3">
          {/* Save Draft Button */}
          <button
            onClick={handleSaveDraft}
            disabled={loading === 'draft' || !canPerformAction('save-draft')}
            className="flex items-center space-x-2 px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" />
            <span>{loading === 'draft' ? 'Saving...' : 'Save Draft'}</span>
          </button>

          {/* Finalize Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFinalizeDropdown(!showFinalizeDropdown)}
              disabled={!canPerformAction('finalize')}
              className="flex items-center space-x-2 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
            >
              <Shield className="w-4 h-4" />
              <span>Save Final</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showFinalizeDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded shadow-lg border z-10">
                <div className="p-2">
                  {getFinalizeOptions().map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setShowFinalizeDropdown(false);
                        handleFinalize(option.value);
                      }}
                      className={`w-full text-left px-2 py-1 rounded hover:bg-gray-50 transition-colors text-sm`}
                    >
                      <div className="flex items-center space-x-3">
                        <option.icon className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="font-medium text-gray-900">{option.label}</div>
                          <div className="text-sm text-gray-500">{option.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Duplicate Button - Always available for drafts */}
          {canPerformAction('duplicate') && (
            <button
              onClick={handleDuplicate}
              disabled={loading === 'duplicate'}
              className="flex items-center space-x-2 px-2 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              <Copy className="w-4 h-4" />
              <span>{loading === 'duplicate' ? 'Duplicating...' : 'Duplicate'}</span>
            </button>
          )}
        </div>
      );
    } else {
      // Final estimate actions
      const actions = [];
      
      if (canPerformAction('send')) {
        // Use different styling for retracted estimates
        const isRetracted = estimate.is_retracted;
        const buttonClass = isRetracted 
          ? "flex items-center space-x-2 px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 text-sm"
          : "flex items-center space-x-2 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm";
        
        actions.push(
          <button
            key="send"
            onClick={() => handleStatusAction('send')}
            disabled={loading === 'send'}
            className={buttonClass}
          >
            <Send className="w-4 h-4" />
            <span>{loading === 'send' ? 'Sending...' : 'Send Again'}</span>
          </button>
        );
      }

      if (canPerformAction('approve')) {
        actions.push(
          <button
            key="approve"
            onClick={() => handleStatusAction('approve')}
            disabled={loading === 'approve'}
            className="flex items-center space-x-2 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{loading === 'approve' ? 'Approving...' : 'Mark Approved'}</span>
          </button>
        );
      }

      if (canPerformAction('not-approved')) {
        actions.push(
          <button
            key="not-approved"
            onClick={() => handleStatusAction('not-approved')}
            disabled={loading === 'not-approved'}
            className="flex items-center space-x-2 px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{loading === 'not-approved' ? 'Processing...' : 'Mark Not Approved'}</span>
          </button>
        );
      }

      if (canPerformAction('convert-order')) {
        actions.push(
          <button
            key="convert-order"
            onClick={() => handleStatusAction('convert-order')}
            disabled={loading === 'convert-order'}
            className="flex items-center space-x-2 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
          >
            <Package className="w-4 h-4" />
            <span>{loading === 'convert-order' ? 'Converting...' : 'Convert to Order'}</span>
          </button>
        );
      }

      if (canPerformAction('retract')) {
        actions.push(
          <button
            key="retract"
            onClick={() => handleStatusAction('retract')}
            disabled={loading === 'retract'}
            className="flex items-center space-x-2 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{loading === 'retract' ? 'Retracting...' : 'Retract from Customer'}</span>
          </button>
        );
      }

      // Always add duplicate button for finalized estimates
      if (canPerformAction('duplicate')) {
        actions.push(
          <button
            key="duplicate"
            onClick={handleDuplicate}
            disabled={loading === 'duplicate'}
            className="flex items-center space-x-2 px-2 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            <Copy className="w-4 h-4" />
            <span>{loading === 'duplicate' ? 'Duplicating...' : 'Duplicate'}</span>
          </button>
        );
      }

      return <div className="flex items-center space-x-2 flex-wrap">{actions}</div>;
    }
  };

  return (
    <div className="bg-white border-t p-4">
      <div className="flex items-center justify-between">
        {/* Status Display */}
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            Status: <span className="font-medium">{getStatusText()}</span>
          </div>
          
          {estimate.finalized_at && (
            <div className="text-sm text-gray-500">
              Finalized: {new Date(estimate.finalized_at).toLocaleDateString()}
              {estimate.finalized_by && ` by ${estimate.finalized_by}`}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {getActionButtons()}
      </div>

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500 mr-3" />
              <h3 className="text-lg font-semibold">Confirm Finalization</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                You are about to finalize this estimate as "{showConfirmationModal}".
              </p>
              <p className="text-sm text-gray-500">
                <strong>Warning:</strong> Once finalized, this estimate cannot be edited. 
                All changes will require creating a new version.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmationModal(null)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmFinalization}
                disabled={loading === 'finalize'}
                className="flex-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading === 'finalize' ? 'Finalizing...' : 'Confirm Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Orders Modal */}
      <MultipleOrdersModal
        isOpen={showMultipleOrdersModal}
        onClose={() => setShowMultipleOrdersModal(false)}
        onConfirm={handleCreateAdditionalJob}
        originalJobName={estimate.job_name}
        originalJobNumber={estimate.job_number}
        estimateVersion={estimate.version_number}
        jobId={estimate.job_id}
        loading={multipleOrdersLoading}
      />

      {/* Retract Confirmation Modal */}
      {showRetractModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500 mr-3" />
              <h3 className="text-lg font-semibold">Confirm Retraction</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                You are about to retract this estimate from the customer.
              </p>
              
              {/* Retract Options */}
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="internal-only"
                    name="retractType"
                    value="internal"
                    checked={retractType === 'internal'}
                    onChange={(e) => setRetractType(e.target.value as 'internal' | 'notify')}
                    className="mr-2"
                  />
                  <label htmlFor="internal-only" className="text-sm text-gray-700">
                    <strong>Internal retraction only</strong> - Update status but don't notify customer
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="notify-customer"
                    name="retractType"
                    value="notify"
                    checked={retractType === 'notify'}
                    onChange={(e) => setRetractType(e.target.value as 'internal' | 'notify')}
                    className="mr-2"
                  />
                  <label htmlFor="notify-customer" className="text-sm text-gray-700">
                    <strong>Retract and notify customer</strong> - Send retraction notification
                  </label>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowRetractModal(false)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRetract}
                disabled={loading === 'retract'}
                className="flex-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading === 'retract' ? 'Retracting...' : 'Confirm Retract'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <Copy className="w-6 h-6 text-purple-500 mr-3" />
              <h3 className="text-lg font-semibold">Duplicate Estimate</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to duplicate this estimate?
              </p>
              <p className="text-sm text-gray-500">
                This will create a new draft version that you can edit independently. 
                You'll be navigated to the new duplicate automatically.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDuplicate}
                disabled={loading === 'duplicate'}
                className="flex-1 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {loading === 'duplicate' ? 'Duplicating...' : 'Duplicate Estimate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showFinalizeDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowFinalizeDropdown(false)}
        />
      )}
    </div>
  );
};