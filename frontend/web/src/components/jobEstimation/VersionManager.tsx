import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Eye,
  Edit3,
  Copy,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jobVersioningApi, ordersApi } from '../../services/api';
import { VersionManagerProps, EstimateVersion } from './types';
import { formatCurrency, formatDate } from './utils/versionUtils';
import { VersionStatusBadges } from './components/VersionStatusBadges';
import { VersionNotesModal } from './components/VersionNotesModal';
import { useVersionLocking } from './hooks/useVersionLocking';
import { MODULE_COLORS, PAGE_STYLES } from '../../constants/moduleColors';

export const VersionManager: React.FC<VersionManagerProps> = ({
  jobId,
  currentEstimateId,
  onVersionSelected,
  onCreateNewVersion,
  user
}) => {
  const navigate = useNavigate();
  const [versions, setVersions] = useState<EstimateVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState<number | null>(null);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState('');
  // Map of estimateId -> orderNumber for showing "Go to Order" buttons
  const [estimateOrders, setEstimateOrders] = useState<Map<number, number>>(new Map());

  // Version locking hook
  const { checkEditLockStatus, handleVersionSelect, getLockIndicator } = useVersionLocking({
    user,
    onVersionSelect: onVersionSelected
  });

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allVersions = await jobVersioningApi.getEstimateVersions(jobId);
      // API interceptor unwraps { success: true, data: versions } -> versions array directly

      // Filter out deactivated estimates (using is_active flag)
      const activeVersions = (allVersions || []).filter(v => v.is_active !== false && v.is_active !== 0);
      setVersions(activeVersions);

      // Check edit lock status for all drafts
      for (const version of activeVersions) {
        if (version.is_draft) {
          checkEditLockStatus(version.id);
        }
      }

      // Phase 1.5.a: Check if orders exist for approved estimates
      const orderMap = new Map<number, number>();
      for (const version of activeVersions) {
        if (version.is_approved) {
          try {
            const order = await ordersApi.getOrderByEstimate(version.id);
            if (order) {
              orderMap.set(version.id, order.order_number);
            }
          } catch (err) {
            console.error(`Error fetching order for estimate ${version.id}:`, err);
          }
        }
      }
      setEstimateOrders(orderMap);
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

  const handleCreateNewVersion = async (parentId?: number, notes?: string) => {
    try {
      await onCreateNewVersion(parentId, notes);
      fetchVersions(); // Refresh the list
    } catch (err) {
      console.error('Error creating new version:', err);
    }
  };

  const handleNewVersionConfirm = async (notes: string) => {
    setShowNewVersionModal(false);
    await handleCreateNewVersion(undefined, notes || undefined);
  };

  const handleDuplicateVersion = async (notes: string) => {
    if (showDuplicateModal === null) return;

    try {
      const result = await jobVersioningApi.duplicateEstimate(showDuplicateModal, {
        target_job_id: jobId,
        notes: notes.trim() || undefined
      });
      setShowDuplicateModal(null);

      // Navigate to the new copied estimate's page
      if (result?.estimate_id) {
        navigate(`/estimate/${result.estimate_id}`);
      } else {
        // Fallback: refresh list if no estimate_id returned
        fetchVersions();
      }
    } catch (err) {
      console.error('Error duplicating version:', err);
      if (err instanceof Error && err.message.includes('circular reference')) {
        setError('Cannot duplicate: This would create a circular reference in the parent chain');
      } else {
        setError('Failed to duplicate estimate version');
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
            className="flex-1 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-emerald-500"
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
              className={`px-2 py-1 ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} text-xs rounded ${PAGE_STYLES.interactive.hoverOnHeader}`}
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
        className={`group/notes text-base ${PAGE_STYLES.panel.textSecondary} font-medium cursor-pointer ${PAGE_STYLES.interactive.hover} px-2 py-1 rounded min-h-[28px]`}
        onClick={() => handleEditNotes(version)}
        title="Click to edit description"
      >
        {version.notes || <span className={`text-sm ${PAGE_STYLES.panel.textMuted} italic font-normal opacity-0 group-hover/notes:opacity-100 transition-opacity`}>Click to add description...</span>}
      </div>
    );
  };

  const handleGoToOrder = (orderNumber: number) => {
    navigate(`/orders/${orderNumber}`);
  };

  const renderActionButtons = (version: EstimateVersion) => {
    const orderNumber = estimateOrders.get(version.id);
    // Show "View" for approved estimates (converted to orders), otherwise show "Edit" for drafts
    const isViewOnly = version.is_approved || !version.is_draft;

    return (
      <div className="flex flex-col items-center justify-center gap-2 w-full">
        <div className="flex items-center gap-1 w-full">
          {!isViewOnly ? (
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
              className={`flex items-center justify-center space-x-1 px-2 py-1 ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} text-sm rounded ${PAGE_STYLES.interactive.hoverOnHeader} flex-1`}
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
        {/* Show "Go to Order" button if order exists */}
        {orderNumber && (
          <button
            onClick={() => handleGoToOrder(orderNumber)}
            className={`flex items-center justify-center space-x-1 px-2 py-1 ${MODULE_COLORS.orders.base} text-white text-sm rounded ${MODULE_COLORS.orders.hover} w-full`}
            title={`Go to Order #${orderNumber}`}
          >
            <ArrowRight className="w-3 h-3" />
            <span>Go to Order #{orderNumber}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`${PAGE_STYLES.panel.background} rounded shadow`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${PAGE_STYLES.border}`}>
        <div className="flex items-center">
          <FileText className="w-5 h-5 text-emerald-600 mr-2" />
          <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text}`}>Estimate Versions</h2>
          <span className={`ml-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>({versions.length})</span>
        </div>
        <button
          onClick={() => setShowNewVersionModal(true)}
          className="flex items-center space-x-2 bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600"
        >
          <Plus className="w-4 h-4" />
          <span>New Version</span>
        </button>
      </div>

      {/* Table View - Desktop */}
      <div className="version-table-view overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className={`${PAGE_STYLES.header.background} border-b ${PAGE_STYLES.border}`}>
            <tr>
              <th className={`text-left p-3 font-medium ${PAGE_STYLES.panel.textSecondary} w-36`}>Version</th>
              <th className={`text-left p-3 font-medium ${PAGE_STYLES.panel.textSecondary} w-44`}>Description</th>
              <th className={`text-center p-3 font-medium ${PAGE_STYLES.panel.textSecondary} w-24`}>Status</th>
              <th className={`text-right p-3 font-medium ${PAGE_STYLES.panel.textSecondary} w-20`}>Total</th>
              <th className={`text-center p-3 font-medium ${PAGE_STYLES.panel.textSecondary} w-28`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${PAGE_STYLES.divider} border-b ${PAGE_STYLES.border}`}>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                  <p className={`mt-4 ${PAGE_STYLES.panel.textMuted}`}>Loading versions...</p>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                  <p className="text-red-600">{error}</p>
                  <button
                    onClick={fetchVersions}
                    className="mt-4 px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : versions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center">
                  <FileText className={`w-12 h-12 mx-auto ${PAGE_STYLES.panel.textMuted} mb-4`} />
                  <p className={PAGE_STYLES.panel.textMuted}>No estimate versions yet</p>
                  <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>Click "New Version" to create the first estimate</p>
                </td>
              </tr>
            ) : (
              versions.map((version) => (
                <tr
                  key={version.id}
                  className={PAGE_STYLES.interactive.hover}
                >
                  <td className="p-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">v{version.version_number}</span>
                      <span className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
                        {formatDate(version.updated_at).date} <span className={PAGE_STYLES.panel.textMuted}>{formatDate(version.updated_at).time}</span>
                      </span>
                    </div>
                    {getLockIndicator(version)}
                  </td>
                  <td className="p-3">{renderNotesCell(version)}</td>
                  <td className="p-3 text-center">
                    <VersionStatusBadges version={version} />
                  </td>
                  <td className="p-3 text-right font-medium">
                    {formatCurrency(parseFloat(version.total_amount) || 0)}
                  </td>
                  <td className="py-3 px-2">{renderActionButtons(version)}</td>
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
            className={`border rounded-lg p-4 ${PAGE_STYLES.panel.background} ${PAGE_STYLES.border}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-shrink-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-lg">v{version.version_number}</span>
                  <span className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
                    {formatDate(version.updated_at).date} <span className={PAGE_STYLES.panel.textMuted}>{formatDate(version.updated_at).time}</span>
                  </span>
                </div>
                {getLockIndicator(version)}
              </div>
              <div className="flex flex-wrap gap-1 justify-end">
                <VersionStatusBadges version={version} />
              </div>
            </div>
            <div className="mb-2">{renderNotesCell(version)}</div>
            <div className="mb-3">
              <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>Total</div>
              <div className="font-semibold text-lg">
                {formatCurrency(parseFloat(version.total_amount) || 0)}
              </div>
            </div>
            <div className={`flex flex-col gap-2 pt-3 border-t ${PAGE_STYLES.border}`}>
              {renderActionButtons(version)}
            </div>
          </div>
        ))}
      </div>

      {/* New Version Modal */}
      <VersionNotesModal
        isOpen={showNewVersionModal}
        onClose={() => setShowNewVersionModal(false)}
        onConfirm={handleNewVersionConfirm}
        title="New Estimate Version"
        buttonText="Create"
        placeholder="Add a description for this version..."
      />

      {/* Duplicate Version Modal */}
      <VersionNotesModal
        isOpen={showDuplicateModal !== null}
        onClose={() => setShowDuplicateModal(null)}
        onConfirm={handleDuplicateVersion}
        title="Duplicate Version"
        buttonText="Duplicate"
        placeholder="Add notes about this duplication..."
      />
    </div>
  );
};
