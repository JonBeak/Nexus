import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GridJobBuilderRefactored from './GridJobBuilderRefactored';
import { EstimateTable } from './EstimateTable';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { CustomerPreferencesPanel } from './CustomerPreferencesPanel';
import CustomerDetailsModal from '../customers/CustomerDetailsModal';
import { ApproveEstimateModal } from '../orders/modals/ApproveEstimateModal';
import { ConfirmFinalizeModal } from './modals/ConfirmFinalizeModal';
import { QBEstimateSuccessModal } from './modals/QBEstimateSuccessModal';
import { jobVersioningApi, customerContactsApi } from '../../services/api';
import { getEstimateStatusText } from './utils/statusUtils';
import { User } from '../../types';
import { EstimateVersion } from './types';
import { PointPersonEntry } from './EstimatePointPersonsEditor';
import './JobEstimation.css';

// Custom hooks
import { useCustomerContext } from './hooks/useCustomerContext';
import { useValidationOrchestration } from './hooks/useValidationOrchestration';
import { useQuickBooksIntegration } from './hooks/useQuickBooksIntegration';
import { GridEngine } from './core/GridEngine';

interface EstimateEditorPageProps {
  user: User;
}

export const EstimateEditorPage: React.FC<EstimateEditorPageProps> = ({ user }) => {
  const { estimateId } = useParams<{ estimateId: string }>();
  const navigate = useNavigate();

  // Loading/error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Core estimate state loaded from API
  const [currentEstimate, setCurrentEstimate] = useState<EstimateVersion | null>(null);

  // Navigation guard from GridJobBuilder
  const [navigationGuard, setNavigationGuard] = useState<((fn: () => void) => void) | null>(null);

  // Cross-component hover state for row highlighting
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  // GridEngine reference for auto-save orchestration
  const [gridEngineRef, setGridEngineRef] = useState<GridEngine | null>(null);

  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Phase 7: Point persons and email state for workflow
  const [pointPersons, setPointPersons] = useState<PointPersonEntry[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

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

  // Validation orchestration hook
  const {
    hasValidationErrors,
    validationErrorCount,
    estimatePreviewData,
    handlePreferencesLoaded,
    handleGridDataChange,
    handleValidationChange
  } = useValidationOrchestration({
    isInBuilderMode: true,
    selectedEstimateId: currentEstimate?.id ?? null,
    isDraft: currentEstimate?.is_draft ?? false,
    customerPreferencesData,
    setCustomerPreferencesData,
    setPreferencesValidationResult,
    gridEngineRef
  });

  // QuickBooks integration hook
  const {
    qbConnected,
    qbCheckingStatus,
    qbCreatingEstimate,
    handleCreateQuickBooksEstimate,
    handleOpenQuickBooksEstimate,
    handleConnectToQuickBooks,
    handleDisconnectFromQuickBooks,
    showConfirmFinalizeModal,
    setShowConfirmFinalizeModal,
    showSuccessModal,
    setShowSuccessModal,
    successData,
    handleConfirmFinalize,
    handleOpenFromSuccessModal,
    // Phase 7: Prepare/Send workflow
    isPreparing,
    isSending,
    handlePrepareEstimate,
    handleSendToCustomer
  } = useQuickBooksIntegration({
    currentEstimate,
    estimatePreviewData,
    onEstimateUpdate: setCurrentEstimate,
    // Phase 7: Workflow data
    pointPersons,
    emailSubject,
    emailBody
  });

  // Load estimate on mount
  useEffect(() => {
    const loadEstimate = async () => {
      if (!estimateId) {
        setError('No estimate ID provided');
        setLoading(false);
        return;
      }

      try {
        const estimateIdNum = parseInt(estimateId);
        if (isNaN(estimateIdNum)) {
          setError('Invalid estimate ID');
          setLoading(false);
          return;
        }

        const response = await jobVersioningApi.getEstimateById(estimateIdNum);
        const estimate = response.data || response;
        setCurrentEstimate(estimate);

        // Load customer context
        if (estimate.customer_id) {
          await reloadCustomerData(estimate.customer_id);
        }

        // Phase 7: Load point persons if estimate exists
        if (estimate.id) {
          let hasPointPersons = false;
          try {
            const ppResponse = await jobVersioningApi.getEstimatePointPersons(estimate.id);
            if (ppResponse.success && ppResponse.data && ppResponse.data.length > 0) {
              hasPointPersons = true;
              setPointPersons(ppResponse.data.map((pp: any) => ({
                id: `existing-${pp.id}`,
                mode: pp.contact_id ? 'existing' as const : 'custom' as const,
                contact_id: pp.contact_id,
                contact_email: pp.contact_email,
                contact_name: pp.contact_name,
                contact_phone: pp.contact_phone,
                contact_role: pp.contact_role
              })));
            }
          } catch (ppErr) {
            console.log('No point persons found');
          }

          // Auto-add customer's first contact as default point person (only for drafts without saved point persons)
          if (!hasPointPersons && estimate.is_draft && estimate.customer_id) {
            try {
              const contacts = await customerContactsApi.getContacts(estimate.customer_id);
              if (contacts && contacts.length > 0) {
                const firstContact = contacts[0];
                setPointPersons([{
                  id: `new-${Date.now()}`,
                  mode: 'existing' as const,
                  contact_id: firstContact.contact_id,
                  contact_email: firstContact.contact_email,
                  contact_name: firstContact.contact_name,
                  contact_phone: firstContact.contact_phone,
                  contact_role: firstContact.contact_role
                }]);
              }
            } catch (contactErr) {
              console.log('Could not load customer contacts for default');
            }
          }

          // Load email content if prepared
          if (estimate.email_subject || estimate.email_body) {
            setEmailSubject(estimate.email_subject || '');
            setEmailBody(estimate.email_body || '');
          }
        }
      } catch (err) {
        console.error('Failed to load estimate:', err);
        setError('Estimate not found');
      } finally {
        setLoading(false);
      }
    };

    loadEstimate();
  }, [estimateId]);

  // Dynamic viewport control - enable zoom out in builder mode
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');

    if (viewportMeta) {
      // Builder mode: allow zooming out to 0.2x
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=0.5, minimum-scale=0.2, maximum-scale=5.0, user-scalable=yes');
    }

    // Cleanup: restore original viewport when leaving
    return () => {
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes');
      }
    };
  }, []);

  const handleApproveEstimate = () => {
    setShowApprovalModal(true);
  };

  const handleApprovalSuccess = (orderNumber: number) => {
    setShowApprovalModal(false);
    navigate(`/orders/${orderNumber}`);
  };

  // Phase 7: Email and point persons change handlers
  const handleEmailChange = (subject: string, body: string) => {
    setEmailSubject(subject);
    setEmailBody(body);
  };

  const handlePointPersonsChange = (newPointPersons: PointPersonEntry[]) => {
    setPointPersons(newPointPersons);
  };

  // Breadcrumb navigation handlers
  const handleNavigateToHome = () => {
    const doNavigate = () => navigate('/dashboard');
    if (navigationGuard) {
      navigationGuard(doNavigate);
    } else {
      doNavigate();
    }
  };

  const handleNavigateToEstimates = () => {
    const doNavigate = () => navigate('/estimates');
    if (navigationGuard) {
      navigationGuard(doNavigate);
    } else {
      doNavigate();
    }
  };

  const handleNavigateToCustomer = () => {
    if (!currentEstimate) return;
    const doNavigate = () => navigate(`/estimates?cid=${currentEstimate.customer_id}`);
    if (navigationGuard) {
      navigationGuard(doNavigate);
    } else {
      doNavigate();
    }
  };

  const handleNavigateToJob = () => {
    if (!currentEstimate) return;
    const doNavigate = () => navigate(`/estimates?cid=${currentEstimate.customer_id}&jid=${currentEstimate.job_id}`);
    if (navigationGuard) {
      navigationGuard(doNavigate);
    } else {
      doNavigate();
    }
  };

  // Access denied check
  if (!user || (user.role !== 'manager' && user.role !== 'owner')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-2">Access Denied</div>
          <p className="text-gray-500 mb-4">Job Estimation is available to managers and owners only.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading estimate...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !currentEstimate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-2">{error || 'Estimate not found'}</div>
          <button
            onClick={() => navigate('/estimates')}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm mt-4"
          >
            Back to Estimates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 job-estimation-builder-mode">
      <div className="max-w-[1920px] mx-auto estimate-builder-mobile-unified">
        <BreadcrumbNavigation
          customerName={customerPreferencesData?.customerName || currentEstimate.customer_name || undefined}
          jobName={currentEstimate.job_name || undefined}
          version={`v${currentEstimate.version_number}`}
          status={getEstimateStatusText(currentEstimate)}
          onNavigateToHome={handleNavigateToHome}
          onNavigateToEstimates={handleNavigateToEstimates}
          onNavigateToCustomer={handleNavigateToCustomer}
          onNavigateToJob={handleNavigateToJob}
        />

        {/* Unified scrollable container */}
        <div className="estimate-builder-scroll-container">
          <div className={`estimate-builder-layout-container ${currentEstimate.is_prepared ? 'estimate-prepared' : ''}`}>
            <div className="estimate-builder-grid-wrapper">
              <GridJobBuilderRefactored
                user={user}
                estimate={currentEstimate}
                isCreatingNew={false}
                isReadOnly={!currentEstimate.is_draft}
                onEstimateChange={setCurrentEstimate}
                onBackToEstimates={() => {
                  const navAction = () => navigate('/estimates');
                  if (navigationGuard) {
                    navigationGuard(navAction);
                  } else {
                    navAction();
                  }
                }}
                customerId={currentEstimate.customer_id}
                customerName={customerPreferencesData?.customerName || null}
                cashCustomer={customerPreferencesData?.cashCustomer || false}
                taxRate={taxRate}
                versioningMode={true}
                estimateId={currentEstimate.id}
                onValidationChange={handleValidationChange}
                onRequestNavigation={setNavigationGuard}
                onPreferencesLoaded={handlePreferencesLoaded}
                onGridDataChange={handleGridDataChange}
                onGridEngineReady={setGridEngineRef}
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
                hasValidationErrors={hasValidationErrors}
                validationErrorCount={validationErrorCount}
                estimatePreviewData={estimatePreviewData}
                hoveredRowId={hoveredRowId}
                onRowHover={setHoveredRowId}
                customerName={customerPreferencesData?.customerName || null}
                jobName={currentEstimate.job_name}
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
                // Phase 7: Point Persons and Email
                customerId={currentEstimate.customer_id}
                pointPersons={pointPersons}
                onPointPersonsChange={handlePointPersonsChange}
                emailSubject={emailSubject}
                emailBody={emailBody}
                onEmailChange={handleEmailChange}
                onPrepareEstimate={handlePrepareEstimate}
                onSendToCustomer={handleSendToCustomer}
                isPreparing={isPreparing}
                isSending={isSending}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Customer Edit Modal */}
      {showEditCustomerModal && fullCustomer && (
        <CustomerDetailsModal
          customer={fullCustomer}
          onClose={() => handleCloseEditCustomerModal(currentEstimate.customer_id)}
        />
      )}

      {/* Approve Estimate Modal */}
      {showApprovalModal && currentEstimate && estimatePreviewData && (
        <ApproveEstimateModal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          onSuccess={handleApprovalSuccess}
          estimateId={currentEstimate.id}
          estimatePreviewData={estimatePreviewData}
          defaultOrderName={currentEstimate.job_name || `Order for ${customerPreferencesData?.customerName || 'Customer'}`}
          customerId={currentEstimate.customer_id || 0}
          jobName={currentEstimate.job_name || undefined}
          estimateNotes={currentEstimate.notes || undefined}
          qbEstimateId={currentEstimate.qb_estimate_id || undefined}
        />
      )}

      {/* QuickBooks Confirm Finalize Modal */}
      <ConfirmFinalizeModal
        isOpen={showConfirmFinalizeModal}
        onConfirm={handleConfirmFinalize}
        onCancel={() => setShowConfirmFinalizeModal(false)}
      />

      {/* QuickBooks Success Modal */}
      {successData && (
        <QBEstimateSuccessModal
          isOpen={showSuccessModal}
          qbDocNumber={successData.qbDocNumber}
          qbEstimateUrl={successData.qbEstimateUrl}
          onOpenInQuickBooks={handleOpenFromSuccessModal}
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </div>
  );
};
