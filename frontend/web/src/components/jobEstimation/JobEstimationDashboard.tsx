import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Plus, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GridJobBuilderRefactored from './GridJobBuilderRefactored';
import { EstimateTable } from './EstimateTable';
import { CustomerPanel } from './CustomerPanel';
import { JobPanel } from './JobPanel';
import { VersionManager } from './VersionManager';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { jobVersioningApi, customerApi, provincesApi } from '../../services/api';
import { EstimateVersion } from './types';
import { getEstimateStatusText } from './utils/statusUtils';
import type { GridRowWithCalculations } from './core/types/LayerTypes';
import { ValidationResultsManager } from './core/validation/ValidationResultsManager';
import { createCalculationOperations, EstimatePreviewData } from './core/layers/CalculationLayer';
import { PricingCalculationContext } from './core/types/GridTypes';
import './JobEstimation.css';

interface JobEstimationDashboardProps {
  user: any;
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
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string | null>(null);

  // NEW: Complete customer context
  const [cashCustomer, setCashCustomer] = useState<boolean>(false);
  const [taxRate, setTaxRate] = useState<number>(0.13);

  // Validation state
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const [validationErrorCount, setValidationErrorCount] = useState(0);

  // Validation results and price calculation state
  const [pricingContext, setPricingContext] = useState<PricingCalculationContext | null>(null);
  const [estimatePreviewData, setEstimatePreviewData] = useState<EstimatePreviewData | null>(null);

  // Navigation guard from GridJobBuilder
  const [navigationGuard, setNavigationGuard] = useState<((fn: () => void) => void) | null>(null);

  // Cross-component hover state for row highlighting
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

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

  // Reusable function to reload complete customer data (name, cash flag, tax rate)
  // Used by: handleCustomerSelected, breadcrumb navigation, handleVersionSelected, handleNavigateToEstimate
  const reloadCustomerData = useCallback(async (customerId: number) => {
    try {
      const customer = await customerApi.getCustomer(customerId);
      setCustomerName(customer.company_name || null);
      setCashCustomer(customer.cash_yes_or_no === 1);

      // Get tax rate from billing address (or primary as fallback)
      const billingAddress = customer.addresses?.find((a: any) => a.is_billing);
      const addressToUse = billingAddress || customer.addresses?.find((a: any) => a.is_primary);

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

    // Get complete customer data for display and pricing
    if (customerId) {
      await reloadCustomerData(customerId);
    } else {
      // Clear customer data when deselected
      setCustomerName(null);
      setCashCustomer(false);
      setTaxRate(1.0); // 100% = ERROR: no customer
    }
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
        // If we're in "All Customers" mode (selectedCustomerId is null) but the estimate has a customer,
        // we need to load that customer's data
        const estimateCustomerId = estimate.customer_id ?? selectedCustomerId ?? null;
        if (estimateCustomerId && !selectedCustomerId) {
          setSelectedCustomerId(estimateCustomerId);
          await reloadCustomerData(estimateCustomerId);
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

  const handleNavigateToEstimate = async (jobId: number, estimateId: number) => {
    try {
      // Set the job as selected
      setSelectedJobId(jobId);

      // Get job name for display
      const jobsResponse = await jobVersioningApi.getAllJobsWithActivity();
      const job = jobsResponse.data?.find((j: any) => j.job_id === jobId);
      if (job) {
        setJobName(job.job_name);
      }

      // Get customer info and tax rate using reusable function
      if (job?.customer_id) {
        setSelectedCustomerId(job.customer_id);
        await reloadCustomerData(job.customer_id);
      }

      // Load the specific estimate version
      const versionsResponse = await jobVersioningApi.getEstimateVersions(jobId);
      const estimate = versionsResponse.data?.find((v: any) => v.id === estimateId);

      if (estimate) {
        setSelectedEstimateId(estimateId);
        setCurrentEstimate({
          ...estimate,
          customer_id: estimate.customer_id ?? job?.customer_id ?? selectedCustomerId ?? null
        });
        setIsInBuilderMode(true);
      }
    } catch (error) {
      console.error('Error navigating to estimate:', error);
    }
  };

  /**
   * Temporary notification handler - logs to console
   * NOTE: Replace with proper toast notification system when implementing UI notifications
   * Expected integration: React Toast library or custom notification component
   */
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    console.log(`[${type}] ${message}`);
  };
  
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
            customerName={customerName || undefined}
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
                // Keep: selectedCustomerId, customerName, selectedJobId, jobName (preserve customer + job)
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
                // Keep: selectedCustomerId, customerName, selectedJobId, jobName (preserve all)
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
                  customerName={customerName}
                  cashCustomer={cashCustomer}
                  taxRate={taxRate}
                  versioningMode={true}
                  estimateId={selectedEstimateId}
                  onNavigateToEstimate={handleNavigateToEstimate}
                  onValidationChange={handleValidationChange}
                  onRequestNavigation={setNavigationGuard}
                  hoveredRowId={hoveredRowId}
                  onRowHover={setHoveredRowId}
                />
              </div>
              <div className="estimate-builder-preview-wrapper">
                <EstimateTable
                  estimate={currentEstimate}
                  showNotification={showNotification}
                  hasValidationErrors={hasValidationErrors}
                  validationErrorCount={validationErrorCount}
                  estimatePreviewData={estimatePreviewData}
                  hoveredRowId={hoveredRowId}
                  onRowHover={setHoveredRowId}
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
    <div className="min-h-screen bg-gray-50">
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
    </div>
  );
};
