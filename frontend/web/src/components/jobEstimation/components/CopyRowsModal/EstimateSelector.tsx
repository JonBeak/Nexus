import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, ChevronRight } from 'lucide-react';
import { jobVersioningApi } from '../../../../services/jobVersioningApi';
import { api } from '../../../../services/apiClient';

export interface SelectedEstimate {
  id: number;
  job_id: number;
  version_number: number;
  qb_doc_number?: string;
  status?: string;
  total_amount?: number;
  job_name: string;
  job_number?: string;
  customer_name: string;
}

interface EstimateSelectorProps {
  onEstimateSelected: (estimate: SelectedEstimate) => void;
  currentEstimateId?: number;
}

type Tab = 'browse' | 'lookup';

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
}

interface EstimateVersion {
  id: number;
  version_number: number;
  qb_doc_number?: string;
  status?: string;
  total_amount?: number;
  notes?: string;
  is_active?: number;
}

export const EstimateSelector: React.FC<EstimateSelectorProps> = ({
  onEstimateSelected,
  currentEstimateId
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('browse');

  // Browse state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [versions, setVersions] = useState<EstimateVersion[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Lookup state
  const [lookupValue, setLookupValue] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<SelectedEstimate | null>(null);

  // Load customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const response = await api.get('/customers?limit=1000');
        // Customers API returns { customers: [...], pagination: {...} }
        if (response.data.customers) {
          setCustomers(response.data.customers);
          setFilteredCustomers(response.data.customers);
        }
      } catch (error) {
        console.error('Failed to load customers:', error);
      } finally {
        setLoadingCustomers(false);
      }
    };
    loadCustomers();
  }, []);

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

  // Load jobs when customer selected
  useEffect(() => {
    if (!selectedCustomerId) {
      setJobs([]);
      setFilteredJobs([]);
      return;
    }

    const loadJobs = async () => {
      setLoadingJobs(true);
      try {
        const response = await jobVersioningApi.getJobsByCustomer(selectedCustomerId);
        // Handle both { success, data } format and direct array format
        const jobsData = Array.isArray(response) ? response : (response.data || []);
        // Sort by last activity (same as 3-panel nav), newest first
        const sortedJobs = [...jobsData].sort((a, b) => {
          const dateA = new Date(a.last_activity || a.updated_at || a.created_at || 0).getTime();
          const dateB = new Date(b.last_activity || b.updated_at || b.created_at || 0).getTime();
          return dateB - dateA;
        });
        setJobs(sortedJobs);
        setFilteredJobs(sortedJobs);
      } catch (error) {
        console.error('[CopyRows] Failed to load jobs:', error);
      } finally {
        setLoadingJobs(false);
      }
    };
    loadJobs();
  }, [selectedCustomerId]);

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
        // Handle both { success, data } format and direct array format
        const versionsData = Array.isArray(response) ? response : (response.data || []);
        // Filter out inactive versions and current estimate
        const activeVersions = versionsData.filter((v: EstimateVersion) =>
          v.is_active !== 0 && v.id !== currentEstimateId
        );
        setVersions(activeVersions);
      } catch (error) {
        console.error('Failed to load versions:', error);
      } finally {
        setLoadingVersions(false);
      }
    };
    loadVersions();
  }, [selectedJobId, currentEstimateId]);

  const handleCustomerSelect = useCallback((customerId: number) => {
    setSelectedCustomerId(customerId);
    setSelectedJobId(null);
    setVersions([]);
    setJobSearch('');
  }, []);

  const handleJobSelect = useCallback((jobId: number) => {
    setSelectedJobId(jobId);
  }, []);

  const handleVersionSelect = useCallback((version: EstimateVersion) => {
    const selectedJob = jobs.find(j => j.job_id === selectedJobId);
    const selectedCustomer = customers.find(c => c.customer_id === selectedCustomerId);

    if (selectedJob && selectedCustomer) {
      onEstimateSelected({
        id: version.id,
        job_id: selectedJobId!,
        version_number: version.version_number,
        qb_doc_number: version.qb_doc_number,
        status: version.status,
        total_amount: version.total_amount,
        job_name: selectedJob.job_name,
        job_number: selectedJob.job_number,
        customer_name: selectedCustomer.company_name
      });
    }
  }, [jobs, customers, selectedJobId, selectedCustomerId, onEstimateSelected]);

  const handleLookup = useCallback(async () => {
    if (!lookupValue.trim()) return;

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      // Determine if it's an ID or QB doc number
      const isNumeric = /^\d+$/.test(lookupValue.trim());

      const response = await jobVersioningApi.lookupEstimate(
        isNumeric
          ? { estimateId: parseInt(lookupValue.trim()) }
          : { qbDocNumber: lookupValue.trim() }
      );

      // Handle both { success, data } format and direct object format
      const estimateData = response.data || response;

      if (estimateData && estimateData.id) {
        // Don't allow selecting current estimate
        if (estimateData.id === currentEstimateId) {
          setLookupError('Cannot copy rows from the current estimate');
          return;
        }
        setLookupResult(estimateData);
      } else {
        setLookupError('Estimate not found');
      }
    } catch (error: any) {
      setLookupError(error.response?.data?.message || 'Estimate not found');
    } finally {
      setLookupLoading(false);
    }
  }, [lookupValue, currentEstimateId]);

  const handleSelectLookupResult = useCallback(() => {
    if (lookupResult) {
      onEstimateSelected(lookupResult);
    }
  }, [lookupResult, onEstimateSelected]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-6">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'browse'
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Browse
        </button>
        <button
          onClick={() => setActiveTab('lookup')}
          className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'lookup'
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Quick Lookup
        </button>
      </div>

      {activeTab === 'browse' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Customer column */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                filteredCustomers.map(customer => (
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
                ))
              )}
            </div>
          </div>

          {/* Job column */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  disabled={!selectedCustomerId}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!selectedCustomerId ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  Select a customer
                </div>
              ) : loadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
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
                    }`}
                  >
                    <span className="truncate">{job.job_name}</span>
                    {selectedJobId === job.job_id && (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Version column */}
          <div className="w-1/3 flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-600">Versions</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!selectedJobId ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  Select a job
                </div>
              ) : loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  No versions available
                </div>
              ) : (
                versions.map(version => (
                  <button
                    key={version.id}
                    onClick={() => handleVersionSelect(version)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 hover:text-green-700 border-b border-gray-100"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <span className="font-medium flex-shrink-0">v{version.version_number}</span>
                        {version.notes && (
                          <span className="text-xs text-gray-500 truncate">{version.notes}</span>
                        )}
                      </div>
                      {version.qb_doc_number && (
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{version.qb_doc_number}</span>
                      )}
                    </div>
                    <div className="flex items-center mt-1 space-x-2">
                      {version.status && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          version.status === 'approved' ? 'bg-green-100 text-green-700' :
                          version.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {version.status}
                        </span>
                      )}
                      {version.total_amount != null && (
                        <span className="text-xs text-gray-500">
                          ${version.total_amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Quick Lookup tab */
        <div className="flex-1 p-6">
          <div className="max-w-md mx-auto">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Estimate ID or QB Doc Number
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={lookupValue}
                onChange={(e) => setLookupValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="e.g., 123 or EST-00001"
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={handleLookup}
                disabled={lookupLoading || !lookupValue.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {lookupLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
              </button>
            </div>

            {lookupError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">
                {lookupError}
              </div>
            )}

            {lookupResult && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{lookupResult.customer_name}</span>
                  {lookupResult.qb_doc_number && (
                    <span className="text-sm text-gray-500">{lookupResult.qb_doc_number}</span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {lookupResult.job_name} - v{lookupResult.version_number}
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  {lookupResult.status && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      lookupResult.status === 'approved' ? 'bg-green-100 text-green-700' :
                      lookupResult.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {lookupResult.status}
                    </span>
                  )}
                  {lookupResult.total_amount != null && (
                    <span className="text-sm text-gray-500">
                      ${lookupResult.total_amount.toLocaleString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSelectLookupResult}
                  className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Select This Estimate
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
