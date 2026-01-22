import React, { useState, useEffect } from 'react';
import { Search, Plus, Calendar, AlertCircle, CheckCircle2, Edit3, Check, X } from 'lucide-react';
import { jobVersioningApi } from '../../services/api';
import { JobSummary, JobValidationResponse } from './types';
import { User } from '../../types';
import { validateJobOrOrderName } from '../../utils/folderNameValidation';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { useAlert } from '../../contexts/AlertContext';

interface JobPanelProps {
  selectedCustomerId: number | null;
  selectedCustomerName: string | null;
  selectedJobId: number | null;
  onJobSelected: (jobId: number, customerId: number) => void;
  onCreateNewJob: (jobName: string, customerJobNumber?: string) => Promise<void>;
  user: User;
}

export const JobPanel: React.FC<JobPanelProps> = ({
  selectedCustomerId,
  selectedCustomerName,
  selectedJobId,
  onJobSelected,
  onCreateNewJob,
  user
}) => {
  const { showError } = useAlert();
  const [allJobs, setAllJobs] = useState<JobSummary[]>([]);
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newCustomerJobNumber, setNewCustomerJobNumber] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuggestion, setValidationSuggestion] = useState<string | null>(null);
  // Inline editing state
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [editingJobName, setEditingJobName] = useState('');
  const [editingCustomerJobNumber, setEditingCustomerJobNumber] = useState('');
  const [editingLoading, setEditingLoading] = useState(false);

  // Load all jobs on mount
  useEffect(() => {
    fetchAllJobs();
  }, []);

  const fetchAllJobs = async () => {
    setLoading(true);
    try {
      const jobs = await jobVersioningApi.getAllJobsWithActivity();
      // API interceptor unwraps { success: true, data: jobs } -> jobs array directly
      setAllJobs(jobs || []);
    } catch (error) {
      console.error('Error fetching all jobs:', error);
      setAllJobs([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter jobs based on selected customer and search term
  const filteredJobs = allJobs.filter(job => {
    // Filter by customer if one is selected
    if (selectedCustomerId && job.customer_id !== selectedCustomerId) {
      return false;
    }
    
    // Filter by search term
    if (jobSearchTerm) {
      const searchLower = jobSearchTerm.toLowerCase();
      return (
        job.job_name.toLowerCase().includes(searchLower) ||
        job.job_number.toLowerCase().includes(searchLower) ||
        job.customer_name.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  const validateJobName = async (jobName: string): Promise<boolean> => {
    if (!selectedCustomerId || !jobName.trim()) return false;
    
    try {
      const response: JobValidationResponse = await jobVersioningApi.validateJobName(
        selectedCustomerId, 
        jobName.trim()
      );
      
      if (!response.valid) {
        setValidationError(response.message || 'Job name is not valid');
        setValidationSuggestion(response.suggestion || null);
        return false;
      }
      
      setValidationError(null);
      setValidationSuggestion(null);
      return true;
    } catch (error) {
      console.error('Error validating job name:', error);
      setValidationError('Error validating job name');
      return false;
    }
  };

  // Inline job editing functions
  const handleStartEdit = (job: JobSummary) => {
    // Only allow editing if user has proper permissions
    if (user.role !== 'manager' && user.role !== 'owner') {
      return;
    }

    setEditingJobId(job.job_id);
    setEditingJobName(job.job_name);
    setEditingCustomerJobNumber(job.customer_job_number || '');
  };

  const handleCancelEdit = () => {
    setEditingJobId(null);
    setEditingJobName('');
    setEditingCustomerJobNumber('');
  };

  const handleSaveEdit = async () => {
    if (!editingJobId || !editingJobName.trim()) {
      handleCancelEdit();
      return;
    }

    // Client-side validation for Windows folder name compatibility
    const clientValidation = validateJobOrOrderName(editingJobName);
    if (!clientValidation.isValid) {
      showError(clientValidation.error || 'Invalid job name', 'Validation Error');
      return;  // Don't cancel editing so user can fix
    }

    setEditingLoading(true);
    try {
      await jobVersioningApi.updateJob(
        editingJobId,
        editingJobName.trim(),
        editingCustomerJobNumber.trim() || undefined
      );

      // Update the local state
      setAllJobs(jobs =>
        jobs.map(job =>
          job.job_id === editingJobId
            ? {
                ...job,
                job_name: editingJobName.trim(),
                customer_job_number: editingCustomerJobNumber.trim() || undefined
              }
            : job
        )
      );

      handleCancelEdit();
    } catch (error) {
      console.error('Error updating job:', error);
      // Show error but don't cancel editing so user can try again
      const errorMessage = error instanceof Error ? error.message : 'Failed to update job';
      showError(errorMessage);
    } finally {
      setEditingLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleCreateNewJobClick = () => {
    if (!selectedCustomerId) {
      setValidationError('Please select a customer first');
      return;
    }
    setShowNewJobModal(true);
    setNewJobName('');
    setNewCustomerJobNumber('');
    setValidationError(null);
    setValidationSuggestion(null);
  };

  const handleCreateJob = async () => {
    if (!selectedCustomerId || !newJobName.trim()) return;

    // Client-side validation for Windows folder name compatibility
    const clientValidation = validateJobOrOrderName(newJobName);
    if (!clientValidation.isValid) {
      setValidationError(clientValidation.error);
      return;
    }

    // Server-side validation (duplicate check + final validation)
    const isValid = await validateJobName(newJobName);
    if (!isValid) return;

    try {
      await onCreateNewJob(newJobName.trim(), newCustomerJobNumber.trim() || undefined);
      setShowNewJobModal(false);
      // Refresh jobs list
      fetchAllJobs();
    } catch (error) {
      console.error('Error creating job:', error);
      setValidationError('Failed to create job');
    }
  };

  const getJobStatusBadge = (job: JobSummary) => {
    const statusColors = {
      draft: 'bg-yellow-100 text-yellow-800 border-yellow-800',
      sent: 'bg-blue-100 text-blue-800 border-blue-800',
      approved: 'bg-green-100 text-green-800 border-green-800'
    };

    const statusLabels = {
      draft: 'Draft',
      sent: 'Sent',
      approved: 'Approved'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${
        statusColors[job.job_status] || `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} ${PAGE_STYLES.border}`
      }`}>
        {statusLabels[job.job_status] || job.job_status}
      </span>
    );
  };

  const getHeaderText = () => {
    if (selectedCustomerId && selectedCustomerName) {
      return `Jobs for: ${selectedCustomerName}`;
    } else if (selectedCustomerId) {
      // Fallback to finding from jobs if name not provided
      const customer = allJobs.find(job => job.customer_id === selectedCustomerId);
      if (customer) {
        return `Jobs for: ${customer.customer_name}`;
      }
      return 'Jobs for Selected Customer';
    }
    return 'All Jobs';
  };

  return (
    <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-sm border ${PAGE_STYLES.border} p-4 h-full flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center min-w-0 flex-1">
          <Calendar className="w-5 h-5 text-emerald-600 mr-2 flex-shrink-0" />
          <h2 className={`text-lg font-semibold truncate ${PAGE_STYLES.panel.text}`} title={getHeaderText()}>{getHeaderText()}</h2>
        </div>
        <button
          onClick={handleCreateNewJobClick}
          className={`flex items-center space-x-2 px-2 py-1 rounded text-sm whitespace-nowrap ${
            selectedCustomerId
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
          }`}
          disabled={!selectedCustomerId}
          title={selectedCustomerId ? 'Create new job' : 'Please select a customer first'}
        >
          <Plus className="w-4 h-4" />
          <span>New Job</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className={`absolute left-3 top-3 h-4 w-4 ${PAGE_STYLES.panel.textMuted}`} />
        <input
          type="text"
          placeholder="Search jobs..."
          className={`w-full pl-10 pr-4 py-2 ${PAGE_STYLES.input.background} border ${PAGE_STYLES.border} rounded-lg text-sm ${PAGE_STYLES.input.placeholder}`}
          value={jobSearchTerm}
          onChange={(e) => setJobSearchTerm(e.target.value)}
        />
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted} text-sm`}>
          Loading jobs...
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <div className={`max-h-[calc(100vh-245px)] overflow-y-auto border ${PAGE_STYLES.border}`}>
            {filteredJobs.length === 0 ? (
              <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted}`}>
                <Calendar className={`w-12 h-12 mx-auto mb-4 ${PAGE_STYLES.panel.textMuted}`} />
                <p className="text-sm">
                  {jobSearchTerm
                    ? 'No jobs match your search'
                    : selectedCustomerId
                      ? 'No jobs for this customer'
                      : 'No jobs found'}
                </p>
                {selectedCustomerId && !jobSearchTerm && (
                  <p className="text-xs mt-2">Click "New Job" to create the first job</p>
                )}
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div
                  key={job.job_id}
                  className={`group py-2 px-3 cursor-pointer transition-all ${
                    selectedJobId === job.job_id
                      ? `bg-emerald-100 ring-2 ring-inset ring-emerald-500 border-b ${PAGE_STYLES.border}`
                      : `${PAGE_STYLES.interactive.hover} border-b ${PAGE_STYLES.border} last:border-b-0`
                  }`}
                onClick={() => onJobSelected(job.job_id, job.customer_id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {editingJobId === job.job_id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <div className="flex flex-col gap-1 flex-1">
                            <input
                              type="text"
                              value={editingJobName}
                              onChange={(e) => setEditingJobName(e.target.value)}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              disabled={editingLoading}
                              className="w-full px-2 py-1 text-sm border border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Job name"
                            />
                            <input
                              type="text"
                              value={editingCustomerJobNumber}
                              onChange={(e) => setEditingCustomerJobNumber(e.target.value)}
                              onKeyDown={handleKeyDown}
                              disabled={editingLoading}
                              className={`w-full px-2 py-1 text-xs border ${PAGE_STYLES.input.border} rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Customer Ref (optional)"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit();
                              }}
                              disabled={editingLoading}
                              className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit();
                              }}
                              disabled={editingLoading}
                              className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`truncate ${selectedJobId === job.job_id ? 'font-semibold' : ''}`} title={job.job_name}>
                            {job.job_name}
                          </span>
                          {job.customer_job_number && (
                            <span className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate`} title={job.customer_job_number}>
                              {job.customer_job_number}
                            </span>
                          )}
                          {(user.role === 'manager' || user.role === 'owner') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(job);
                              }}
                              className={`p-1 ${PAGE_STYLES.panel.textMuted} hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity`}
                              title="Edit job name"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
                      #{job.job_number} • {job.customer_name}
                      {job.last_activity && (
                        <span> • {new Date(job.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    {getJobStatusBadge(job)}
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New Job Modal */}
      {showNewJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg p-6 w-full max-w-md`}>
            <h3 className={`text-lg font-semibold mb-4 ${PAGE_STYLES.panel.text}`}>Create New Job</h3>

            <div className="mb-4">
              <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>
                Job Name
              </label>
              <input
                type="text"
                className={`w-full px-2 py-1 border rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm ${
                  validationError ? 'border-red-300' : ''
                }`}
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                placeholder="Enter job name..."
                onBlur={() => newJobName.trim() && validateJobName(newJobName)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateJob()}
                autoFocus
              />
              
              {validationError && (
                <div className="mt-2 flex items-center text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {validationError}
                </div>
              )}
              
              {validationSuggestion && (
                <div className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>
                  <strong>Suggestion:</strong> {validationSuggestion}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-2`}>
                Customer Reference # <span className={`${PAGE_STYLES.panel.textMuted} font-normal`}>(optional)</span>
              </label>
              <input
                type="text"
                className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                value={newCustomerJobNumber}
                onChange={(e) => setNewCustomerJobNumber(e.target.value)}
                placeholder="PO number, project code, etc."
                onKeyPress={(e) => e.key === 'Enter' && handleCreateJob()}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowNewJobModal(false)}
                className={`px-2 py-1 ${PAGE_STYLES.panel.textMuted} border ${PAGE_STYLES.border} rounded ${PAGE_STYLES.interactive.hover} text-sm`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateJob}
                disabled={!newJobName.trim() || validationError !== null}
                className="flex items-center space-x-2 px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Create Job</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
