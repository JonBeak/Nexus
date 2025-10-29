import { useState, useCallback } from 'react';
import { jobVersioningApi } from '../../../services/api';
import { EstimateVersion } from '../types';

interface UseEstimateNavigationParams {
  onCustomerDataReload?: (customerId: number) => Promise<void>;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

export const useEstimateNavigation = ({
  onCustomerDataReload,
  showNotification = () => {}
}: UseEstimateNavigationParams = {}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(null);
  const [currentEstimate, setCurrentEstimate] = useState<EstimateVersion | null>(null);
  const [isInBuilderMode, setIsInBuilderMode] = useState(false);
  const [jobName, setJobName] = useState<string | null>(null);

  const handleCustomerSelected = async (customerId: number | null, customerName?: string) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomerName(customerName || null);

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
        if (estimateCustomerId && onCustomerDataReload) {
          // IMPORTANT: Load customer data BEFORE setting selectedCustomerId
          // This avoids race condition where preferences hook triggers before customerPreferencesData is initialized
          await onCustomerDataReload(estimateCustomerId);
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

  const handleBackToVersions = useCallback(() => {
    setIsInBuilderMode(false);
    setCurrentEstimate(null);
  }, []);

  return {
    // State
    selectedCustomerId,
    selectedCustomerName,
    selectedJobId,
    selectedEstimateId,
    currentEstimate,
    isInBuilderMode,
    jobName,
    // Setters
    setSelectedCustomerId,
    setSelectedCustomerName,
    setSelectedJobId,
    setSelectedEstimateId,
    setCurrentEstimate,
    setIsInBuilderMode,
    setJobName,
    // Handlers
    handleCustomerSelected,
    handleJobSelected,
    handleCreateNewJob,
    handleVersionSelected,
    handleCreateNewVersion,
    handleBackToVersions
  };
};
