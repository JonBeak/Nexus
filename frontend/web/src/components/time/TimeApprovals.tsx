import React, { useState, useEffect, useCallback } from 'react';
import { timeApi } from '../../services/api';
import type { TimeEditRequest, EditRequestDraft } from '../../types/time';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { useEditRequestsSocket } from '../../hooks/useEditRequestsSocket';
import '../jobEstimation/JobEstimation.css';

function TimeApprovals() {
  const [pendingRequests, setPendingRequests] = useState<TimeEditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<TimeEditRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [modifiedValues, setModifiedValues] = useState<Partial<EditRequestDraft>>({});
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isModifyMode, setIsModifyMode] = useState(false);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const data: TimeEditRequest[] = await timeApi.getPendingRequests();
      setPendingRequests(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  // WebSocket for real-time updates
  // Use stable callback references to prevent reconnection loops
  useEditRequestsSocket({
    isManager: true,
    onTimeRequestSubmitted: fetchPendingRequests,
    onTimeRequestCount: fetchPendingRequests,
    onReconnect: fetchPendingRequests
  });

  const handleProcessRequest = async (action: 'approve' | 'reject') => {
    if (!selectedRequest) {
      return;
    }
    try {
      const body: {
        request_id: number;
        action: 'approve' | 'reject' | 'modify';
        reviewer_notes: string;
        modified_clock_in?: string;
        modified_clock_out?: string;
        modified_break_minutes?: number;
      } = {
        request_id: selectedRequest.request_id,
        action: isModifyMode ? 'modify' : action,
        reviewer_notes: reviewerNotes
      };

      // Only send modified values if we're actually in modify mode
      if (isModifyMode) {
        body.modified_clock_in = modifiedValues.clockIn || formatDateTimeForInput(selectedRequest.requested_clock_in);
        body.modified_clock_out = modifiedValues.clockOut || formatDateTimeForInput(selectedRequest.requested_clock_out);
        const breakMinutes = modifiedValues.breakMinutes ?? selectedRequest.requested_break_minutes;
        const parsedBreakMinutes = typeof breakMinutes === 'number' ? breakMinutes : Number(breakMinutes);
        body.modified_break_minutes = Number.isNaN(parsedBreakMinutes)
          ? selectedRequest.requested_break_minutes
          : parsedBreakMinutes;
      }

      await timeApi.processRequest(body);

      const actionPastTense = body.action === 'modify' ? 'modified' : body.action === 'approve' ? 'approved' : 'rejected';
      alert(`Request ${actionPastTense} successfully!`);
      // Clear all state properly
      setShowApprovalModal(false);
      setSelectedRequest(null);
      setModifiedValues({});
      setReviewerNotes('');
      setIsModifyMode(false);
      fetchPendingRequests();
    } catch (error: any) {
      console.error('Error processing request:', error);
      alert(`Error processing request: ${error.response?.data?.error || 'Unknown error'}`);
    }
  };

  const handleModifyToggle = () => {
    if (!selectedRequest) {
      return;
    }
    if (isModifyMode) {
      // Reset to original requested values
      setModifiedValues({
        clockIn: formatDateTimeForInput(selectedRequest.requested_clock_in),
        clockOut: formatDateTimeForInput(selectedRequest.requested_clock_out),
        breakMinutes: selectedRequest.requested_break_minutes
      });
    } else {
      // Enter modify mode with current values
      setModifiedValues({
        clockIn: formatDateTimeForInput(selectedRequest.requested_clock_in),
        clockOut: formatDateTimeForInput(selectedRequest.requested_clock_out),
        breakMinutes: selectedRequest.requested_break_minutes
      });
    }
    setIsModifyMode(!isModifyMode);
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';

    // Parse datetime string directly without timezone conversion
    // Expected format: "2025-08-26T07:30:00.000Z" or "2025-08-26 07:30:00"
    const cleanDateString = dateString.replace(' ', 'T').replace('.000Z', '');
    
    // Force local interpretation to avoid timezone conversion
    const year = parseInt(cleanDateString.substring(0, 4));
    const month = parseInt(cleanDateString.substring(5, 7)) - 1;
    const day = parseInt(cleanDateString.substring(8, 10));
    const hour = parseInt(cleanDateString.substring(11, 13) || '0');
    const minute = parseInt(cleanDateString.substring(14, 16) || '0');
    
    const localDate = new Date(year, month, day, hour, minute);
    
    return localDate.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDateTimeForInput = (dateString: string | null) => {
    if (!dateString) return '';

    // Parse datetime string directly without timezone conversion
    // Expected format: "2025-08-26T07:30:00.000Z" or "2025-08-26 07:30:00"
    const cleanDateString = dateString.replace(' ', 'T').replace('.000Z', '').substring(0, 16);
    
    
    return cleanDateString;
  };

  if (loading) return null;

  return (
    <>
      <div className={`${PAGE_STYLES.composites.panelContainer} p-8`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>Time Edit Requests</h3>
          <span className={`px-3 py-1 rounded-full font-semibold ${
            pendingRequests.length > 0
              ? `${MODULE_COLORS.timeTracking.light} ${MODULE_COLORS.timeTracking.text}`
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
                  <td className={`py-3 px-2 text-sm ${PAGE_STYLES.panel.text}`}>
                    <div>
                      <p>In: {formatDateTime(request.original_clock_in)}</p>
                      <p>Out: {formatDateTime(request.original_clock_out)}</p>
                      <p>Break: {request.original_break_minutes} min</p>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-sm">
                    {request.request_type === 'delete' ? (
                      <div className="text-red-600 font-semibold">
                        <p>DELETE REQUEST</p>
                      </div>
                    ) : (
                      <div className={MODULE_COLORS.timeTracking.text}>
                        <p>In: {formatDateTime(request.requested_clock_in)}</p>
                        <p>Out: {formatDateTime(request.requested_clock_out)}</p>
                        <p>Break: {request.requested_break_minutes} min</p>
                      </div>
                    )}
                  </td>
                  <td className={`py-3 px-2 ${PAGE_STYLES.panel.text}`}>
                    <p className="text-sm">{request.reason}</p>
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
                      className={`${MODULE_COLORS.timeTracking.base} ${MODULE_COLORS.timeTracking.hover} text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors`}
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
            <p className={PAGE_STYLES.panel.textMuted}>No pending time edit requests</p>
            <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mt-2`}>Requests from staff will appear here for approval</p>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${PAGE_STYLES.panel.background} rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto border ${PAGE_STYLES.panel.border}`}>
            <h3 className={`text-2xl font-bold ${PAGE_STYLES.panel.text} mb-6`}>
              Review Time {selectedRequest.request_type === 'delete' ? 'Delete' : 'Edit'} Request
            </h3>

            <div className="space-y-4 mb-6">
              <div className={`${PAGE_STYLES.header.background} p-4 rounded-lg border ${PAGE_STYLES.panel.border}`}>
                <h4 className={`font-semibold ${PAGE_STYLES.panel.text} mb-2`}>Employee</h4>
                <p className={PAGE_STYLES.panel.text}>{selectedRequest.first_name} {selectedRequest.last_name} (@{selectedRequest.username})</p>
              </div>

              {selectedRequest.request_type === 'delete' ? (
                <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                  <h4 className="font-semibold text-red-700 mb-2">Entry to be Deleted</h4>
                  <p className="text-sm text-red-800">In: {formatDateTime(selectedRequest.original_clock_in)}</p>
                  <p className="text-sm text-red-800">Out: {formatDateTime(selectedRequest.original_clock_out)}</p>
                  <p className="text-sm text-red-800">Break: {selectedRequest.original_break_minutes} min</p>
                  <p className="text-red-600 font-semibold mt-2">⚠️ This entry will be permanently marked as deleted</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className={`${PAGE_STYLES.header.background} p-4 rounded-lg border ${PAGE_STYLES.panel.border}`}>
                    <h4 className={`font-semibold ${PAGE_STYLES.panel.text} mb-2`}>Original Times</h4>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>In: {formatDateTime(selectedRequest.original_clock_in)}</p>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>Out: {formatDateTime(selectedRequest.original_clock_out)}</p>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>Break: {selectedRequest.original_break_minutes} min</p>
                  </div>

                  <div className={`${MODULE_COLORS.timeTracking.light} p-4 rounded-lg border ${MODULE_COLORS.timeTracking.border}`}>
                    <h4 className={`font-semibold ${MODULE_COLORS.timeTracking.text} mb-2`}>Requested Times</h4>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>In: {formatDateTime(selectedRequest.requested_clock_in)}</p>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>Out: {formatDateTime(selectedRequest.requested_clock_out)}</p>
                    <p className={`text-sm ${PAGE_STYLES.panel.text}`}>Break: {selectedRequest.requested_break_minutes} min</p>
                  </div>
                </div>
              )}

              <div className={`${PAGE_STYLES.header.background} p-4 rounded-lg border ${PAGE_STYLES.panel.border}`}>
                <h4 className={`font-semibold ${PAGE_STYLES.panel.text} mb-2`}>Reason</h4>
                <p className={PAGE_STYLES.panel.text}>{selectedRequest.reason}</p>
              </div>
              
              {selectedRequest.request_type !== 'delete' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className={`font-semibold ${PAGE_STYLES.panel.text}`}>Requested Times</h4>
                    <button
                    type="button"
                    onClick={handleModifyToggle}
                    className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                      isModifyMode
                        ? `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border}`
                        : `${MODULE_COLORS.timeTracking.base} ${MODULE_COLORS.timeTracking.hover} text-white`
                    }`}
                  >
                    {isModifyMode ? 'Reset' : 'Modify'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Clock In</label>
                    <input
                      type="datetime-local"
                      value={modifiedValues.clockIn || formatDateTimeForInput(selectedRequest.requested_clock_in)}
                      onChange={(e) => setModifiedValues({...modifiedValues, clockIn: e.target.value})}
                      disabled={!isModifyMode}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 text-sm ${
                        isModifyMode
                          ? `${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} focus:ring-yellow-500`
                          : 'bg-gray-200 cursor-not-allowed text-gray-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Clock Out</label>
                    <input
                      type="datetime-local"
                      value={modifiedValues.clockOut || formatDateTimeForInput(selectedRequest.requested_clock_out)}
                      onChange={(e) => setModifiedValues({...modifiedValues, clockOut: e.target.value})}
                      disabled={!isModifyMode}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 text-sm ${
                        isModifyMode
                          ? `${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} focus:ring-yellow-500`
                          : 'bg-gray-200 cursor-not-allowed text-gray-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Break Minutes</label>
                  <input
                    type="number"
                    min={0}
                    max={480}
                    value={modifiedValues.breakMinutes !== undefined ? modifiedValues.breakMinutes : selectedRequest.requested_break_minutes}
                    onChange={(e) => setModifiedValues({
                      ...modifiedValues,
                      breakMinutes: Number(e.target.value)
                    })}
                    disabled={!isModifyMode}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 text-sm ${
                      isModifyMode
                        ? `${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} focus:ring-yellow-500`
                        : 'bg-gray-200 cursor-not-allowed text-gray-600'
                      }`}
                    />
                  </div>
                </div>
                {isModifyMode && (
                  <p className={`text-sm ${MODULE_COLORS.timeTracking.text} mt-2`}>💡 Modify the times above, then click Approve to save changes</p>
                )}
                </div>
              )}

              <div>
                <label className={`block text-sm font-semibold ${PAGE_STYLES.panel.text} mb-2`}>Reviewer Notes</label>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  className={`w-full px-3 py-2 border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-500`}
                  rows={3}
                  placeholder="Optional notes about this decision..."
                />
              </div>
            </div>

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

export default TimeApprovals;
