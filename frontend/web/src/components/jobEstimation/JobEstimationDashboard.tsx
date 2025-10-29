import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Plus, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GridJobBuilderRefactored from './GridJobBuilderRefactored';
import { EstimateTable } from './EstimateTable';
import { CustomerPanel } from './CustomerPanel';
import { JobPanel } from './JobPanel';
import { VersionManager } from './VersionManager';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { CustomerPreferencesPanel } from './CustomerPreferencesPanel';
import CustomerDetailsModal from '../customers/CustomerDetailsModal';
import { jobVersioningApi, customerApi, provincesApi, quickbooksApi } from '../../services/api';
import { EstimateVersion } from './types';
import { getEstimateStatusText } from './utils/statusUtils';
import type { GridRowWithCalculations } from './core/types/LayerTypes';
import { ValidationResultsManager } from './core/validation/ValidationResultsManager';
import { createCalculationOperations, EstimatePreviewData } from './core/layers/CalculationLayer';
import { PricingCalculationContext } from './core/types/GridTypes';
import { PreferencesCache, CustomerManufacturingPreferences } from './core/validation/context/useCustomerPreferences';
import { validateCustomerPreferences } from './utils/customerPreferencesValidator';
import { CustomerPreferencesData, CustomerPreferencesValidationResult } from './types/customerPreferences';
import { Customer, User } from '../../types';
import './JobEstimation.css';

interface JobEstimationDashboardProps {
  user: User;
}

type TabType = 'versioned-workflow';

export const JobEstimationDashboard: React.FC<JobEstimationDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('versioned-workflow');
  
  // 3-Panel state management
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(null);
  const [currentEstimate, setCurrentEstimate] = useState<EstimateVersion | null>(null);
  const [isInBuilderMode, setIsInBuilderMode] = useState(false);
  const [jobName, setJobName] = useState<string | null>(null);

  // Customer context (consolidated into customerPreferencesData below)
  const [taxRate, setTaxRate] = useState<number>(0.13);
  const [fullCustomer, setFullCustomer] = useState<Customer | null>(null);

  // Customer preferences - received from GridJobBuilder (single source of truth)
  const [customerPreferences, setCustomerPreferences] = useState<CustomerManufacturingPreferences | null>(null);

  // Customer preferences panel state
  const [customerPreferencesData, setCustomerPreferencesData] = useState<CustomerPreferencesData | null>(null);
  const [preferencesValidationResult, setPreferencesValidationResult] = useState<CustomerPreferencesValidationResult | null>(null);

  // Customer edit modal state
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);

  // Validation state
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const [validationErrorCount, setValidationErrorCount] = useState(0);

  // Validation results and price calculation state
  const [pricingContext, setPricingContext] = useState<PricingCalculationContext | null>(null);
  const [estimatePreviewData, setEstimatePreviewData] = useState<EstimatePreviewData | null>(null);

  // Grid data version tracking (for auto-save orchestration)
  const [gridDataVersion, setGridDataVersion] = useState(0);

  // Navigation guard from GridJobBuilder
  const [navigationGuard, setNavigationGuard] = useState<((fn: () => void) => void) | null>(null);

  // Cross-component hover state for row highlighting
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  // QuickBooks integration state
  const [qbConnected, setQbConnected] = useState(false);
  const [qbRealmId, setQbRealmId] = useState<string | null>(null);
  const [qbCheckingStatus, setQbCheckingStatus] = useState(true);
  const [qbCreatingEstimate, setQbCreatingEstimate] = useState(false);


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

  // Check QuickBooks connection status on mount
  useEffect(() => {
    checkQBConnectionStatus();
  }, []);

  const checkQBConnectionStatus = async () => {
    try {
      setQbCheckingStatus(true);
      const status = await quickbooksApi.getStatus();
      setQbConnected(status.connected);
      setQbRealmId(status.realmId || null);
    } catch (error) {
      console.error('Error checking QB status:', error);
      setQbConnected(false);
    } finally {
      setQbCheckingStatus(false);
    }
  };

  // Reusable function to reload complete customer data (name, cash flag, tax rate, discount, turnaround)
  // Used by: breadcrumb navigation, handleVersionSelected
  const reloadCustomerData = useCallback(async (customerId: number) => {
    try {
      const customer = await customerApi.getCustomer(customerId);
      setFullCustomer(customer);

      // Get tax rate from billing address (or primary as fallback)
      const billingAddress = customer.addresses?.find((a: any) => a.is_billing);
      const addressToUse = billingAddress || customer.addresses?.find((a: any) => a.is_primary);

      // Extract postal code from primary address
      const primaryAddress = customer.addresses?.find((a: any) => a.is_primary);
      const postalCode = primaryAddress?.postal_zip;

      if (!addressToUse) {
        setTaxRate(1.0); // 100% = ERROR: no billing or primary address
      } else if (addressToUse.tax_override_percent != null) {
        setTaxRate(addressToUse.tax_override_percent);
      } else if (addressToUse.province_state_short) {
        const taxInfo = await provincesApi.getTaxInfo(addressToUse.province_state_short);
        setTaxRate(taxInfo?.tax_percent ?? 1.0); // 100% = ERROR: lookup failed
      } else {
        setTaxRate(1.0); // 100% = ERROR: no province
      }

      // Build customer preferences data for panel
      // Note: preferences will be populated by GridJobBuilder via handlePreferencesLoaded callback
      setCustomerPreferencesData({
        customerId: customer.customer_id,
        customerName: customer.company_name || '',
        cashCustomer: customer.cash_yes_or_no === 1,
        discount: customer.discount,
        defaultTurnaround: customer.default_turnaround,
        postalCode: postalCode,
        preferences: null // Will be set by GridJobBuilder callback to avoid stale data
      });
    } catch (error) {
      console.error('Error fetching customer data:', error);
      setTaxRate(1.0); // 100% = ERROR
    }
  }, []); // Empty deps - only uses stable state setters and external APIs

  // 3-Panel handlers
  const handleCustomerSelected = async (customerId: number | null) => {
    setSelectedCustomerId(customerId);

    // Reset downstream selections if customer changes
    if (customerId !== selectedCustomerId) {
      setSelectedJobId(null);
      setSelectedEstimateId(null);
      setCurrentEstimate(null);
      setIsInBuilderMode(false);
    }

    // Note: Customer data loading removed - only loads when estimate is opened for editing
    // This keeps 3-panel navigation lightweight (just filtering, no data loading)
  };

  const handleJobSelected = async (jobId: number) => {
    setSelectedJobId(jobId);
    
    // Reset downstream selections
    setSelectedEstimateId(null);
    setCurrentEstimate(null);
    setIsInBuilderMode(false);
    
    // Get job name for display
    try {
      const response = await jobVersioningApi.getJobDetails(jobId);
      setJobName(response.data?.job_name || null);
    } catch (error) {
      console.error('Error fetching job name:', error);
    }
  };

  const handleCreateNewJob = async (jobName: string) => {
    if (!selectedCustomerId) return;
    
    try {
      const response = await jobVersioningApi.createJob({
        customer_id: selectedCustomerId,
        job_name: jobName
      });
      
      // Select the newly created job
      await handleJobSelected(response.data.job_id);
      showNotification('Job created successfully');
    } catch (error) {
      console.error('Error creating job:', error);
      showNotification('Failed to create job', 'error');
      throw error;
    }
  };

  const handleVersionSelected = async (estimateId: number) => {
    try {
      // Load the estimate version details
      const versions = await jobVersioningApi.getEstimateVersions(selectedJobId!);
      const estimate = versions.data?.find((v: EstimateVersion) => v.id === estimateId);

      if (estimate) {
        const estimateCustomerId = estimate.customer_id ?? selectedCustomerId ?? null;

        // ALWAYS load customer context when opening estimate for editing
        // This ensures consistent behavior regardless of navigation path
        if (estimateCustomerId) {
          // IMPORTANT: Load customer data BEFORE setting selectedCustomerId
          // This avoids race condition where preferences hook triggers before customerPreferencesData is initialized
          await reloadCustomerData(estimateCustomerId);
          setSelectedCustomerId(estimateCustomerId);
        }

        setSelectedEstimateId(estimateId);
        setCurrentEstimate({
          ...estimate,
          customer_id: estimateCustomerId
        });
        setIsInBuilderMode(true);
      }
    } catch (error) {
      console.error('Error loading estimate version:', error);
      showNotification('Failed to load estimate version', 'error');
    }
  };

  const handleCreateNewVersion = async (parentId?: number) => {
    if (!selectedJobId) return;
    
    try {
      const response = await jobVersioningApi.createEstimateVersion(
        selectedJobId,
        parentId ? { parent_estimate_id: parentId } : {}
      );
      
      // Automatically select the new version
      await handleVersionSelected(response.data.estimate_id);
      showNotification('New version created successfully');
    } catch (error) {
      console.error('Error creating new version:', error);
      showNotification('Failed to create new version', 'error');
    }
  };

  const handleBackToVersions = () => {
    setIsInBuilderMode(false);
    setCurrentEstimate(null);
  };


  /**
   * Temporary notification handler - logs to console
   * NOTE: Replace with proper toast notification system when implementing UI notifications
   * Expected integration: React Toast library or custom notification component
   */
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    // TODO: Implement proper toast notification system
  };

  // Handle opening customer edit modal
  const handleEditCustomer = () => {
    setShowEditCustomerModal(true);
  };

  // Handle closing customer edit modal and refresh data
  const handleCloseEditCustomerModal = async () => {
    setShowEditCustomerModal(false);

    // Refresh customer data and preferences
    if (selectedCustomerId) {
      // Clear preferences cache to force fresh fetch
      PreferencesCache.clearCustomer(selectedCustomerId);

      // Reload customer data
      await reloadCustomerData(selectedCustomerId);

      // Note: Preferences will be refetched automatically by GridJobBuilder's hook
      // due to the cache clear above. This will trigger re-validation via the callback.
    }
  };

  // Handle preferences loaded from GridJobBuilder (single source of truth)
  const handlePreferencesLoaded = useCallback((preferences: CustomerManufacturingPreferences | null) => {
    setCustomerPreferences(preferences);

    // Always update customerPreferencesData with new preferences using functional setState
    // This ensures preferences get set even if customerPreferencesData was temporarily null
    setCustomerPreferencesData(prev => prev ? {
      ...prev,
      preferences: preferences
    } : null);
  }, []); // Empty deps - stable callback reference, no recreations

  // Handle grid data changes from GridJobBuilder (for auto-save orchestration)
  const handleGridDataChange = useCallback((version: number) => {
    setGridDataVersion(version);
  }, []);

  // Handle validation results and trigger price calculation
  const handleValidationChange = useCallback((hasErrors: boolean, errorCount: number, context?: PricingCalculationContext) => {
    setHasValidationErrors(hasErrors);
    setValidationErrorCount(errorCount);
    setPricingContext(context || null);
  }, []);

  // Price calculation effect - triggers when validation completes
  useEffect(() => {
    const calculatePricing = async () => {
      if (pricingContext) {
        try {
          const calculationOps = createCalculationOperations();
          const calculated = await calculationOps.calculatePricing(pricingContext);
          setEstimatePreviewData(calculated);
        } catch (error) {
          console.error('Error calculating pricing:', error);
          setEstimatePreviewData(null);
        }
      } else {
        setEstimatePreviewData(null);
      }
    };

    calculatePricing();
  }, [pricingContext]);

  // Auto-save effect - triggers when BOTH grid data changes AND calculation completes
  // This eliminates race condition: save only happens after calculation finishes
  useEffect(() => {
    // Skip if not in builder mode with a draft estimate
    if (!isInBuilderMode || !selectedEstimateId || !currentEstimate?.is_draft) return;

    // Skip if no data to save
    if (!estimatePreviewData) return;

    // Skip if no grid changes yet (initial load)
    if (gridDataVersion === 0) return;

    // Debounce: Wait a bit after calculation completes before saving
    const saveTimer = setTimeout(async () => {
      try {
        // Get simplified rows from GridEngine
        const gridEngine = (window as any).gridEngineTestAccess;
        if (!gridEngine) {
          console.warn('[Dashboard] GridEngine not available for auto-save');
          return;
        }

        const coreRows = gridEngine.getRows();

        // Convert to simplified structure
        const simplifiedRows = coreRows.map((row: any) => ({
          rowType: row.rowType || 'main',
          productTypeId: row.productTypeId || null,
          productTypeName: row.productTypeName || null,
          qty: row.data?.quantity || '',
          field1: row.data?.field1 || '',
          field2: row.data?.field2 || '',
          field3: row.data?.field3 || '',
          field4: row.data?.field4 || '',
          field5: row.data?.field5 || '',
          field6: row.data?.field6 || '',
          field7: row.data?.field7 || '',
          field8: row.data?.field8 || '',
          field9: row.data?.field9 || '',
          field10: row.data?.field10 || ''
        }));

        // Save with calculated total (no race condition!)
        await jobVersioningApi.saveGridData(
          selectedEstimateId,
          simplifiedRows,
          estimatePreviewData.total
        );
      } catch (error) {
        console.error('[Dashboard] Auto-save failed:', error);
      }
    }, 300); // Small debounce after calculation completes

    return () => clearTimeout(saveTimer);
  }, [estimatePreviewData, gridDataVersion, isInBuilderMode, selectedEstimateId, currentEstimate]);

  // Run preferences validation when estimate preview data updates
  useEffect(() => {
    if (estimatePreviewData && customerPreferences) {
      const validationResult = validateCustomerPreferences(
        estimatePreviewData,
        customerPreferences,
        customerPreferencesData?.discount
      );
      setPreferencesValidationResult(validationResult);
    } else {
      setPreferencesValidationResult(null);
    }
  }, [estimatePreviewData, customerPreferences, customerPreferencesData?.discount]);

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


  // QuickBooks handlers
  const handleCreateQuickBooksEstimate = async () => {
    if (!currentEstimate || !estimatePreviewData) {
      alert('No estimate data available.');
      return;
    }

    if (!currentEstimate.is_draft) {
      alert('Only draft estimates can be sent to QuickBooks.');
      return;
    }

    if (!qbConnected) {
      alert('Not connected to QuickBooks. Please connect first.');
      return;
    }

    // Confirm finalization
    const confirmed = window.confirm(
      '⚠️ This will FINALIZE the estimate and make it IMMUTABLE.\n\n' +
      'The estimate will be locked from further edits and sent to QuickBooks.\n\n' +
      'Continue?'
    );
    if (!confirmed) return;

    try {
      setQbCreatingEstimate(true);

      const result = await quickbooksApi.createEstimate({
        estimateId: currentEstimate.id,
        estimatePreviewData: estimatePreviewData,
      });

      if (result.success && result.qbEstimateUrl) {
        // Update local state to reflect finalization
        setCurrentEstimate({
          ...currentEstimate,
          is_draft: false,
          status: 'sent',
          qb_estimate_id: result.qbEstimateId,
          qb_estimate_url: result.qbEstimateUrl,
        });

        alert(
          `✅ Success!\n\n` +
          `Estimate finalized and sent to QuickBooks.\n` +
          `QB Document #: ${result.qbDocNumber}\n\n` +
          `Opening in QuickBooks...`
        );

        // Open QB estimate in new tab
        window.open(result.qbEstimateUrl, '_blank');
      } else {
        alert(`❌ Failed to create estimate:\n\n${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error creating QB estimate:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`❌ Error creating estimate in QuickBooks:\n\n${errorMsg}`);
    } finally {
      setQbCreatingEstimate(false);
    }
  };

  const handleOpenQuickBooksEstimate = () => {
    if (currentEstimate?.qb_estimate_url) {
      window.open(currentEstimate.qb_estimate_url, '_blank');
    } else if (currentEstimate?.qb_estimate_id && qbRealmId) {
      // Build URL from ID if URL not stored (backward compatibility)
      const url = `https://qbo.intuit.com/app/estimate?txnId=${currentEstimate.qb_estimate_id}`;
      window.open(url, '_blank');
    }
  };

  const handleConnectToQuickBooks = async () => {
    try {
      // Check if credentials are configured first
      const configStatus = await quickbooksApi.getConfigStatus();

      if (!configStatus.configured) {
        alert('QuickBooks credentials not configured. Please contact administrator.');
        return;
      }

      // Open OAuth window
      await quickbooksApi.startAuth();

      // Poll for connection status (OAuth happens in popup)
      const pollInterval = setInterval(async () => {
        try {
          const status = await quickbooksApi.getStatus();
          if (status.connected) {
            setQbConnected(true);
            setQbRealmId(status.realmId || null);
            clearInterval(pollInterval);
            // Success message already shown in OAuth callback page
          }
        } catch (error) {
          console.error('Error polling QB status:', error);
        }
      }, 2000); // Check every 2 seconds

      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);

    } catch (error) {
      console.error('Error connecting to QuickBooks:', error);
      alert('Failed to connect to QuickBooks. Please try again.');
    }
  };

  const handleDisconnectFromQuickBooks = async () => {
    if (!confirm('Disconnect from QuickBooks? You will need to reconnect to create estimates.')) {
      return;
    }

    try {
      const result = await quickbooksApi.disconnect();
      if (result.success) {
        setQbConnected(false);
        setQbRealmId(null);
        alert('✅ Disconnected from QuickBooks');
      }
    } catch (error) {
      console.error('Error disconnecting from QuickBooks:', error);
      alert('Failed to disconnect. Please try again.');
    }
  };

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
              const navAction = async () => {
                // Navigate back to customer selection, reset all downstream state
                setIsInBuilderMode(false);
                setSelectedEstimateId(null);
                setCurrentEstimate(null);
                setSelectedJobId(null);
                setJobName(null);

                // Reload customer data to ensure fresh context
                if (selectedCustomerId) {
                  await reloadCustomerData(selectedCustomerId);
                }
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
          selectedJobId={selectedJobId}
          onJobSelected={handleJobSelected}
          onCreateNewJob={handleCreateNewJob}
          user={user}
        />
        {selectedJobId && (
          <VersionManager
            jobId={selectedJobId}
            currentEstimateId={selectedEstimateId}
            onVersionSelected={handleVersionSelected}
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
          onClose={handleCloseEditCustomerModal}
        />
      )}
    </div>
  );
};
