import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GridJobBuilderRefactored from './GridJobBuilderRefactored';
import { EstimateTable } from './EstimateTable';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { CustomerPreferencesPanel } from './CustomerPreferencesPanel';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { SendWorkflowPanel } from './components/SendWorkflowPanel';
import CustomerDetailsModal from '../customers/CustomerDetailsModal';
import { ApproveEstimateModal } from '../orders/modals/ApproveEstimateModal';
import { ConfirmFinalizeModal } from './modals/ConfirmFinalizeModal';
import { QBEstimateSuccessModal } from './modals/QBEstimateSuccessModal';
import { EstimateSentSuccessModal } from './modals/EstimateSentSuccessModal';
import { jobVersioningApi, customerContactsApi } from '../../services/api';
import { getEstimateStatusText } from './utils/statusUtils';
import { User } from '../../types';
import { EstimateVersion, EmailSummaryConfig, DEFAULT_EMAIL_SUMMARY_CONFIG, EstimateEmailData, DEFAULT_EMAIL_BEGINNING, DEFAULT_EMAIL_END, DEFAULT_EMAIL_SUBJECT } from './types';
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
  const [emailBeginning, setEmailBeginning] = useState(DEFAULT_EMAIL_BEGINNING);
  const [emailEnd, setEmailEnd] = useState(DEFAULT_EMAIL_END);
  const [emailSummaryConfig, setEmailSummaryConfig] = useState<EmailSummaryConfig>(DEFAULT_EMAIL_SUMMARY_CONFIG);

  // QB Description state (lifted from EstimateTable for use in QB integration)
  const [lineDescriptions, setLineDescriptions] = useState<Map<number, string>>(new Map());

  // Collapsible panel state for prepared mode (workflow expanded by default)
  const [leftPanelExpanded, setLeftPanelExpanded] = useState<'workflow' | 'grid'>('workflow');

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
    handleSendToCustomer,
    // Sent success modal
    showSentSuccessModal,
    sentSuccessData,
    handleCloseSentSuccessModal
  } = useQuickBooksIntegration({
    currentEstimate,
    estimatePreviewData,
    onEstimateUpdate: setCurrentEstimate,
    // Phase 7: Workflow data
    pointPersons,
    emailSubject,
    emailBeginning,
    emailEnd,
    emailSummaryConfig,
    lineDescriptions  // QB descriptions for items
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
            // Note: apiClient interceptor unwraps { success, data } to just the data array
            if (Array.isArray(ppResponse) && ppResponse.length > 0) {
              hasPointPersons = true;
              setPointPersons(ppResponse.map((pp: any) => ({
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
          try {
            const emailContent = await jobVersioningApi.getEstimateEmailContent(estimate.id);
            if (emailContent) {
              setEmailSubject(emailContent.email_subject || DEFAULT_EMAIL_SUBJECT);
              // Use defaults if empty
              setEmailBeginning(emailContent.email_beginning || DEFAULT_EMAIL_BEGINNING);
              setEmailEnd(emailContent.email_end || DEFAULT_EMAIL_END);
              if (emailContent.email_summary_config) {
                setEmailSummaryConfig(emailContent.email_summary_config);
              } else {
                // No saved summary config - compute dynamic default
                setEmailSummaryConfig({
                  ...DEFAULT_EMAIL_SUMMARY_CONFIG,
                  includeCustomerRef: !!estimate.customer_job_number
                });
              }
            } else {
              // No saved content - use defaults with dynamic includeCustomerRef
              setEmailSubject(DEFAULT_EMAIL_SUBJECT);
              setEmailBeginning(DEFAULT_EMAIL_BEGINNING);
              setEmailEnd(DEFAULT_EMAIL_END);
              setEmailSummaryConfig({
                ...DEFAULT_EMAIL_SUMMARY_CONFIG,
                includeCustomerRef: !!estimate.customer_job_number
              });
            }
          } catch (emailErr) {
            console.log('No email content found, using defaults');
            setEmailSubject(DEFAULT_EMAIL_SUBJECT);
            setEmailBeginning(DEFAULT_EMAIL_BEGINNING);
            setEmailEnd(DEFAULT_EMAIL_END);
            setEmailSummaryConfig({
              ...DEFAULT_EMAIL_SUMMARY_CONFIG,
              includeCustomerRef: !!estimate.customer_job_number
            });
          }

          // Load QB descriptions for items
          try {
            const descResponse = await jobVersioningApi.getEstimateLineDescriptions(estimate.id);
            if (Array.isArray(descResponse)) {
              const descMap = new Map<number, string>();
              descResponse.forEach((desc: any) => {
                if (desc.qb_description) {
                  descMap.set(desc.line_index, desc.qb_description);
                }
              });
              setLineDescriptions(descMap);
            }
          } catch (descErr) {
            console.log('No line descriptions found');
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

  // Reload QB descriptions after prepare completes (is_prepared changes to true)
  useEffect(() => {
    if (!currentEstimate?.id || !currentEstimate?.is_prepared) return;

    const reloadDescriptions = async () => {
      try {
        const descResponse = await jobVersioningApi.getEstimateLineDescriptions(currentEstimate.id);
        if (Array.isArray(descResponse)) {
          const descMap = new Map<number, string>();
          descResponse.forEach((desc: any) => {
            if (desc.qb_description) {
              descMap.set(desc.line_index, desc.qb_description);
            }
          });
          setLineDescriptions(descMap);
        }
      } catch (err) {
        console.error('Failed to reload QB descriptions:', err);
      }
    };

    reloadDescriptions();
  }, [currentEstimate?.id, currentEstimate?.is_prepared]);

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

  // Phase 7: Email and point persons change handlers with auto-save
  const emailSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleEmailChange = useCallback((
    subject: string,
    beginning: string,
    end: string,
    summaryConfig: EmailSummaryConfig
  ) => {
    setEmailSubject(subject);
    setEmailBeginning(beginning);
    setEmailEnd(end);
    setEmailSummaryConfig(summaryConfig);

    // Debounced auto-save (500ms delay to avoid excessive API calls while typing)
    if (emailSaveTimerRef.current) {
      clearTimeout(emailSaveTimerRef.current);
    }
    emailSaveTimerRef.current = setTimeout(async () => {
      if (currentEstimate?.id) {
        try {
          await jobVersioningApi.updateEstimateEmailContent(
            currentEstimate.id,
            subject,
            beginning,
            end,
            summaryConfig
          );
        } catch (err) {
          console.error('Failed to save email content:', err);
        }
      }
    }, 500);
  }, [currentEstimate?.id]);

  const handlePointPersonsChange = useCallback(async (newPointPersons: PointPersonEntry[]) => {
    setPointPersons(newPointPersons);

    // Auto-save point persons immediately (not debounced since it's triggered by discrete actions)
    if (currentEstimate?.id) {
      try {
        await jobVersioningApi.updateEstimatePointPersons(currentEstimate.id, newPointPersons);
      } catch (err) {
        console.error('Failed to save point persons:', err);
      }
    }
  }, [currentEstimate?.id]);

  // Handler for QB line description changes from EstimateTable
  const handleLineDescriptionChange = useCallback((lineIndex: number, value: string) => {
    setLineDescriptions(prev => {
      const newMap = new Map(prev);
      newMap.set(lineIndex, value);
      return newMap;
    });
  }, []);

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
          jobName={currentEstimate.customer_job_number
            ? `${currentEstimate.job_name} - ${currentEstimate.customer_job_number}`
            : currentEstimate.job_name || undefined}
          version={`v${currentEstimate.version_number}`}
          status={getEstimateStatusText(currentEstimate)}
          onNavigateToHome={handleNavigateToHome}
          onNavigateToEstimates={handleNavigateToEstimates}
          onNavigateToCustomer={handleNavigateToCustomer}
          onNavigateToJob={handleNavigateToJob}
        />

        {/* Unified scrollable container */}
        <div className="estimate-builder-scroll-container">
          {!currentEstimate.is_draft ? (
            /* PREPARED MODE: 3-section layout with collapsible panels */
            <div className="estimate-builder-layout-container estimate-prepared estimate-prepared-3col">
              {/* Section 1: Customer & Grid (collapsible) */}
              <CollapsiblePanel
                title="Customer & Grid"
                isCollapsed={leftPanelExpanded !== 'grid'}
                onToggle={() => setLeftPanelExpanded('grid')}
                side="left"
              >
                <div className="h-full flex flex-col gap-4 overflow-y-auto">
                  <CustomerPreferencesPanel
                    customerData={customerPreferencesData}
                    validationResult={preferencesValidationResult}
                    onEditCustomer={handleEditCustomer}
                  />
                  <GridJobBuilderRefactored
                    user={user}
                    estimate={currentEstimate}
                    isCreatingNew={false}
                    isReadOnly={true}
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
              </CollapsiblePanel>

              {/* Section 2: Send Workflow (collapsible) */}
              <CollapsiblePanel
                title="Send Workflow"
                isCollapsed={leftPanelExpanded !== 'workflow'}
                onToggle={() => setLeftPanelExpanded('workflow')}
                side="right"
              >
                <SendWorkflowPanel
                  customerId={currentEstimate.customer_id}
                  pointPersons={pointPersons}
                  onPointPersonsChange={handlePointPersonsChange}
                  emailSubject={emailSubject}
                  emailBeginning={emailBeginning}
                  emailEnd={emailEnd}
                  emailSummaryConfig={emailSummaryConfig}
                  estimateData={{
                    jobName: currentEstimate.job_name,
                    customerJobNumber: currentEstimate.customer_job_number,
                    qbEstimateNumber: currentEstimate.qb_doc_number,
                    subtotal: estimatePreviewData?.subtotal,
                    tax: estimatePreviewData?.taxAmount,
                    total: estimatePreviewData?.total,
                    estimateDate: currentEstimate.created_at
                  }}
                  onEmailChange={handleEmailChange}
                  isConvertedToOrder={currentEstimate.status === 'ordered'}
                />
              </CollapsiblePanel>

              {/* Section 3: Estimate Preview (always visible) */}
              <div className="estimate-builder-preview-wrapper">
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
                  // Hide send workflow in EstimateTable since it's in separate panel
                  hideSendWorkflow={true}
                  customerId={currentEstimate.customer_id}
                  pointPersons={pointPersons}
                  onPointPersonsChange={handlePointPersonsChange}
                  emailSubject={emailSubject}
                  emailBeginning={emailBeginning}
                  emailEnd={emailEnd}
                  emailSummaryConfig={emailSummaryConfig}
                  onEmailChange={handleEmailChange}
                  onPrepareEstimate={handlePrepareEstimate}
                  onSendToCustomer={handleSendToCustomer}
                  isPreparing={isPreparing}
                  isSending={isSending}
                  lineDescriptions={lineDescriptions}
                  onLineDescriptionChange={handleLineDescriptionChange}
                />
              </div>
            </div>
          ) : (
            /* DRAFT MODE: Original 2-column layout */
            <div className="estimate-builder-layout-container">
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
                  customerId={currentEstimate.customer_id}
                  pointPersons={pointPersons}
                  onPointPersonsChange={handlePointPersonsChange}
                  emailSubject={emailSubject}
                  emailBeginning={emailBeginning}
                  emailEnd={emailEnd}
                  emailSummaryConfig={emailSummaryConfig}
                  onEmailChange={handleEmailChange}
                  onPrepareEstimate={handlePrepareEstimate}
                  onSendToCustomer={handleSendToCustomer}
                  isPreparing={isPreparing}
                  isSending={isSending}
                  lineDescriptions={lineDescriptions}
                  onLineDescriptionChange={handleLineDescriptionChange}
                />
              </div>
            </div>
          )}
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
          initialCustomerJobNumber={currentEstimate.customer_job_number}
          initialPointPersons={pointPersons}
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

      {/* Estimate Sent Success Modal */}
      {sentSuccessData && (
        <EstimateSentSuccessModal
          isOpen={showSentSuccessModal}
          emailsSentTo={sentSuccessData.emailsSentTo}
          wasResent={sentSuccessData.wasResent}
          onClose={handleCloseSentSuccessModal}
        />
      )}
    </div>
  );
};
