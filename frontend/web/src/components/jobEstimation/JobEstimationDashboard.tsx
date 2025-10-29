import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GridJobBuilderRefactored from './GridJobBuilderRefactored';
import { EstimateTable } from './EstimateTable';
import { CustomerPanel } from './CustomerPanel';
import { JobPanel } from './JobPanel';
import { VersionManager } from './VersionManager';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { CustomerPreferencesPanel } from './CustomerPreferencesPanel';
import CustomerDetailsModal from '../customers/CustomerDetailsModal';
import { jobVersioningApi } from '../../services/api';
import { getEstimateStatusText } from './utils/statusUtils';
import { User } from '../../types';
import './JobEstimation.css';

// Custom hooks
import { useEstimateNavigation } from './hooks/useEstimateNavigation';
import { useCustomerContext } from './hooks/useCustomerContext';
import { useValidationOrchestration } from './hooks/useValidationOrchestration';
import { useQuickBooksIntegration } from './hooks/useQuickBooksIntegration';

interface JobEstimationDashboardProps {
  user: User;
}

export const JobEstimationDashboard: React.FC<JobEstimationDashboardProps> = ({ user }) => {
  const navigate = useNavigate();

  // Navigation guard from GridJobBuilder
  const [navigationGuard, setNavigationGuard] = useState<((fn: () => void) => void) | null>(null);

  // Cross-component hover state for row highlighting
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  /**
   * Temporary notification handler - logs to console
   * NOTE: Replace with proper toast notification system when implementing UI notifications
   * Expected integration: React Toast library or custom notification component
   */
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    // TODO: Implement proper toast notification system
  };

  // Customer context hook
  const {
    taxRate,
    fullCustomer,
    customerPreferencesData,
    preferencesValidationResult,
    showEditCustomerModal,
    setCustomerPreferencesData,
    setPreferencesValidationResult,
    reloadCustomerData,
    handleEditCustomer,
    handleCloseEditCustomerModal
  } = useCustomerContext();

  // Navigation hook
  const {
    selectedCustomerId,
    selectedCustomerName,
    selectedJobId,
    selectedEstimateId,
    currentEstimate,
    isInBuilderMode,
    jobName,
    setSelectedCustomerId,
    setSelectedCustomerName,
    setSelectedJobId,
    setSelectedEstimateId,
    setCurrentEstimate,
    setIsInBuilderMode,
    setJobName,
    handleCustomerSelected,
    handleJobSelected,
    handleCreateNewJob,
    handleVersionSelected: baseHandleVersionSelected,
    handleCreateNewVersion,
    handleBackToVersions
  } = useEstimateNavigation({
    onCustomerDataReload: reloadCustomerData,
    showNotification
  });

  // Validation orchestration hook
  const {
    hasValidationErrors,
    validationErrorCount,
    estimatePreviewData,
    handlePreferencesLoaded,
    handleGridDataChange,
    handleValidationChange
  } = useValidationOrchestration({
    isInBuilderMode,
    selectedEstimateId,
    isDraft: currentEstimate?.is_draft ?? false,
    customerPreferencesData,
    setCustomerPreferencesData,
    setPreferencesValidationResult
  });

  // QuickBooks integration hook
  const {
    qbConnected,
    qbCheckingStatus,
    qbCreatingEstimate,
    handleCreateQuickBooksEstimate,
    handleOpenQuickBooksEstimate,
    handleConnectToQuickBooks,
    handleDisconnectFromQuickBooks
  } = useQuickBooksIntegration({
    currentEstimate,
    estimatePreviewData,
    onEstimateUpdate: setCurrentEstimate
  });

  const handleApproveEstimate = async () => {
    if (!currentEstimate) return;

    if (!window.confirm('Mark this estimate as approved? This action can be reversed.')) {
      return;
    }

    try {
      await jobVersioningApi.approveEstimate(currentEstimate.id);

      // Update current estimate with approved flag
      setCurrentEstimate({
        ...currentEstimate,
        is_approved: true
      });

      showNotification('Estimate marked as approved', 'success');
    } catch (error) {
      console.error('Failed to approve estimate:', error);
      showNotification('Failed to approve estimate', 'error');
    }
  };

  // Dynamic viewport control - enable zoom out only in builder mode
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');

    if (viewportMeta) {
      if (isInBuilderMode) {
        // Builder mode: allow zooming out to 0.2x
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=0.5, minimum-scale=0.2, maximum-scale=5.0, user-scalable=yes');
      } else {
        // 3-panel nav mode: normal zoom (minimum 1.0)
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes');
      }
    }
  }, [isInBuilderMode]);

  // Restore original viewport when leaving the entire page
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalContent = viewportMeta?.getAttribute('content');

    return () => {
      if (viewportMeta && originalContent) {
        viewportMeta.setAttribute('content', originalContent);
      }
    };
  }, []);

  if (!user || (user.role !== 'manager' && user.role !== 'owner')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-2">Access Denied</div>
          <p className="text-gray-500 mb-4">Job Estimation is available to managers and owners only.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 text-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const render3PanelWorkflow = () => {
    // Show builder mode if estimate is selected
    if (isInBuilderMode && currentEstimate) {
      return (
        <div>
          <BreadcrumbNavigation
            customerName={customerPreferencesData?.customerName || undefined}
            jobName={jobName || undefined}
            version={`v${currentEstimate.version_number}`}
            status={getEstimateStatusText(currentEstimate)}
            onNavigateToCustomerSelection={() => {
              const navAction = () => {
                // Navigate back to customer selection (All Customers), reset everything
                setIsInBuilderMode(false);
                setSelectedEstimateId(null);
                setCurrentEstimate(null);
                setSelectedJobId(null);
                setJobName(null);
                setSelectedCustomerId(null);
                setSelectedCustomerName(null);
              };

              if (navigationGuard) {
                navigationGuard(navAction);
              } else {
                navAction();
              }
            }}
            onNavigateToJobSelection={() => {
              const navAction = () => {
                // Navigate back to job selection, preserve customer but reset job/estimate
                setIsInBuilderMode(false);
                setSelectedEstimateId(null);
                setCurrentEstimate(null);
                // Keep: selectedCustomerId, selectedJobId, jobName, customerPreferencesData (preserve customer + job context)
              };

              if (navigationGuard) {
                navigationGuard(navAction);
              } else {
                navAction();
              }
            }}
            onNavigateToVersionSelection={() => {
              const navAction = () => {
                // Navigate back to version list, preserve all parent context
                setIsInBuilderMode(false);
                setSelectedEstimateId(null);
                setCurrentEstimate(null);
                // Keep: selectedCustomerId, selectedJobId, jobName, customerPreferencesData (preserve all context)
              };

              if (navigationGuard) {
                navigationGuard(navAction);
              } else {
                navAction();
              }
            }}
          />
          {/* Unified scrollable container - breakpoint at 1650px matches content width */}
          <div className="estimate-builder-scroll-container">
            <div className="estimate-builder-layout-container">
              {/* Mobile: EstimateTable first, Desktop (≥1650px): Grid first */}
              <div className="estimate-builder-grid-wrapper">
                <GridJobBuilderRefactored
                  user={user}
                  estimate={currentEstimate}
                  isCreatingNew={false}
                  onEstimateChange={setCurrentEstimate}
                  onBackToEstimates={() => {
                    const navAction = () => navigate('/dashboard');
                    if (navigationGuard) {
                      navigationGuard(navAction);
                    } else {
                      navAction();
                    }
                  }}
                  showNotification={showNotification}
                  customerId={selectedCustomerId}
                  customerName={customerPreferencesData?.customerName || null}
                  cashCustomer={customerPreferencesData?.cashCustomer || false}
                  taxRate={taxRate}
                  versioningMode={true}
                  estimateId={selectedEstimateId}
                  onValidationChange={handleValidationChange}
                  onRequestNavigation={setNavigationGuard}
                  onPreferencesLoaded={handlePreferencesLoaded}
                  onGridDataChange={handleGridDataChange}
                  hoveredRowId={hoveredRowId}
                  onRowHover={setHoveredRowId}
                  estimatePreviewData={estimatePreviewData}
                />
              </div>
              <div className="estimate-builder-preview-wrapper">
                <CustomerPreferencesPanel
                  customerData={customerPreferencesData}
                  validationResult={preferencesValidationResult}
                  onEditCustomer={handleEditCustomer}
                />
                <EstimateTable
                  estimate={currentEstimate}
                  showNotification={showNotification}
                  hasValidationErrors={hasValidationErrors}
                  validationErrorCount={validationErrorCount}
                  estimatePreviewData={estimatePreviewData}
                  hoveredRowId={hoveredRowId}
                  onRowHover={setHoveredRowId}
                  customerName={customerPreferencesData?.customerName || null}
                  jobName={jobName}
                  version={`v${currentEstimate.version_number}`}
                  qbEstimateId={currentEstimate.qb_estimate_id}
                  qbEstimateUrl={currentEstimate.qb_estimate_id ? `https://qbo.intuit.com/app/estimate?txnId=${currentEstimate.qb_estimate_id}` : null}
                  qbCreatingEstimate={qbCreatingEstimate}
                  qbConnected={qbConnected}
                  qbCheckingStatus={qbCheckingStatus}
                  isApproved={currentEstimate.is_approved === true || currentEstimate.is_approved === 1}
                  onCreateQBEstimate={handleCreateQuickBooksEstimate}
                  onOpenQBEstimate={handleOpenQuickBooksEstimate}
                  onConnectQB={handleConnectToQuickBooks}
                  onDisconnectQB={handleDisconnectFromQuickBooks}
                  onApproveEstimate={handleApproveEstimate}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show 3-panel layout
    return (
      <div className="three-panel-container">
        <CustomerPanel
          selectedCustomerId={selectedCustomerId}
          onCustomerSelected={handleCustomerSelected}
        />
        <JobPanel
          selectedCustomerId={selectedCustomerId}
          selectedCustomerName={selectedCustomerName}
          selectedJobId={selectedJobId}
          onJobSelected={handleJobSelected}
          onCreateNewJob={handleCreateNewJob}
          user={user}
        />
        {selectedJobId && (
          <VersionManager
            jobId={selectedJobId}
            currentEstimateId={selectedEstimateId}
            onVersionSelected={baseHandleVersionSelected}
            onCreateNewVersion={handleCreateNewVersion}
            user={user}
          />
        )}
        {!selectedJobId && (
          <div className="bg-white rounded shadow-sm border border-gray-200 p-6 h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">Select a job to view versions</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${isInBuilderMode ? 'job-estimation-builder-mode' : ''}`}>
      <div className={`max-w-[1920px] mx-auto ${isInBuilderMode ? 'estimate-builder-mobile-unified' : 'p-6'}`}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                const navAction = () => navigate('/dashboard');
                if (navigationGuard) {
                  navigationGuard(navAction);
                } else {
                  navAction();
                }
              }}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Job Estimation</h1>
          </div>
        </div>

        {/* Content Area */}
        <div>
          {render3PanelWorkflow()}
        </div>
      </div>

      {/* Customer Edit Modal */}
      {showEditCustomerModal && fullCustomer && (
        <CustomerDetailsModal
          customer={fullCustomer}
          onClose={() => handleCloseEditCustomerModal(selectedCustomerId)}
        />
      )}
    </div>
  );
};
