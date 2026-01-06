/**
 * SourceEstimatePanel
 *
 * Left column of the Import QB Descriptions modal.
 * Uses 3-panel navigation (Customer > Job > Estimate Version) like the main nav.
 * Shows draggable source rows when an estimate is selected.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Loader2, GripVertical, ChevronRight } from 'lucide-react';
import { jobVersioningApi } from '../../../../services/jobVersioningApi';
import { api } from '../../../../services/apiClient';
import {
  SourceEstimatePanelProps,
  ImportSourceEstimate,
  SourcePreparationItem,
  StagedRow,
  CopyableColumn
} from './types';

// Simple unique ID generator
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
}

// Special value for "All Customers"
const ALL_CUSTOMERS_ID = -1;

export const SourceEstimatePanel: React.FC<SourceEstimatePanelProps> = ({
  estimateId,
  jobId,
  selectedSourceId,
  onSourceSelect,
  sourceItems,
  sourceLoading,
  onStagedRowsAdd,
  defaultSelectedColumns
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

  // Row selection state for dragging
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Selected estimate info for display
  const [selectedEstimateInfo, setSelectedEstimateInfo] = useState<{
    jobName: string;
    versionNumber: number;
    customerName: string;
  } | null>(null);

  // Load customers and all jobs on mount
  useEffect(() => {
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
        if (jobId) {
          const currentJob = sortedJobs.find((j: Job) => j.job_id === jobId);
          if (currentJob) {
            setSelectedJobId(jobId);
            // Also select the customer
            if (currentJob.customer_id) {
              setSelectedCustomerId(currentJob.customer_id);
              // Filter jobs to that customer
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
  }, [jobId]);

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
      // Show all jobs sorted by last modified
      setJobs(allJobs);
      setFilteredJobs(allJobs);
    } else {
      // Filter to selected customer's jobs
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

        // Filter to only active, prepared versions, exclude current estimate
        // is_prepared indicates the estimate has been through "Prepare to Send" step
        const validVersions = versionsData.filter((v: EstimateVersion) =>
          v.is_active !== 0 &&
          v.id !== estimateId &&
          v.is_prepared === 1
        );

        setVersions(validVersions);
      } catch (error) {
        console.error('Error loading versions:', error);
      } finally {
        setLoadingVersions(false);
      }
    };

    loadVersions();
  }, [selectedJobId, estimateId]);

  // Handle customer selection
  const handleCustomerSelect = useCallback((customerId: number) => {
    setSelectedCustomerId(customerId);
    setSelectedJobId(null);
    setVersions([]);
    setSelectedIndices(new Set());
  }, []);

  // Handle job selection
  const handleJobSelect = useCallback((jobIdToSelect: number) => {
    setSelectedJobId(jobIdToSelect);
    setSelectedIndices(new Set());
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

      setSelectedEstimateInfo({
        jobName: selectedJob.job_name,
        versionNumber: version.version_number,
        customerName: selectedCustomer?.company_name || 'Unknown'
      });

      onSourceSelect(estimate);
      setSelectedIndices(new Set());
    }
  }, [jobs, customers, selectedJobId, selectedCustomerId, onSourceSelect]);

  // Handle row click (with shift/ctrl support)
  const handleRowClick = useCallback((index: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSelection = new Set(selectedIndices);
      for (let i = start; i <= end; i++) {
        newSelection.add(i);
      }
      setSelectedIndices(newSelection);
    } else if (event.ctrlKey || event.metaKey) {
      const newSelection = new Set(selectedIndices);
      if (newSelection.has(index)) {
        newSelection.delete(index);
      } else {
        newSelection.add(index);
      }
      setSelectedIndices(newSelection);
    } else {
      setSelectedIndices(new Set([index]));
    }
    setLastClickedIndex(index);
  }, [lastClickedIndex, selectedIndices]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (!selectedIndices.has(index)) {
      setSelectedIndices(new Set([index]));
    }
    setIsDragging(true);

    const indicesToDrag = selectedIndices.has(index)
      ? Array.from(selectedIndices).sort((a, b) => a - b)
      : [index];

    e.dataTransfer.setData('text/plain', JSON.stringify(indicesToDrag));
    e.dataTransfer.effectAllowed = 'copy';
  }, [selectedIndices]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle adding selected rows to staging
  const handleAddToStaging = useCallback(() => {
    if (selectedIndices.size === 0 || !selectedEstimateInfo || !selectedSourceId) return;

    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    const newStagedRows: StagedRow[] = sortedIndices.map(index => {
      const item = sourceItems[index];
      return {
        id: generateId(),
        sourceEstimateId: selectedSourceId,
        sourceEstimateName: `${selectedEstimateInfo.jobName} v${selectedEstimateInfo.versionNumber}`,
        sourceLineIndex: index,
        data: item,
        selectedCells: new Set(defaultSelectedColumns)
      };
    });

    onStagedRowsAdd(newStagedRows);
    setSelectedIndices(new Set());
  }, [selectedIndices, sourceItems, selectedSourceId, selectedEstimateInfo, defaultSelectedColumns, onStagedRowsAdd]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 3-Panel Navigation */}
      <div className="flex border-b border-gray-200" style={{ height: '200px' }}>
        {/* Customer Column */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                placeholder="Customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingCustomers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* All Customers option */}
                <button
                  onClick={() => handleCustomerSelect(ALL_CUSTOMERS_ID)}
                  className={`w-full px-2 py-1.5 text-left text-xs flex items-center justify-between hover:bg-gray-50 ${
                    selectedCustomerId === ALL_CUSTOMERS_ID ? 'bg-green-50 text-green-700 font-medium' : ''
                  }`}
                >
                  <span>All Customers</span>
                  {selectedCustomerId === ALL_CUSTOMERS_ID && (
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  )}
                </button>
                <div className="border-t border-gray-100" />
                {filteredCustomers.map(customer => (
                  <button
                    key={customer.customer_id}
                    onClick={() => handleCustomerSelect(customer.customer_id)}
                    className={`w-full px-2 py-1.5 text-left text-xs flex items-center justify-between hover:bg-gray-50 ${
                      selectedCustomerId === customer.customer_id ? 'bg-green-50 text-green-700' : ''
                    }`}
                  >
                    <span className="truncate">{customer.company_name}</span>
                    {selectedCustomerId === customer.customer_id && (
                      <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Job Column */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                placeholder="Jobs..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingJobs ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center text-gray-400 text-xs py-4">
                No jobs found
              </div>
            ) : (
              filteredJobs.map(job => (
                <button
                  key={job.job_id}
                  onClick={() => handleJobSelect(job.job_id)}
                  className={`w-full px-2 py-1.5 text-left text-xs flex items-center justify-between hover:bg-gray-50 ${
                    selectedJobId === job.job_id ? 'bg-green-50 text-green-700' : ''
                  } ${job.job_id === jobId ? 'border-l-2 border-blue-400' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{job.job_name}</div>
                    {selectedCustomerId === ALL_CUSTOMERS_ID && job.customer_name && (
                      <div className="truncate text-gray-400 text-[10px]">{job.customer_name}</div>
                    )}
                  </div>
                  {selectedJobId === job.job_id && (
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Version Column */}
        <div className="w-1/3 flex flex-col">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="text-xs font-medium text-gray-600">Versions</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedJobId ? (
              <div className="text-center text-gray-400 text-xs py-4">
                Select a job
              </div>
            ) : loadingVersions ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center text-gray-400 text-xs py-4 px-2">
                No prepared versions available to import from
              </div>
            ) : (
              versions.map(version => (
                <button
                  key={version.id}
                  onClick={() => handleVersionSelect(version)}
                  className={`w-full px-2 py-1.5 text-left text-xs hover:bg-green-50 border-b border-gray-100 ${
                    selectedSourceId === version.id ? 'bg-green-50 text-green-700' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{version.version_number}</span>
                    {version.qb_doc_number && (
                      <span className="text-[10px] text-gray-400">{version.qb_doc_number}</span>
                    )}
                  </div>
                  <div className="flex items-center mt-0.5 gap-1">
                    {version.status && (
                      <span className={`text-[10px] px-1 py-0.5 rounded ${
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

      {/* Source Rows Header */}
      {selectedSourceId && selectedEstimateInfo && (
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-xs font-medium text-gray-700">
            {selectedEstimateInfo.customerName} • {selectedEstimateInfo.jobName} v{selectedEstimateInfo.versionNumber}
          </div>
        </div>
      )}

      {/* Source Rows List */}
      <div className="flex-1 overflow-y-auto">
        {sourceLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !selectedSourceId ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Select an estimate version to view its rows
          </div>
        ) : sourceItems.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            No prepared items in this estimate
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sourceItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleRowClick(index, e)}
                onDoubleClick={handleAddToStaging}
                className={`px-3 py-2 cursor-pointer select-none ${
                  selectedIndices.has(index)
                    ? 'bg-blue-50 border-l-2 border-blue-500'
                    : 'hover:bg-gray-50'
                } ${isDragging && selectedIndices.has(index) ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="font-medium">#{index + 1}</span>
                      <span className="truncate">{item.item_name}</span>
                    </div>
                    {item.qb_description && (
                      <div className="text-sm text-gray-700 line-clamp-2">
                        {item.qb_description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>Qty: {item.quantity}</span>
                      <span>{formatCurrency(item.unit_price)}</span>
                      <span className="font-medium">{formatCurrency(item.extended_price)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Button Footer */}
      {selectedSourceId && sourceItems.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleAddToStaging}
            disabled={selectedIndices.size === 0}
            className="w-full py-2 px-3 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Add {selectedIndices.size > 0 ? `${selectedIndices.size} Row${selectedIndices.size !== 1 ? 's' : ''}` : 'Selected Rows'} to Staging
          </button>
          <p className="text-xs text-gray-500 mt-1.5 text-center">
            Shift+click to select range, Ctrl+click to toggle
          </p>
        </div>
      )}
    </div>
  );
};
