import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Eye,
  Edit3,
  Copy,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { jobVersioningApi } from '../../services/api';
import { VersionManagerProps, EstimateVersion } from './types';
import { formatCurrency, formatDate } from './utils/versionUtils';
import { VersionStatusBadges } from './components/VersionStatusBadges';
import { DuplicationModal } from './components/DuplicationModal';
import { useVersionLocking } from './hooks/useVersionLocking';

export const VersionManager: React.FC<VersionManagerProps> = ({
  jobId,
  currentEstimateId,
  onVersionSelected,
  onCreateNewVersion,
  user
}) => {
  const [versions, setVersions] = useState<EstimateVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState('');

  // Version locking hook
  const { checkEditLockStatus, handleVersionSelect, getLockIndicator } = useVersionLocking({
    user,
    onVersionSelect: onVersionSelected
  });

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await jobVersioningApi.getEstimateVersions(jobId);
      const allVersions = response.data || [];

      // Filter out deactivated estimates (using is_active flag)
      const activeVersions = allVersions.filter(v => v.is_active !== false && v.is_active !== 0);
      setVersions(activeVersions);

      // Check edit lock status for all drafts
      for (const version of activeVersions) {
        if (version.is_draft) {
          checkEditLockStatus(version.id);
        }
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
      setError('Failed to load estimate versions');
    } finally {
      setLoading(false);
    }
  }, [jobId, checkEditLockStatus]);

  useEffect(() => {
    if (jobId) {
      fetchVersions();
    }
  }, [fetchVersions, jobId]);

  const handleCreateNewVersion = async (parentId?: number) => {
    try {
      await onCreateNewVersion(parentId);
      fetchVersions(); // Refresh the list
    } catch (err) {
      console.error('Error creating new version:', err);
    }
  };

  const handleDuplicateVersion = async (notes: string) => {
    if (showDuplicateModal === null) return;

    try {
      await jobVersioningApi.duplicateEstimate(showDuplicateModal, {
        target_job_id: jobId,
        notes: notes.trim() || undefined
      });
      setShowDuplicateModal(null);
      fetchVersions();
    } catch (err) {
      console.error('Error duplicating version:', err);
      if (err instanceof Error && err.message.includes('circular reference')) {
        setError('Cannot duplicate: This would create a circular reference in the parent chain');
      } else {
        setError('Failed to duplicate estimate version');
      }
    }
  };

  const handleApproveEstimate = async (estimateId: number) => {
    if (!window.confirm('Mark this estimate as approved? This action can be reversed.')) {
      return;
    }

    try {
      await jobVersioningApi.approveEstimate(estimateId);
      fetchVersions();
    } catch (err) {
      console.error('Error approving estimate:', err);
      setError('Failed to approve estimate');
    }
  };

  const handleEditNotes = (version: EstimateVersion) => {
    setEditingNotes(version.id);
    setNotesValue(version.notes || '');
  };

  const handleSaveNotes = async (estimateId: number) => {
    try {
      await jobVersioningApi.updateEstimateNotes(estimateId, notesValue);
      setEditingNotes(null);
      fetchVersions();
    } catch (err) {
      console.error('Error saving notes:', err);
      setError('Failed to save notes');
    }
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setNotesValue('');
  };

  const renderNotesCell = (version: EstimateVersion) => {
    if (editingNotes === version.id) {
      return (
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-purple-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveNotes(version.id);
              if (e.key === 'Escape') handleCancelEdit();
            }}
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleSaveNotes(version.id)}
              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              title="Save"
            >
              ✓
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
              title="Cancel"
            >
              ✕
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
        onClick={() => handleEditNotes(version)}
        title="Click to edit description"
      >
        {version.notes || <span className="text-gray-400 italic">Click to add description...</span>}
      </div>
    );
  };

  const renderActionButtons = (version: EstimateVersion) => (
    <div className="flex flex-col items-center justify-center gap-2 w-full">
      <div className="flex items-center gap-1 w-full">
        {version.is_draft ? (
          <button
            onClick={() => handleVersionSelect(version)}
            className="flex items-center justify-center space-x-1 px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex-1"
            title="Edit Draft"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        ) : (
          <button
            onClick={() => handleVersionSelect(version)}
            className="flex items-center justify-center space-x-1 px-2 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 flex-1"
            title="View Final"
          >
            <Eye className="w-3 h-3" />
            <span>View</span>
          </button>
        )}
        <button
          onClick={() => setShowDuplicateModal(version.id)}
          className="flex items-center justify-center space-x-1 px-2 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex-1"
          title="Duplicate Version"
        >
          <Copy className="w-3 h-3" />
          <span>Copy</span>
        </button>
      </div>
      {version.qb_estimate_id && !(version.is_approved === true || version.is_approved === 1) && (
        <button
          onClick={() => handleApproveEstimate(version.id)}
          className="flex items-center justify-center space-x-1 px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 w-full"
          title="Mark as Approved"
        >
          <CheckCircle className="w-3 h-3" />
          <span>Approve</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded shadow">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center">
          <FileText className="w-5 h-5 text-purple-600 mr-2" />
          <h2 className="text-xl font-semibold">Estimate Versions</h2>
          <span className="ml-2 text-sm text-gray-500">({versions.length})</span>
        </div>
        <button
          onClick={() => handleCreateNewVersion()}
          className="flex items-center space-x-2 bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          <span>New Version</span>
        </button>
      </div>

      {/* Table View - Desktop */}
      <div className="version-table-view overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 font-medium text-gray-700 w-16">Version</th>
              <th className="text-left p-4 font-medium text-gray-700 w-64">Description</th>
              <th className="text-left p-4 font-medium text-gray-700 w-20">Status</th>
              <th className="text-right p-4 font-medium text-gray-700 w-24">Total</th>
              <th className="text-left p-4 font-medium text-gray-700 w-32">Last Edited</th>
              <th className="text-center p-4 font-medium text-gray-700 w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="mt-4 text-gray-500">Loading versions...</p>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                  <p className="text-red-600">{error}</p>
                  <button
                    onClick={fetchVersions}
                    className="mt-4 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : versions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No estimate versions yet</p>
                  <p className="text-sm text-gray-400">Click "New Version" to create the first estimate</p>
                </td>
              </tr>
            ) : (
              versions.map((version) => (
                <tr
                  key={version.id}
                  className={`hover:bg-gray-50 ${currentEstimateId === version.id ? 'bg-purple-50' : ''}`}
                >
                  <td className="p-4">
                    <div className="font-medium">v{version.version_number}</div>
                    {getLockIndicator(version)}
                  </td>
                  <td className="p-4">{renderNotesCell(version)}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      <VersionStatusBadges version={version} />
                    </div>
                  </td>
                  <td className="p-4 text-right font-medium">
                    {formatCurrency(parseFloat(version.total_amount) || 0)}
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    <div className="flex items-start">
                      <Clock className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-col">
                        <span>{formatDate(version.updated_at).date}</span>
                        <span className="text-xs text-gray-400">{formatDate(version.updated_at).time}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2">{renderActionButtons(version)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Card View - Mobile/Tablet */}
      <div className="version-card-view p-4 space-y-3">
        {versions.map((version) => (
          <div
            key={version.id}
            className={`border rounded-lg p-4 ${
              currentEstimateId === version.id ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-shrink-0">
                <div className="font-semibold text-lg">v{version.version_number}</div>
                {getLockIndicator(version)}
              </div>
              <div className="flex flex-wrap gap-1 justify-end">
                <VersionStatusBadges version={version} />
              </div>
            </div>
            <div className="mb-2">{renderNotesCell(version)}</div>
            <div className="mb-2">
              <div className="text-sm text-gray-500">Total</div>
              <div className="font-semibold text-lg">
                {formatCurrency(parseFloat(version.total_amount) || 0)}
              </div>
            </div>
            <div className="mb-3">
              <div className="flex items-start text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-gray-500 text-xs">Last edited:</span>
                  <span>{formatDate(version.updated_at).date}</span>
                  <span className="text-xs text-gray-400">{formatDate(version.updated_at).time}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-3 border-t border-gray-200">
              {renderActionButtons(version)}
            </div>
          </div>
        ))}
      </div>

      <DuplicationModal
        isOpen={showDuplicateModal !== null}
        onClose={() => setShowDuplicateModal(null)}
        onDuplicate={handleDuplicateVersion}
      />
    </div>
  );
};
