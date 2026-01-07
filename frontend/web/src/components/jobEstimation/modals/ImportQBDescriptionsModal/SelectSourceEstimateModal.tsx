/**
 * SelectSourceEstimateModal
 *
 * Modal for selecting which estimate to import QB descriptions from.
 * Uses 3-panel navigation (Customer > Job > Estimate Version).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, ChevronRight } from 'lucide-react';
import { jobVersioningApi } from '../../../../services/jobVersioningApi';
import { api } from '../../../../services/apiClient';
import { ImportSourceEstimate } from './types';

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
}

interface SelectSourceEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (estimate: ImportSourceEstimate) => void;
  currentEstimateId: number;
  currentJobId: number;
}

const ALL_CUSTOMERS_ID = -1;

export const SelectSourceEstimateModal: React.FC<SelectSourceEstimateModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentEstimateId,
  currentJobId
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

  // Load customers and all jobs on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadInitialData = async () => {
      setLoadingCustomers(true);
      setLoadingJobs(true);

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

        // Default to current job if provided
        if (currentJobId) {
          const currentJob = sortedJobs.find((j: Job) => j.job_id === currentJobId);
          if (currentJob) {
            setSelectedJobId(currentJobId);
            if (currentJob.customer_id) {
              setSelectedCustomerId(currentJob.customer_id);
              const customerJobs = sortedJobs.filter((j: Job) => j.customer_id === currentJob.customer_id);
              setJobs(customerJobs);
              setFilteredJobs(customerJobs);
            }
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoadingCustomers(false);
        setLoadingJobs(false);
      }
    };

    loadInitialData();
  }, [isOpen, currentJobId]);

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
  useEffect(() => {
    if (!selectedJobId) {
      setVersions([]);
      return;
    }

    const loadVersions = async () => {
      setLoadingVersions(true);
      try {
        const response = await jobVersioningApi.getEstimateVersions(selectedJobId);
        const versionsData = Array.isArray(response) ? response : (response.data || []);

        // Filter to only active versions with preparation table data
        const validVersions = versionsData.filter((v: EstimateVersion) =>
          v.is_active !== 0 &&
          v.id !== currentEstimateId &&
          v.uses_preparation_table === 1
        );

        setVersions(validVersions);
      } catch (error) {
        console.error('Error loading versions:', error);
      } finally {
        setLoadingVersions(false);
      }
    };

    loadVersions();
  }, [selectedJobId, currentEstimateId]);

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
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
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
                      selectedCustomerId === ALL_CUSTOMERS_ID ? 'bg-green-50 text-green-700 font-medium' : ''
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
                        selectedCustomerId === customer.customer_id ? 'bg-green-50 text-green-700' : ''
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
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
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
                      selectedJobId === job.job_id ? 'bg-green-50 text-green-700' : ''
                    } ${job.job_id === currentJobId ? 'border-l-2 border-blue-400' : ''}`}
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
              <div className="text-xs text-gray-400 mt-1">Only prepared estimates shown</div>
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
              ) : versions.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8 px-4">
                  No prepared versions available
                </div>
              ) : (
                versions.map(version => (
                  <button
                    key={version.id}
                    onClick={() => handleVersionSelect(version)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 border-b border-gray-100"
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
