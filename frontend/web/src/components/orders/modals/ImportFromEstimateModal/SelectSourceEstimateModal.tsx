/**
 * SelectSourceEstimateModal
 *
 * Modal for selecting which estimate to import QB descriptions from.
 * Uses 3-panel navigation (Customer > Job > Estimate Version).
 * Supports auto-navigation to a linked estimate via linkedEstimateId prop.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { jobVersioningApi } from '@/services/jobVersioningApi';
import { api } from '@/services/apiClient';
import { SelectSourceEstimateModalProps, ImportSourceEstimate } from './types';

interface Customer {
  customer_id: number;
  company_name: string;
}

interface Job {
  job_id: number;
  job_name: string;
  job_number?: string;
  customer_id: number;
  customer_name?: string;
  last_activity?: string;
  updated_at?: string;
  created_at?: string;
}

interface EstimateVersion {
  id: number;
  version_number: number;
  qb_doc_number?: string;
  status?: string;
  total_amount?: number;
  notes?: string;
  is_active?: number;
  is_prepared?: number;
  uses_preparation_table?: number;
  has_qb_data?: boolean | number;
}

const ALL_CUSTOMERS_ID = -1;

export const SelectSourceEstimateModal: React.FC<SelectSourceEstimateModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  linkedEstimateId
}) => {
  // Customer state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(ALL_CUSTOMERS_ID);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Job state
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Version state
  const [versions, setVersions] = useState<EstimateVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  // Error state
  const [loadError, setLoadError] = useState<string | null>(null);

  // Refs to track whether operations have been attempted (prevents re-render loops)
  const autoNavigateAttemptedRef = useRef(false);
  const initialLoadAttemptedRef = useRef(false);
  const loadingVersionsForJobRef = useRef<number | null>(null);

  // Load initial data function (extracted for retry capability)
  const loadInitialData = useCallback(async (isRetry = false) => {
    // Skip if already attempted (unless this is a manual retry)
    if (initialLoadAttemptedRef.current && !isRetry) {
      return;
    }
    initialLoadAttemptedRef.current = true;

    setLoadingCustomers(true);
    setLoadingJobs(true);
    setLoadError(null);

    try {
      // Load customers
      const customerResponse = await api.get('/customers?limit=1000');
      const customerList = customerResponse.data.customers || [];
      setCustomers(customerList);
      setFilteredCustomers(customerList);

      // Load all jobs for "All Customers" mode
      const jobsResponse = await jobVersioningApi.getAllJobsWithActivity();
      const jobsData = Array.isArray(jobsResponse) ? jobsResponse : (jobsResponse.data || []);

      // Sort by last activity/modified, newest first
      const sortedJobs = [...jobsData].sort((a: Job, b: Job) => {
        const dateA = new Date(a.last_activity || a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.last_activity || b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setAllJobs(sortedJobs);
      setJobs(sortedJobs);
      setFilteredJobs(sortedJobs);
    } catch (error: unknown) {
      console.error('Error loading initial data:', error);
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 429) {
        setLoadError('Too many requests. Please wait a moment and try again.');
      } else {
        setLoadError('Failed to load data. Please try again.');
      }
    } finally {
      setLoadingCustomers(false);
      setLoadingJobs(false);
    }
  }, []);

  // Load customers and all jobs on mount
  useEffect(() => {
    if (!isOpen) {
      // Reset refs when modal closes so next open will load fresh
      autoNavigateAttemptedRef.current = false;
      initialLoadAttemptedRef.current = false;
      loadingVersionsForJobRef.current = null;
      return;
    }

    loadInitialData();
  }, [isOpen, loadInitialData]);

  // Auto-navigate to linked estimate if provided
  useEffect(() => {
    // Use ref to prevent re-triggering (no state in dependency array = no loop)
    if (!isOpen || !linkedEstimateId || allJobs.length === 0 || autoNavigateAttemptedRef.current) return;

    const autoNavigate = async () => {
      autoNavigateAttemptedRef.current = true;
      try {
        // Fetch estimate details to get job_id
        const response = await api.get(`/job-estimation/estimates/${linkedEstimateId}`);
        const estimate = response.data;

        if (estimate && estimate.job_id) {
          const job = allJobs.find((j: Job) => j.job_id === estimate.job_id);
          if (job) {
            // Set customer
            if (job.customer_id) {
              setSelectedCustomerId(job.customer_id);
              const customerJobs = allJobs.filter((j: Job) => j.customer_id === job.customer_id);
              setJobs(customerJobs);
              setFilteredJobs(customerJobs);
            }
            // Set job
            setSelectedJobId(job.job_id);
          }
        }
      } catch (error: unknown) {
        console.error('Error auto-navigating to linked estimate:', error);
        // Don't set loadError here - user can still manually navigate
      }
    };

    autoNavigate();
  }, [isOpen, linkedEstimateId, allJobs]);

  // Filter customers by search
  useEffect(() => {
    if (!customerSearch.trim()) {
      setFilteredCustomers(customers);
    } else {
      const search = customerSearch.toLowerCase();
      setFilteredCustomers(
        customers.filter(c => c.company_name.toLowerCase().includes(search))
      );
    }
  }, [customerSearch, customers]);

  // Filter/load jobs when customer changes
  useEffect(() => {
    if (selectedCustomerId === ALL_CUSTOMERS_ID) {
      setJobs(allJobs);
      setFilteredJobs(allJobs);
    } else {
      const customerJobs = allJobs.filter(j => j.customer_id === selectedCustomerId);
      setJobs(customerJobs);
      setFilteredJobs(customerJobs);
    }
    setJobSearch('');
  }, [selectedCustomerId, allJobs]);

  // Filter jobs by search
  useEffect(() => {
    if (!jobSearch.trim()) {
      setFilteredJobs(jobs);
    } else {
      const search = jobSearch.toLowerCase();
      setFilteredJobs(
        jobs.filter(j => j.job_name.toLowerCase().includes(search))
      );
    }
  }, [jobSearch, jobs]);

  // Load versions when job selected
  const loadVersions = useCallback(async (jobId: number, isRetry = false) => {
    // Prevent duplicate calls for the same job (unless retry)
    if (loadingVersionsForJobRef.current === jobId && !isRetry) {
      return;
    }
    loadingVersionsForJobRef.current = jobId;

    setLoadingVersions(true);
    setVersionsError(null);
    try {
      const response = await jobVersioningApi.getEstimateVersions(jobId);
      const versionsData = Array.isArray(response) ? response : (response.data || []);

      // Filter to active versions with preparation table data OR sent status
      const validVersions = versionsData.filter((v: EstimateVersion) =>
        v.is_active !== 0 &&
        (v.uses_preparation_table === 1 || v.status === 'sent')
      );

      setVersions(validVersions);
    } catch (error: unknown) {
      console.error('Error loading versions:', error);
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 429) {
        setVersionsError('Too many requests. Click to retry.');
      } else {
        setVersionsError('Failed to load versions. Click to retry.');
      }
    } finally {
      setLoadingVersions(false);
      // Clear the ref after completion so a different job can be loaded
      if (loadingVersionsForJobRef.current === jobId) {
        loadingVersionsForJobRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setVersions([]);
      setVersionsError(null);
      loadingVersionsForJobRef.current = null;
      return;
    }

    loadVersions(selectedJobId);
  }, [selectedJobId, loadVersions]);

  // Handle customer selection
  const handleCustomerSelect = useCallback((customerId: number) => {
    setSelectedCustomerId(customerId);
    setSelectedJobId(null);
    setVersions([]);
  }, []);

  // Handle job selection
  const handleJobSelect = useCallback((jobIdToSelect: number) => {
    setSelectedJobId(jobIdToSelect);
  }, []);

  // Handle version selection
  const handleVersionSelect = useCallback((version: EstimateVersion) => {
    const selectedJob = jobs.find(j => j.job_id === selectedJobId);
    const selectedCustomer = selectedCustomerId === ALL_CUSTOMERS_ID
      ? customers.find(c => c.customer_id === selectedJob?.customer_id)
      : customers.find(c => c.customer_id === selectedCustomerId);

    if (selectedJob) {
      const estimate: ImportSourceEstimate = {
        id: version.id,
        job_id: selectedJobId!,
        job_name: selectedJob.job_name,
        customer_name: selectedCustomer?.company_name || 'Unknown',
        version_number: version.version_number,
        qb_doc_number: version.qb_doc_number || null,
        status: version.status || 'draft'
      };

      onSelect(estimate);
      onClose();
    }
  }, [jobs, customers, selectedJobId, selectedCustomerId, onSelect, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Select Source Estimate
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Error Banner */}
        {loadError && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700">{loadError}</p>
            </div>
            <button
              onClick={() => loadInitialData(true)}
              disabled={loadingCustomers || loadingJobs}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-700 hover:bg-red-100 rounded disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCustomers || loadingJobs ? 'animate-spin' : ''}`} />
              Retry
            </button>
          </div>
        )}

        {/* 3-Panel Navigation */}
        <div className="flex flex-1 min-h-0" style={{ height: '400px' }}>
          {/* Customer Column */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <div className="text-xs font-medium text-gray-600 mb-2">Customer</div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {/* All Customers option */}
                  <button
                    onClick={() => handleCustomerSelect(ALL_CUSTOMERS_ID)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 ${
                      selectedCustomerId === ALL_CUSTOMERS_ID ? 'bg-blue-50 text-blue-700 font-medium' : ''
                    }`}
                  >
                    <span>All Customers</span>
                    {selectedCustomerId === ALL_CUSTOMERS_ID && (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                  </button>
                  <div className="border-t border-gray-100" />
                  {filteredCustomers.map(customer => (
                    <button
                      key={customer.customer_id}
                      onClick={() => handleCustomerSelect(customer.customer_id)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 ${
                        selectedCustomerId === customer.customer_id ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <span className="truncate">{customer.company_name}</span>
                      {selectedCustomerId === customer.customer_id && (
                        <ChevronRight className="w-4 h-4 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Job Column */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <div className="text-xs font-medium text-gray-600 mb-2">Job</div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  No jobs found
                </div>
              ) : (
                filteredJobs.map(job => (
                  <button
                    key={job.job_id}
                    onClick={() => handleJobSelect(job.job_id)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 ${
                      selectedJobId === job.job_id ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{job.job_name}</div>
                      {selectedCustomerId === ALL_CUSTOMERS_ID && job.customer_name && (
                        <div className="truncate text-gray-400 text-xs">{job.customer_name}</div>
                      )}
                    </div>
                    {selectedJobId === job.job_id && (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Version Column */}
          <div className="w-1/3 flex flex-col">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <div className="text-xs font-medium text-gray-600">Estimate Version</div>
              <div className="text-xs text-gray-400 mt-1">Prepared or sent estimates shown</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!selectedJobId ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  Select a job first
                </div>
              ) : loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : versionsError ? (
                <div className="text-center py-8 px-4">
                  <div className="text-sm text-red-600 mb-2">{versionsError}</div>
                  <button
                    onClick={() => selectedJobId && loadVersions(selectedJobId, true)}
                    className="flex items-center gap-1 mx-auto px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8 px-4">
                  No prepared or sent versions available
                </div>
              ) : (
                versions.map(version => (
                  <button
                    key={version.id}
                    onClick={() => handleVersionSelect(version)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 ${
                      linkedEstimateId === version.id ? 'bg-blue-50 border-l-2 border-l-blue-400' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Version {version.version_number}</span>
                        {version.notes && (
                          <span className="text-gray-500">- {version.notes}</span>
                        )}
                      </div>
                      {version.qb_doc_number && (
                        <span className="text-xs text-gray-400">{version.qb_doc_number}</span>
                      )}
                    </div>
                    <div className="flex items-center mt-1 gap-2">
                      {version.status && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          version.status === 'approved' ? 'bg-green-100 text-green-700' :
                          version.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {version.status}
                        </span>
                      )}
                      {linkedEstimateId === version.id && (
                        <span className="text-xs text-blue-600 font-medium">(Linked)</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            Select an estimate version to import QB descriptions from
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
