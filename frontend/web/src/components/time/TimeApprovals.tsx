import React, { useState, useEffect } from 'react';

interface TimeApprovalsProps {
  user: any;
}

function TimeApprovals({ user }: TimeApprovalsProps) {
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [modifiedValues, setModifiedValues] = useState<any>({});
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isModifyMode, setIsModifyMode] = useState(false);

  // Helper function to handle logout on auth failure
  const handleAuthFailure = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.reload();
  };

  // Helper function to make authenticated requests
  const makeAuthenticatedRequest = async (url: string, options: any = {}) => {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      handleAuthFailure();
      return new Response('', { status: 401 });
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Handle authentication and authorization errors differently
    if (response.status === 401) {
      alert('Your session has expired. Please log in again.');
      handleAuthFailure();
      return new Response('', { status: 401 });
    } else if (response.status === 403) {
      alert('Insufficient permissions for this operation.');
      // Don't logout on 403 - just show error
      return response;
    }

    return response;
  };

  const fetchPendingRequests = async () => {
    try {
      const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/time/pending-requests');
      
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const handleProcessRequest = async (action: 'approve' | 'reject') => {
    try {
      console.log('🔵 APPROVAL DEBUG - Starting process request');
      console.log('📝 Selected Request:', selectedRequest);
      console.log('🔧 Is Modify Mode:', isModifyMode);
      console.log('🔧 Modified Values:', modifiedValues);
      console.log('🔧 Modified Values Keys:', Object.keys(modifiedValues));
      console.log('🔧 Original Action:', action);

      const body: any = {
        request_id: selectedRequest.request_id,
        action: isModifyMode ? 'modify' : action,
        reviewer_notes: reviewerNotes
      };

      // Only send modified values if we're actually in modify mode
      if (isModifyMode) {
        console.log('✏️ MODIFY MODE: Adding modified values to body');
        body.modified_clock_in = modifiedValues.clockIn || formatDateTimeForInput(selectedRequest.requested_clock_in);
        body.modified_clock_out = modifiedValues.clockOut || formatDateTimeForInput(selectedRequest.requested_clock_out);
        body.modified_break_minutes = modifiedValues.breakMinutes !== undefined ? parseInt(modifiedValues.breakMinutes) : selectedRequest.requested_break_minutes;
        
        console.log('🔄 MODIFY VALUES BEING SENT:');
        console.log('   Original requested_clock_in:', selectedRequest.requested_clock_in);
        console.log('   Modified clock_in being sent:', body.modified_clock_in);
        console.log('   Original requested_clock_out:', selectedRequest.requested_clock_out);
        console.log('   Modified clock_out being sent:', body.modified_clock_out);
        console.log('   Modified break minutes:', body.modified_break_minutes);
      } else {
        console.log('✅ CLEAN APPROVAL: No modified values being sent (as expected)');
      }

      console.log('📤 Final request body being sent:', body);

      const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/time/process-request', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const actionPastTense = body.action === 'modify' ? 'modified' : body.action === 'approve' ? 'approved' : 'rejected';
        alert(`Request ${actionPastTense} successfully!`);
        // FIXED: Clear all state properly
        setShowApprovalModal(false);
        setSelectedRequest(null);
        setModifiedValues({}); // Clear modified values
        setReviewerNotes('');
        setIsModifyMode(false);
        console.log('✅ SUCCESS: All state cleared, refreshing requests');
        fetchPendingRequests();
      } else {
        const errorData = await res.json();
        alert(`Error processing request: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      alert('Error processing request. Please try again.');
    }
  };

  const handleModifyToggle = () => {
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

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    
    // Parse datetime string directly without timezone conversion
    // Expected format: "2025-08-26T07:30:00.000Z" or "2025-08-26 07:30:00"
    const cleanDateString = dateString.replace(' ', 'T').replace('.000Z', '');
    const date = new Date(cleanDateString + (cleanDateString.includes('T') ? '' : 'T00:00:00'));
    
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

  const formatDateTimeForInput = (dateString: string) => {
    if (!dateString) return '';
    
    // Parse datetime string directly without timezone conversion
    // Expected format: "2025-08-26T07:30:00.000Z" or "2025-08-26 07:30:00"
    const cleanDateString = dateString.replace(' ', 'T').replace('.000Z', '').substring(0, 16);
    
    console.log('🕐 TIMEZONE FIX: formatDateTimeForInput');
    console.log('   Input (from DB):', dateString);
    console.log('   Direct formatted output:', cleanDateString);
    
    return cleanDateString;
  };

  if (loading) return null;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8 mt-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800">Time Edit Requests</h3>
          <span className={`px-3 py-1 rounded-full font-semibold ${
            pendingRequests.length > 0 
              ? 'bg-yellow-100 text-yellow-800' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {pendingRequests.length} Pending
          </span>
        </div>
        
        {pendingRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Employee</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Original</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Requested</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Reason</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((request) => (
                <tr key={request.request_id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <div>
                      <p className="font-semibold">{request.first_name} {request.last_name}</p>
                      <p className="text-sm text-gray-500">@{request.username}</p>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-sm">
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
                      <div>
                        <p className="text-primary-blue">In: {formatDateTime(request.requested_clock_in)}</p>
                        <p className="text-primary-blue">Out: {formatDateTime(request.requested_clock_out)}</p>
                        <p className="text-primary-blue">Break: {request.requested_break_minutes} min</p>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <p className="text-sm">{request.reason}</p>
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowApprovalModal(true);
                      }}
                      className="bg-primary-blue hover:bg-primary-blue-dark text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
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
            <p className="text-gray-500">No pending time edit requests</p>
            <p className="text-sm text-gray-400 mt-2">Requests from staff will appear here for approval</p>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Review Time {selectedRequest.request_type === 'delete' ? 'Delete' : 'Edit'} Request
            </h3>
            
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-700 mb-2">Employee</h4>
                <p>{selectedRequest.first_name} {selectedRequest.last_name} (@{selectedRequest.username})</p>
              </div>
              
              {selectedRequest.request_type === 'delete' ? (
                <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                  <h4 className="font-semibold text-red-700 mb-2">Entry to be Deleted</h4>
                  <p className="text-sm">In: {formatDateTime(selectedRequest.original_clock_in)}</p>
                  <p className="text-sm">Out: {formatDateTime(selectedRequest.original_clock_out)}</p>
                  <p className="text-sm">Break: {selectedRequest.original_break_minutes} min</p>
                  <p className="text-red-600 font-semibold mt-2">⚠️ This entry will be permanently marked as deleted</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-700 mb-2">Original Times</h4>
                    <p className="text-sm">In: {formatDateTime(selectedRequest.original_clock_in)}</p>
                    <p className="text-sm">Out: {formatDateTime(selectedRequest.original_clock_out)}</p>
                    <p className="text-sm">Break: {selectedRequest.original_break_minutes} min</p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-primary-blue mb-2">Requested Times</h4>
                    <p className="text-sm">In: {formatDateTime(selectedRequest.requested_clock_in)}</p>
                    <p className="text-sm">Out: {formatDateTime(selectedRequest.requested_clock_out)}</p>
                    <p className="text-sm">Break: {selectedRequest.requested_break_minutes} min</p>
                  </div>
                </div>
              )}
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-700 mb-2">Reason</h4>
                <p>{selectedRequest.reason}</p>
              </div>
              
              {selectedRequest.request_type !== 'delete' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-gray-700">Requested Times</h4>
                    <button
                    type="button"
                    onClick={handleModifyToggle}
                    className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                      isModifyMode 
                        ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                        : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    }`}
                  >
                    {isModifyMode ? 'Reset' : 'Modify'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Clock In</label>
                    <input
                      type="datetime-local"
                      value={modifiedValues.clockIn || formatDateTimeForInput(selectedRequest.requested_clock_in)}
                      onChange={(e) => setModifiedValues({...modifiedValues, clockIn: e.target.value})}
                      disabled={!isModifyMode}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                        isModifyMode 
                          ? 'border-gray-300 focus:ring-primary-blue bg-white' 
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Clock Out</label>
                    <input
                      type="datetime-local"
                      value={modifiedValues.clockOut || formatDateTimeForInput(selectedRequest.requested_clock_out)}
                      onChange={(e) => setModifiedValues({...modifiedValues, clockOut: e.target.value})}
                      disabled={!isModifyMode}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                        isModifyMode 
                          ? 'border-gray-300 focus:ring-primary-blue bg-white' 
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Break Minutes</label>
                    <input
                      type="number"
                      value={modifiedValues.breakMinutes !== undefined ? modifiedValues.breakMinutes : selectedRequest.requested_break_minutes}
                      onChange={(e) => setModifiedValues({...modifiedValues, breakMinutes: e.target.value})}
                      disabled={!isModifyMode}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                        isModifyMode 
                          ? 'border-gray-300 focus:ring-primary-blue bg-white' 
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    />
                  </div>
                </div>
                {isModifyMode && (
                  <p className="text-sm text-blue-600 mt-2">💡 Modify the times above, then click Approve to save changes</p>
                )}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reviewer Notes</label>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
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
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
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