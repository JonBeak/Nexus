import React, { useState, useEffect } from 'react';
import { Search, Plus, Calendar, AlertCircle, CheckCircle2, Edit3, Check, X } from 'lucide-react';
import { jobVersioningApi } from '../../services/api';
import { JobSummary, JobValidationResponse } from './types';

interface JobPanelProps {
  selectedCustomerId: number | null;
  selectedJobId: number | null;
  onJobSelected: (jobId: number) => void;
  onCreateNewJob: (jobName: string) => Promise<void>;
  user: any;
}

export const JobPanel: React.FC<JobPanelProps> = ({
  selectedCustomerId,
  selectedJobId,
  onJobSelected,
  onCreateNewJob,
  user
}) => {
  const [allJobs, setAllJobs] = useState<JobSummary[]>([]);
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuggestion, setValidationSuggestion] = useState<string | null>(null);
  // Inline editing state
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [editingJobName, setEditingJobName] = useState('');
  const [editingLoading, setEditingLoading] = useState(false);

  // Load all jobs on mount
  useEffect(() => {
    fetchAllJobs();
  }, []);

  const fetchAllJobs = async () => {
    setLoading(true);
    try {
      const response = await jobVersioningApi.getAllJobsWithActivity();
      setAllJobs(response.data || []);
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
  };

  const handleCancelEdit = () => {
    setEditingJobId(null);
    setEditingJobName('');
  };

  const handleSaveEdit = async () => {
    if (!editingJobId || !editingJobName.trim()) {
      handleCancelEdit();
      return;
    }

    setEditingLoading(true);
    try {
      await jobVersioningApi.updateJob(editingJobId, editingJobName.trim());
      
      // Update the local state
      setAllJobs(jobs => 
        jobs.map(job => 
          job.job_id === editingJobId 
            ? { ...job, job_name: editingJobName.trim() }
            : job
        )
      );
      
      handleCancelEdit();
    } catch (error) {
      console.error('Error updating job name:', error);
      // Show error but don't cancel editing so user can try again
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
    setValidationError(null);
    setValidationSuggestion(null);
  };

  const handleCreateJob = async () => {
    if (!selectedCustomerId || !newJobName.trim()) return;
    
    const isValid = await validateJobName(newJobName);
    if (!isValid) return;
    
    try {
      await onCreateNewJob(newJobName.trim());
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
      quote: 'bg-yellow-100 text-yellow-800 border-yellow-800',
      approved: 'bg-green-100 text-green-800 border-green-800',
      active: 'bg-blue-100 text-blue-800 border-blue-800',
      production: 'bg-purple-100 text-purple-800 border-purple-800',
      completed: 'bg-green-100 text-green-800 border-green-800',
      cancelled: 'bg-red-100 text-red-800 border-red-800'
    };

    return (
      <span className={`px-3 py-2 rounded-full text-sm font-semibold border ${
        statusColors[job.job_status] || 'bg-gray-100 text-gray-800 border-gray-800'
      }`}>
        {job.job_status}
      </span>
    );
  };

  const getHeaderText = () => {
    if (selectedCustomerId) {
      const customer = allJobs.find(job => job.customer_id === selectedCustomerId);
      if (customer) {
        return `Jobs for: ${customer.customer_name}`;
      }
      return 'Jobs for Selected Customer';
    }
    return 'All Jobs';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Calendar className="w-5 h-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold truncate">{getHeaderText()}</h2>
        </div>
        <button
          onClick={handleCreateNewJobClick}
          className={`flex items-center space-x-2 px-2 py-1 rounded text-sm whitespace-nowrap ${
            selectedCustomerId 
              ? 'bg-purple-600 text-white hover:bg-purple-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search jobs..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          value={jobSearchTerm}
          onChange={(e) => setJobSearchTerm(e.target.value)}
        />
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            Loading jobs...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
          <div className="space-y-2">
            {filteredJobs.map((job) => (
              <div
                key={job.job_id}
                className={`group p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedJobId === job.job_id 
                    ? 'bg-purple-50 border-purple-300 shadow-sm' 
                    : 'hover:bg-gray-50 hover:border-purple-200'
                }`}
                onClick={() => onJobSelected(job.job_id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {editingJobId === job.job_id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={editingJobName}
                            onChange={(e) => setEditingJobName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSaveEdit}
                            autoFocus
                            disabled={editingLoading}
                            className="flex-1 px-2 py-1 text-sm border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            onClick={(e) => e.stopPropagation()}
                          />
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
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="truncate" title={job.job_name}>
                            {job.job_name}
                          </span>
                          {(user.role === 'manager' || user.role === 'owner') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(job);
                              }}
                              className="p-1 text-gray-400 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Edit job name"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      #{job.job_number} • {job.customer_name}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {job.estimate_count || 0} version{job.estimate_count !== 1 ? 's' : ''}
                      {job.last_activity && (
                        <span> • {new Date(job.last_activity).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    {getJobStatusBadge(job)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                className={`w-full px-2 py-1 border rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm ${
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
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Suggestion:</strong> {validationSuggestion}
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowNewJobModal(false)}
                className="px-2 py-1 text-gray-600 border rounded hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateJob}
                disabled={!newJobName.trim() || validationError !== null}
                className="flex items-center space-x-2 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
