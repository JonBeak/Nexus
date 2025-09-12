import React, { useState, useCallback } from 'react';
import { ArrowLeft, Plus, Calculator, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GridJobBuilderRefactored } from './GridJobBuilderRefactored';
import { EstimateTable } from './EstimateTable';
import { EstimateList } from './EstimateList';
import { CustomerPanel } from './CustomerPanel';
import { JobPanel } from './JobPanel';
import { VersionManager } from './VersionManager';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { jobVersioningApi, customerApi } from '../../services/api';
import { EstimateVersion } from './types';
import { getEstimateStatusText } from './utils/statusUtils';
import './JobEstimation.css';

interface JobEstimationDashboardProps {
  user: any;
}

type TabType = 'estimates' | 'versioned-workflow' | 'builder';

export const JobEstimationDashboard: React.FC<JobEstimationDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('versioned-workflow');
  
  // Legacy estimate handling
  const [selectedEstimate, setSelectedEstimate] = useState<any>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  // 3-Panel state management
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(null);
  const [currentEstimate, setCurrentEstimate] = useState<EstimateVersion | null>(null);
  const [isInBuilderMode, setIsInBuilderMode] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string | null>(null);
  
  // Validation state
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const [validationErrorCount, setValidationErrorCount] = useState(0);
  
  // Grid rows state for assembly preview
  const [gridRows, setGridRows] = useState<any[]>([]);
  
  // Navigation guard from GridJobBuilder
  const [navigationGuard, setNavigationGuard] = useState<((fn: () => void) => void) | null>(null);
  
  const handleCreateNew = () => {
    setSelectedEstimate(null);
    setIsCreatingNew(true);
    setActiveTab('builder');
  };

  const handleEditEstimate = (estimate: any) => {
    setSelectedEstimate(estimate);
    setIsCreatingNew(false);
    setActiveTab('builder');
  };

  const handleBackToEstimates = () => {
    setActiveTab('estimates');
    setSelectedEstimate(null);
    setIsCreatingNew(false);
  };

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
    
    // Get customer name for display
    if (customerId) {
      try {
        const response = await customerApi.getCustomers({ 
          limit: 1000,
          include_inactive: false 
        });
        const customer = response.customers?.find((c: any) => c.customer_id === customerId);
        setCustomerName(customer?.company_name || null);
      } catch (error) {
        console.error('Error fetching customer name:', error);
      }
    } else {
      setCustomerName(null);
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
        setSelectedEstimateId(estimateId);
        setCurrentEstimate(estimate);
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
      
      // Get customer info
      if (job) {
        setSelectedCustomerId(job.customer_id);
        const customerResponse = await customerApi.getCustomers();
        const customer = customerResponse.data?.find((c: any) => c.customer_id === job.customer_id);
        if (customer) {
          setCustomerName(customer.company_name);
        }
      }
      
      // Load the specific estimate version
      const versionsResponse = await jobVersioningApi.getEstimateVersions(jobId);
      const estimate = versionsResponse.data?.find((v: any) => v.id === estimateId);
      
      if (estimate) {
        setSelectedEstimateId(estimateId);
        setCurrentEstimate(estimate);
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
  
  // ✅ PHASE 4 FIX: Stabilize validation callback to prevent recreation
  const handleValidationChange = useCallback((hasErrors: boolean, errorCount: number) => {
    setHasValidationErrors(hasErrors);
    setValidationErrorCount(errorCount);
  }, []);
  
  // Handle grid rows change for assembly preview
  const handleGridRowsChange = useCallback((rows: any[]) => {
    // ✅ STABILITY FIX: Only update state if rows actually changed
    setGridRows(currentRows => {
      // Compare row structure to prevent unnecessary re-renders
      if (currentRows.length !== rows.length) {
        return rows;
      }
      
      // Compare essential row properties for structural changes
      const currentStructure = currentRows.map(row => 
        `${row.id}-${row.productTypeId || 'empty'}-${row.assemblyGroup || 'none'}`
      ).join('|');
      
      const newStructure = rows.map(row => 
        `${row.id}-${row.productTypeId || 'empty'}-${row.assemblyGroup || 'none'}`
      ).join('|');
      
      if (currentStructure !== newStructure) {
        // Parent callback: Row structure changed
        return rows;
      }
      
      // No structural changes, keep current rows to prevent re-render
      return currentRows;
    });
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
        <div className="h-full">
          <BreadcrumbNavigation
            customerName={customerName || undefined}
            jobName={jobName || undefined}
            version={`v${currentEstimate.version_number}`}
            status={getEstimateStatusText(currentEstimate)}
            onNavigateToCustomerSelection={() => {
              const navAction = () => {
                // Navigate back to customer selection, reset all downstream state
                setIsInBuilderMode(false);
                setSelectedEstimateId(null);
                setCurrentEstimate(null);
                setSelectedJobId(null);
                setJobName(null);
                // Keep: selectedCustomerId, customerName (preserve customer selection)
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
          <div className="flex gap-6 h-[calc(100%-60px)] mt-4">
            <div className="flex-1 min-w-0">
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
                versioningMode={true}
                estimateId={selectedEstimateId}
                onNavigateToEstimate={handleNavigateToEstimate}
                onValidationChange={handleValidationChange}
                onGridRowsChange={handleGridRowsChange}
                onRequestNavigation={setNavigationGuard}
              />
            </div>
            <div className="w-[600px] flex-shrink-0">
              <EstimateTable
                estimate={currentEstimate}
                showNotification={showNotification}
                hasValidationErrors={hasValidationErrors}
                validationErrorCount={validationErrorCount}
                gridRows={gridRows}
                useAssemblyGroups={true}
              />
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
      <div className="max-w-[1920px] mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
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
          
          {/* Tab Selector */}
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('versioned-workflow')}
              className={`px-3 py-2 rounded font-medium text-base ${
                activeTab === 'versioned-workflow'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Versioned Workflow</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('estimates')}
              className={`px-3 py-2 rounded font-medium text-base ${
                activeTab === 'estimates'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Calculator className="w-4 h-4" />
                <span>Legacy Estimates</span>
              </div>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="h-[calc(100vh-180px)]">
          {activeTab === 'estimates' && (
            <>
              {selectedEstimate || isCreatingNew ? (
                <div className="flex gap-6 h-full">
                  <div className="flex-1 min-w-0">
                    <GridJobBuilder
                      user={user}
                      estimate={selectedEstimate}
                      isCreatingNew={isCreatingNew}
                      onEstimateChange={setSelectedEstimate}
                      onBackToEstimates={handleBackToEstimates}
                      showNotification={showNotification}
                    />
                  </div>
                  <div className="w-[600px] flex-shrink-0">
                    <EstimateTable
                      estimate={selectedEstimate}
                      showNotification={showNotification}
                      hasValidationErrors={hasValidationErrors}
                      validationErrorCount={validationErrorCount}
                    />
                  </div>
                </div>
              ) : (
                <EstimateList
                  user={user}
                  onCreateNew={handleCreateNew}
                  onEditEstimate={handleEditEstimate}
                />
              )}
            </>
          )}
          
          {activeTab === 'versioned-workflow' && render3PanelWorkflow()}
        </div>
      </div>
    </div>
  );
};