import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Plus, 
  Eye, 
  Edit3, 
  Copy, 
  Clock, 
  User, 
  Lock, 
  AlertTriangle,
  CheckCircle,
  Send,
  Package
} from 'lucide-react';
import { jobVersioningApi } from '../../services/api';
import { VersionManagerProps, EstimateVersion, EditLockStatus } from './types';
import { getEstimateStatusText, getStatusColorClasses } from './utils/statusUtils';

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
  const [duplicateNotes, setDuplicateNotes] = useState('');
  const [lockStatuses, setLockStatuses] = useState<Record<number, EditLockStatus>>({});
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState('');

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await jobVersioningApi.getEstimateVersions(jobId);
      const allVersions = response.data || [];

      // Filter out deactivated estimates
      const activeVersions = allVersions.filter(v => v.status !== 'deactivated');
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
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      fetchVersions();
    }
  }, [fetchVersions, jobId]);

  const checkEditLockStatus = async (estimateId: number) => {
    try {
      const response = await jobVersioningApi.checkEditLock(estimateId);
      setLockStatuses(prev => ({
        ...prev,
        [estimateId]: response
      }));
    } catch (err) {
      console.error('Error checking lock status:', err);
    }
  };

  const handleVersionSelect = (version: EstimateVersion) => {
    if (version.is_draft) {
      const lockStatus = lockStatuses[version.id];
      if (lockStatus && !lockStatus.can_edit && lockStatus.editing_user_id !== user.user_id) {
        // Show lock conflict modal
        showLockConflictDialog(version, lockStatus);
        return;
      }
    }
    onVersionSelected(version.id);
  };

  const handleCreateNewVersion = async (parentId?: number) => {
    try {
      await onCreateNewVersion(parentId);
      fetchVersions(); // Refresh the list
    } catch (err) {
      console.error('Error creating new version:', err);
    }
  };

  const handleDuplicateVersion = async (fromVersionId: number) => {
    try {
      await jobVersioningApi.duplicateEstimate(fromVersionId, {
        target_job_id: jobId,
        notes: duplicateNotes.trim() || undefined
      });
      setShowDuplicateModal(null);
      setDuplicateNotes('');
      fetchVersions();
    } catch (err) {
      console.error('Error duplicating version:', err);
      // Show user-friendly error for circular reference issues
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
      fetchVersions(); // Refresh the list to show updated status
    } catch (err) {
      console.error('Error approving estimate:', err);
      setError('Failed to approve estimate');
    }
  };

  const handleOverrideLock = async (estimateId: number) => {
    if (user.role !== 'manager' && user.role !== 'owner') return;
    
    try {
      await jobVersioningApi.overrideEditLock(estimateId);
      checkEditLockStatus(estimateId);
    } catch (err) {
      console.error('Error overriding lock:', err);
    }
  };

  const showLockConflictDialog = (version: EstimateVersion, lockStatus: EditLockStatus) => {
    const canOverride = user.role === 'manager' || user.role === 'owner';
    const message = `${lockStatus.editing_user} is currently editing this estimate.`;

    if (window.confirm(`${message}\n\n${canOverride ? 'Override lock and edit anyway?' : 'View in read-only mode?'}`)) {
      if (canOverride && window.confirm('Are you sure you want to override the edit lock? This may cause conflicts.')) {
        handleOverrideLock(version.id);
      } else {
        onVersionSelected(version.id);
      }
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
      fetchVersions(); // Refresh to show updated notes
    } catch (err) {
      console.error('Error saving notes:', err);
      setError('Failed to save notes');
    }
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setNotesValue('');
  };

  const getStatusBadges = (version: EstimateVersion) => {
    const badges = [];

    // Check deactivated first (single source of truth via is_active)
    // Handle both boolean false and number 0 (from database)
    if (version.is_active === false || version.is_active === 0) {
      badges.push(
        <span key="deactivated" className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">
          Deactivated
        </span>
      );
      return badges; // Deactivated estimates show only this badge
    }

    // Draft status
    if (version.is_draft === true || version.is_draft === 1) {
      badges.push(
        <span key="draft" className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
          Draft
        </span>
      );
      return badges; // Draft estimates show only this badge
    }

    // For finalized estimates, show all applicable status flags
    // Sent badge is larger (text-sm) for visibility
    if (version.is_sent === true || version.is_sent === 1) {
      badges.push(
        <span key="sent" className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium flex items-center">
          <Send className="w-4 h-4 mr-1" />
          Sent
        </span>
      );
    }

    if (version.is_approved === true || version.is_approved === 1) {
      badges.push(
        <span key="approved" className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium flex items-center">
          <CheckCircle className="w-4 h-4 mr-1" />
          Approved
        </span>
      );
    }

    if (version.is_retracted === true || version.is_retracted === 1) {
      badges.push(
        <span key="retracted" className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
          Retracted
        </span>
      );
    }

    if (version.status === 'ordered') {
      badges.push(
        <span key="ordered" className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium flex items-center">
          <Package className="w-3 h-3 mr-1" />
          Ordered
        </span>
      );
    }

    // If no badges were added, this violates database constraint - show error
    if (badges.length === 0) {
      badges.push(
        <span key="error" className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
          ERROR: No Status
        </span>
      );
    }
    
    return badges;
  };

  const getLockIndicator = (version: EstimateVersion) => {
    if (!version.is_draft) return null;
    
    const lockStatus = lockStatuses[version.id];
    if (!lockStatus) return null;
    
    if (!lockStatus.can_edit && lockStatus.editing_user_id !== user.user_id) {
      return (
        <div className="flex items-center text-orange-600 text-sm">
          <Lock className="w-3 h-3 mr-1" />
          <span>Editing: {lockStatus.editing_user}</span>
        </div>
      );
    }
    
    return null;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return { date: dateStr, time: timeStr };
  };

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

      {/* Versions Table */}
      <>
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
                    className={`hover:bg-gray-50 ${
                      currentEstimateId === version.id ? 'bg-purple-50' : ''
                    }`}
                  >
                    <td className="p-4">
                      <div className="font-medium">v{version.version_number}</div>
                      {getLockIndicator(version)}
                    </td>

                    <td className="p-4">
                      {editingNotes === version.id ? (
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
                      ) : (
                        <div
                          className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => handleEditNotes(version)}
                          title="Click to edit description"
                        >
                          {version.notes || <span className="text-gray-400 italic">Click to add description...</span>}
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {getStatusBadges(version)}
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

                    <td className="py-4 px-2">
                      <div className="flex flex-col items-center justify-center gap-2 w-full">
                        {/* First row: Edit/View and Copy buttons */}
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

                        {/* Second row: Approve button (if applicable) */}
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
                    </td>
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
                {/* Top Row: Version and Status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-shrink-0">
                    <div className="font-semibold text-lg">v{version.version_number}</div>
                    {getLockIndicator(version)}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {getStatusBadges(version)}
                  </div>
                </div>

                {/* Description */}
                <div className="mb-2">
                  {editingNotes === version.id ? (
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
                  ) : (
                    <div
                      className="text-sm text-gray-700 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                      onClick={() => handleEditNotes(version)}
                      title="Click to edit description"
                    >
                      {version.notes || <span className="text-gray-400 italic">Click to add description...</span>}
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="mb-2">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="font-semibold text-lg">
                    {formatCurrency(parseFloat(version.total_amount) || 0)}
                  </div>
                </div>

                {/* Last Edited */}
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

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-3 border-t border-gray-200">
                  {/* First row: Edit/View and Copy buttons */}
                  <div className="flex items-center space-x-2">
                    {version.is_draft ? (
                      <button
                        onClick={() => handleVersionSelect(version)}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        title="Edit Draft"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVersionSelect(version)}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                        title="View Final"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowDuplicateModal(version.id)}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                      title="Duplicate Version"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </button>
                  </div>

                  {/* Second row: Approve button (if applicable) */}
                  {version.qb_estimate_id && !(version.is_approved === true || version.is_approved === 1) && (
                    <button
                      onClick={() => handleApproveEstimate(version.id)}
                      className="w-full flex items-center justify-center space-x-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      title="Mark as Approved"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>

      {/* Duplicate Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Duplicate Version</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                rows={3}
                value={duplicateNotes}
                onChange={(e) => setDuplicateNotes(e.target.value)}
                placeholder="Add notes about this duplication..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDuplicateModal(null);
                  setDuplicateNotes('');
                }}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDuplicateVersion(showDuplicateModal)}
                className="flex-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
