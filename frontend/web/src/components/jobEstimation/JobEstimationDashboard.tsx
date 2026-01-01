import React from 'react';
import { FileText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomerPanel } from './CustomerPanel';
import { JobPanel } from './JobPanel';
import { VersionManager } from './VersionManager';
import { HomeButton } from '../common/HomeButton';
import { jobVersioningApi } from '../../services/api';
import { User } from '../../types';
import { PAGE_STYLES } from '../../constants/moduleColors';
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

  const handleCreateNewVersion = async (parentId?: number, notes?: string) => {
    if (!selectedJobId) return;

    try {
      const response = await jobVersioningApi.createEstimateVersion(
        selectedJobId,
        { parent_estimate_id: parentId, notes }
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
      <div className={`${PAGE_STYLES.fullPage} flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-2">Access Denied</div>
          <p className={`${PAGE_STYLES.panel.textMuted} mb-4`}>Job Estimation is available to managers and owners only.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-emerald-500 text-white px-4 py-2 rounded hover:bg-emerald-600 text-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_STYLES.fullPage}>
      {/* Header Bar */}
      <div className={`${PAGE_STYLES.header.background} shadow-sm border-b border-black`}>
        <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center space-x-4">
          <HomeButton />
          <h1 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>Job Estimation</h1>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto p-6">
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
            <div className={`${PAGE_STYLES.panel.background} rounded shadow-sm border ${PAGE_STYLES.border} p-6 h-full flex items-center justify-center`}>
              <div className={`text-center ${PAGE_STYLES.panel.textMuted}`}>
                <FileText className={`w-12 h-12 mx-auto mb-4 ${PAGE_STYLES.panel.textMuted}`} />
                <p className="text-sm">Select a job to view versions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
