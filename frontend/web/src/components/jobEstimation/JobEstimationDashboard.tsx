import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomerPanel } from './CustomerPanel';
import { JobPanel } from './JobPanel';
import { VersionManager } from './VersionManager';
import { jobVersioningApi } from '../../services/api';
import { User } from '../../types';
import './JobEstimation.css';

interface JobEstimationDashboardProps {
  user: User;
}

export const JobEstimationDashboard: React.FC<JobEstimationDashboardProps> = ({ user }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read IDs directly from URL - no state needed
  const selectedCustomerId = searchParams.get('cid') ? parseInt(searchParams.get('cid')!) : null;
  const selectedJobId = searchParams.get('jid') ? parseInt(searchParams.get('jid')!) : null;

  // Navigation handlers
  const handleCustomerSelected = (customerId: number | null) => {
    if (customerId === null) {
      navigate('/estimates');
    } else {
      navigate(`/estimates?cid=${customerId}`);
    }
  };

  const handleJobSelected = (jobId: number, customerId: number) => {
    navigate(`/estimates?cid=${customerId}&jid=${jobId}`);
  };

  const handleCreateNewJob = async (newJobName: string, customerJobNumber?: string) => {
    if (!selectedCustomerId) return;

    try {
      const response = await jobVersioningApi.createJob({
        customer_id: selectedCustomerId,
        job_name: newJobName,
        customer_job_number: customerJobNumber,
      });
      const result = response.data || response;
      navigate(`/estimates?cid=${selectedCustomerId}&jid=${result.job_id}`);
    } catch (err) {
      console.error('Failed to create job:', err);
    }
  };

  const handleVersionSelected = (estimateId: number) => {
    navigate(`/estimate/${estimateId}`);
  };

  const handleCreateNewVersion = async (parentId?: number) => {
    if (!selectedJobId) return;

    try {
      const response = await jobVersioningApi.createEstimateVersion(
        selectedJobId,
        parentId ? { parent_estimate_id: parentId } : {}
      );
      const result = response.data || response;
      navigate(`/estimate/${result.estimate_id}`);
    } catch (err) {
      console.error('Failed to create new version:', err);
    }
  };

  // Access denied check
  if (!user || (user.role !== 'manager' && user.role !== 'owner')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-2">Access Denied</div>
          <p className="text-gray-500 mb-4">Job Estimation is available to managers and owners only.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1920px] mx-auto p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Job Estimation</h1>
          </div>
        </div>

        {/* 3-Panel Layout */}
        <div className="three-panel-container">
          <CustomerPanel
            selectedCustomerId={selectedCustomerId}
            onCustomerSelected={handleCustomerSelected}
          />
          <JobPanel
            selectedCustomerId={selectedCustomerId}
            selectedCustomerName={null}
            selectedJobId={selectedJobId}
            onJobSelected={handleJobSelected}
            onCreateNewJob={handleCreateNewJob}
            user={user}
          />
          {selectedJobId ? (
            <VersionManager
              jobId={selectedJobId}
              currentEstimateId={null}
              onVersionSelected={handleVersionSelected}
              onCreateNewVersion={handleCreateNewVersion}
              user={user}
            />
          ) : (
            <div className="bg-white rounded shadow-sm border border-gray-200 p-6 h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm">Select a job to view versions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
