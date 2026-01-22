/**
 * SessionEditRequestsPanel Component
 * Panel for managers to review and approve/reject/modify session edit requests
 * With real-time WebSocket updates
 *
 * Created: 2025-01-15
 * Pattern: Mirrors TimeApprovals component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { sessionEditRequestsApi } from '../../services/api/staff/sessionEditRequestsApi';
import type { PendingSessionEditRequest, ProcessRequestData } from '../../services/api/staff/sessionEditRequestsApi';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { useAlert } from '../../contexts/AlertContext';
import { useEditRequestsSocket } from '../../hooks/useEditRequestsSocket';
import { formatDateTime, formatDuration, toDateTimeLocal } from '../../utils/dateUtils';

interface ModifiedValues {
  startedAt?: string;
  endedAt?: string;
  notes?: string;
}

function SessionEditRequestsPanel() {
  const { showSuccess, showError } = useAlert();
  const [pendingRequests, setPendingRequests] = useState<PendingSessionEditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PendingSessionEditRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [modifiedValues, setModifiedValues] = useState<ModifiedValues>({});
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isModifyMode, setIsModifyMode] = useState(false);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const data = await sessionEditRequestsApi.getPendingRequests();
      setPendingRequests(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending session requests:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  // WebSocket for real-time updates - use stable callback references
  useEditRequestsSocket({
    isManager: true,
    onSessionRequestSubmitted: fetchPendingRequests,
    onSessionRequestCount: fetchPendingRequests,
    onReconnect: fetchPendingRequests
  });

  const handleProcessRequest = async (action: 'approve' | 'reject') => {
    if (!selectedRequest) return;

    try {
      const body: ProcessRequestData = {
        request_id: selectedRequest.request_id,
        action: isModifyMode ? 'modify' : action,
        reviewer_notes: reviewerNotes
      };

      // Only send modified values if we're in modify mode
      if (isModifyMode && selectedRequest.request_type !== 'delete') {
        body.modified_started_at = modifiedValues.startedAt || toDateTimeLocal(selectedRequest.requested_started_at);
        body.modified_ended_at = modifiedValues.endedAt || toDateTimeLocal(selectedRequest.requested_ended_at);
        body.modified_notes = modifiedValues.notes !== undefined ? modifiedValues.notes : selectedRequest.requested_notes;
      }

      await sessionEditRequestsApi.processRequest(body);

      const actionPastTense = body.action === 'modify' ? 'modified' : body.action === 'approve' ? 'approved' : 'rejected';
      showSuccess(`Request ${actionPastTense} successfully!`);

      // Clear all state
      setShowApprovalModal(false);
      setSelectedRequest(null);
      setModifiedValues({});
      setReviewerNotes('');
      setIsModifyMode(false);
      fetchPendingRequests();
    } catch (error: any) {
      console.error('Error processing session request:', error);
      showError(`Error processing request: ${error.response?.data?.message || 'Unknown error'}`);
    }
  };

  const handleModifyToggle = () => {
    if (!selectedRequest) return;

    if (isModifyMode) {
      // Reset to original requested values
      setModifiedValues({
        startedAt: toDateTimeLocal(selectedRequest.requested_started_at),
        endedAt: toDateTimeLocal(selectedRequest.requested_ended_at),
        notes: selectedRequest.requested_notes || ''
      });
    } else {
      // Enter modify mode with current values
      setModifiedValues({
        startedAt: toDateTimeLocal(selectedRequest.requested_started_at),
        endedAt: toDateTimeLocal(selectedRequest.requested_ended_at),
        notes: selectedRequest.requested_notes || ''
      });
    }
    setIsModifyMode(!isModifyMode);
  };

  if (loading) return null;

  return (
    <>
      <div className={`${PAGE_STYLES.composites.panelContainer} p-8`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>Task Session Edit Requests</h3>
          <span className={`px-3 py-1 rounded-full font-semibold ${
            pendingRequests.length > 0
              ? 'bg-purple-100 text-purple-700'
              : `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted}`
          }`}>
            {pendingRequests.length} Pending
          </span>
        </div>

        {pendingRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={PAGE_STYLES.header.background}>
                <tr className={`border-b-2 ${PAGE_STYLES.panel.border}`}>
                  <th className={`text-left py-3 px-2 font-semibold ${PAGE_STYLES.panel.text}`}>Employee</th>
                  <th className={`text-left py-3 px-2 font-semibold ${PAGE_STYLES.panel.text}`}>Task/Order</th>
                  <th className={`text-left py-3 px-2 font-semibold ${PAGE_STYLES.panel.text}`}>Original</th>
                  <th className={`text-left py-3 px-2 font-semibold ${PAGE_STYLES.panel.text}`}>Requested</th>
                  <th className={`text-left py-3 px-2 font-semibold ${PAGE_STYLES.panel.text}`}>Reason</th>
                  <th className={`text-left py-3 px-2 font-semibold ${PAGE_STYLES.panel.text}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={PAGE_STYLES.composites.tableBody}>
                {pendingRequests.map((request) => (
                  <tr key={request.request_id} className={`${PAGE_STYLES.interactive.hover}`}>
                    <td className={`py-3 px-2 ${PAGE_STYLES.panel.text}`}>
                      <div>
                        <p className="font-semibold">{request.first_name} {request.last_name}</p>
                        <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>@{request.username}</p>
                      </div>
                    </td>
                    <td className={`py-3 px-2 ${PAGE_STYLES.panel.text}`}>
                      <div>
                        <p className="font-medium text-sm">{request.task_name}</p>
                        <p className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
                          #{request.order_number} - {request.order_name}
                        </p>
                      </div>
                    </td>
                    <td className={`py-3 px-2 text-sm ${PAGE_STYLES.panel.text}`}>
                      <div>
                        <p>Start: {formatDateTime(request.original_started_at)}</p>
                        <p>End: {formatDateTime(request.original_ended_at)}</p>
                        <p>Duration: {formatDuration(request.original_duration_minutes)}</p>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm">
                      {request.request_type === 'delete' ? (
                        <div className="text-red-600 font-semibold">
                          <p>DELETE REQUEST</p>
                        </div>
                      ) : (
                        <div className="text-purple-700">
                          <p>Start: {formatDateTime(request.requested_started_at)}</p>
                          <p>End: {formatDateTime(request.requested_ended_at)}</p>
                          {request.requested_notes && (
                            <p className="text-xs text-gray-500 mt-1">Notes: {request.requested_notes.substring(0, 30)}...</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={`py-3 px-2 ${PAGE_STYLES.panel.text}`}>
                      <p className="text-sm max-w-[200px] truncate" title={request.reason}>{request.reason}</p>
                    </td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowApprovalModal(true);
                          setModifiedValues({});
                          setReviewerNotes('');
                          setIsModifyMode(false);
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className={PAGE_STYLES.panel.textMuted}>No pending task session edit requests</p>
            <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mt-2`}>Requests from staff will appear here for approval</p>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${PAGE_STYLES.panel.background} rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto border ${PAGE_STYLES.panel.border}`}>
            <h3 className={`text-2xl font-bold ${PAGE_STYLES.panel.text} mb-6`}>
              Review Session {selectedRequest.request_type === 'delete' ? 'Delete' : 'Edit'} Request
            </h3>

            <div className="space-y-4 mb-6">
              {/* Employee Info */}
              <div className={`${PAGE_STYLES.header.background} p-4 rounded-lg border ${PAGE_STYLES.panel.border}`}>
                <h4 className={`font-semibold ${PAGE_STYLES.panel.text} mb-2`}>Employee</h4>
                <p className={PAGE_STYLES.panel.text}>{selectedRequest.first_name} {selectedRequest.last_name} (@{selectedRequest.username})</p>
              </div>

              {/* Task/Order Info */}
              <div className={`${PAGE_STYLES.header.background} p-4 rounded-lg border ${PAGE_STYLES.panel.border}`}>
                <h4 className={`font-semibold ${PAGE_STYLES.panel.text} mb-2`}>Task</h4>
                <p className={PAGE_STYLES.panel.text}>{selectedRequest.task_name}</p>
                <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
                  #{selectedRequest.order_number} - {selectedRequest.order_name}
                </p>
              </div>

              {selectedRequest.request_type === 'delete' ? (
                <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                  <h4 className="font-semibold text-red-700 mb-2">Session to be Deleted</h4>
                  <p className="text-sm text-red-800">Start: {formatDateTime(selectedRequest.original_started_at)}</p>
                  <p className="text-sm text-red-800">End: {formatDateTime(selectedRequest.original_ended_at)}</p>
                  <p className="text-sm text-red-800">Duration: {formatDuration(selectedRequest.original_duration_minutes)}</p>
                  {selectedRequest.original_notes && (
                    <p className="text-sm text-red-800 mt-1">Notes: {selectedRequest.original_notes}</p>
                  )}
                  <p className="text-red-600 font-semibold mt-2">This session will be permanently deleted</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className={`${PAGE_STYLES.header.background} p-4 rounded-lg border ${PAGE_STYLES.panel.border}`}>
                    <h4 className={`font-semibold ${PAGE_STYLES.panel.text} mb-2`}>Original Times</h4>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>Start: {formatDateTime(selectedRequest.original_started_at)}</p>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>End: {formatDateTime(selectedRequest.original_ended_at)}</p>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>Duration: {formatDuration(selectedRequest.original_duration_minutes)}</p>
                    {selectedRequest.original_notes && (
                      <p className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-1`}>Notes: {selectedRequest.original_notes}</p>
                    )}
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-700 mb-2">Requested Times</h4>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>Start: {formatDateTime(selectedRequest.requested_started_at)}</p>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>End: {formatDateTime(selectedRequest.requested_ended_at)}</p>
                    {selectedRequest.requested_notes && (
                      <p className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-1`}>Notes: {selectedRequest.requested_notes}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className={`${PAGE_STYLES.header.background} p-4 rounded-lg border ${PAGE_STYLES.panel.border}`}>
                <h4 className={`font-semibold ${PAGE_STYLES.panel.text} mb-2`}>Reason</h4>
                <p className={PAGE_STYLES.panel.text}>{selectedRequest.reason}</p>
              </div>

              {/* Modify Times (for edit requests only) */}
              {selectedRequest.request_type !== 'delete' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className={`font-semibold ${PAGE_STYLES.panel.text}`}>Modify Values</h4>
                    <button
                      type="button"
                      onClick={handleModifyToggle}
                      className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                        isModifyMode
                          ? `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border}`
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {isModifyMode ? 'Reset' : 'Modify'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Start Time</label>
                      <input
                        type="datetime-local"
                        value={modifiedValues.startedAt || toDateTimeLocal(selectedRequest.requested_started_at)}
                        onChange={(e) => setModifiedValues({...modifiedValues, startedAt: e.target.value})}
                        disabled={!isModifyMode}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 text-sm ${
                          isModifyMode
                            ? `${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} focus:ring-purple-500`
                            : 'bg-gray-200 cursor-not-allowed text-gray-600'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>End Time</label>
                      <input
                        type="datetime-local"
                        value={modifiedValues.endedAt || toDateTimeLocal(selectedRequest.requested_ended_at)}
                        onChange={(e) => setModifiedValues({...modifiedValues, endedAt: e.target.value})}
                        disabled={!isModifyMode}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 text-sm ${
                          isModifyMode
                            ? `${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} focus:ring-purple-500`
                            : 'bg-gray-200 cursor-not-allowed text-gray-600'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Notes</label>
                    <textarea
                      value={modifiedValues.notes !== undefined ? modifiedValues.notes : (selectedRequest.requested_notes || '')}
                      onChange={(e) => setModifiedValues({...modifiedValues, notes: e.target.value})}
                      disabled={!isModifyMode}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 text-sm ${
                        isModifyMode
                          ? `${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} focus:ring-purple-500`
                          : 'bg-gray-200 cursor-not-allowed text-gray-600'
                      }`}
                      rows={2}
                    />
                  </div>
                  {isModifyMode && (
                    <p className="text-sm text-purple-700 mt-2">Modify the values above, then click Approve to save changes</p>
                  )}
                </div>
              )}

              {/* Reviewer Notes */}
              <div>
                <label className={`block text-sm font-semibold ${PAGE_STYLES.panel.text} mb-2`}>Reviewer Notes</label>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  className={`w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500`}
                  rows={3}
                  placeholder="Optional notes about this decision..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedRequest(null);
                  setModifiedValues({});
                  setReviewerNotes('');
                  setIsModifyMode(false);
                }}
                className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.interactive.hover} ${PAGE_STYLES.panel.text} px-6 py-2 rounded-lg font-semibold transition-colors border ${PAGE_STYLES.panel.border}`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleProcessRequest('reject')}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => handleProcessRequest('approve')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                {isModifyMode ? 'Approve Modified' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SessionEditRequestsPanel;
