import React, { useState, useEffect } from 'react';
import { Search, Plus, Building, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { customerApi, jobVersioningApi } from '../../services/api';
import { JobSelectorProps, JobSummary, JobValidationResponse } from './types';

export const JobSelector: React.FC<JobSelectorProps> = ({
  customerId,
  onCustomerSelected,
  onJobSelected,
  onCreateNewJob,
  user
}) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>(customerId);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuggestion, setValidationSuggestion] = useState<string | null>(null);

  // Load customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Load jobs when customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      fetchJobs();
    }
  }, [selectedCustomerId]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await customerApi.getCustomers({ 
        limit: 1000, 
        search: searchTerm,
        include_inactive: false 
      });
      setCustomers(response.customers || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    if (!selectedCustomerId) return;
    
    setJobsLoading(true);
    try {
      const response = await jobVersioningApi.getJobsByCustomer(selectedCustomerId);
      setJobs(response.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  };

  const handleCustomerSelect = (customerId: number) => {
    setSelectedCustomerId(customerId);
    onCustomerSelected(customerId);
    setJobs([]);
  };

  const handleJobSelect = (jobId: number) => {
    onJobSelected(jobId);
  };

  const handleCreateNewJobClick = () => {
    setShowNewJobModal(true);
    setNewJobName('');
    setValidationError(null);
    setValidationSuggestion(null);
  };

  const validateJobName = async (jobName: string) => {
    if (!selectedCustomerId || !jobName.trim()) return false;

    try {
      const response = await jobVersioningApi.validateJobName(selectedCustomerId, jobName.trim());
      if (!response.valid) {
        setValidationError(response.message || 'Job name is not valid');
        setValidationSuggestion(response.suggestion || null);
        return false;
      }
      setValidationError(null);
      setValidationSuggestion(null);
      return true;
    } catch (error) {
      setValidationError('Error validating job name');
      return false;
    }
  };

  const handleCreateJob = async () => {
    if (!selectedCustomerId || !newJobName.trim()) return;

    const isValid = await validateJobName(newJobName);
    if (!isValid) return;

    try {
      await onCreateNewJob(newJobName.trim());
      setShowNewJobModal(false);
      fetchJobs(); // Refresh jobs list
    } catch (error) {
      console.error('Error creating job:', error);
      setValidationError('Failed to create job');
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.contact_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredJobs = jobs.filter(job =>
    job.job_name.toLowerCase().includes(jobSearchTerm.toLowerCase()) ||
    job.job_number.toLowerCase().includes(jobSearchTerm.toLowerCase())
  );

  const getJobStatusBadge = (job: JobSummary) => {
    const statusColors = {
      quote: 'bg-yellow-100 text-yellow-800',
      active: 'bg-blue-100 text-blue-800',
      production: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.job_status]}`}>
        {job.job_status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Customer Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Building className="w-5 h-5 text-purple-600 mr-2" />
          <h2 className="text-xl font-semibold">Select Customer</h2>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setTimeout(fetchCustomers, 300);
            }}
          />
        </div>

        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading customers...</div>
        ) : (
          <div className="max-h-48 overflow-y-auto border rounded-lg">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.customer_id}
                className={`p-3 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 ${
                  selectedCustomerId === customer.customer_id ? 'bg-purple-50 border-purple-200' : ''
                }`}
                onClick={() => handleCustomerSelect(customer.customer_id)}
              >
                <div className="font-medium">{customer.company_name}</div>
                <div className="text-sm text-gray-500">{customer.contact_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job Selection */}
      {selectedCustomerId && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-purple-600 mr-2" />
              <h2 className="text-xl font-semibold">Select Job</h2>
            </div>
            <button
              onClick={handleCreateNewJobClick}
              className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              <span>New Job</span>
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={jobSearchTerm}
              onChange={(e) => setJobSearchTerm(e.target.value)}
            />
          </div>

          {jobsLoading ? (
            <div className="text-center py-4 text-gray-500">Loading jobs...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No jobs found for this customer</p>
              <p className="text-sm">Click "New Job" to create the first job</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map((job) => (
                <div
                  key={job.job_id}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 hover:border-purple-300"
                  onClick={() => handleJobSelect(job.job_id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{job.job_name}</div>
                      <div className="text-sm text-gray-500">
                        Job #{job.job_number} • {job.estimate_count} versions
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getJobStatusBadge(job)}
                      <div className="text-xs text-gray-500">
                        {job.draft_count > 0 && (
                          <span className="bg-gray-100 px-2 py-1 rounded mr-1">
                            {job.draft_count} draft{job.draft_count > 1 ? 's' : ''}
                          </span>
                        )}
                        {job.finalized_count > 0 && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            {job.finalized_count} final
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Job Modal */}
      {showNewJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Job</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Name
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  validationError ? 'border-red-300' : ''
                }`}
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                placeholder="Enter job name..."
                onBlur={() => newJobName.trim() && validateJobName(newJobName)}
              />
              
              {validationError && (
                <div className="mt-2 flex items-start space-x-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p>{validationError}</p>
                    {validationSuggestion && (
                      <p className="mt-1 text-gray-600">
                        Suggestion: {validationSuggestion}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowNewJobModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateJob}
                disabled={!newJobName.trim() || !!validationError}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};