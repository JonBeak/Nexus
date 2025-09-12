import React, { useState, useEffect } from 'react';
import TimeClockDisplay from './TimeClockDisplay';
import WeeklySummary from './WeeklySummary';
import EditRequestForm from './EditRequestForm';
import NotificationsModal from './NotificationsModal';

interface TimeTrackingProps {
  user: any;
}

function TimeTracking({ user }: TimeTrackingProps) {
  console.log('TimeTracking component loaded for user:', user.username);
  const [clockStatus, setClockStatus] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editRequest, setEditRequest] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showClearedNotifications, setShowClearedNotifications] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<any>(null);

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

  // Fetch clock status and weekly data
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      // Fetch clock status
      const statusRes = await fetch('http://192.168.2.14:3001/api/time/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setClockStatus(statusData);
      }

      // Fetch weekly summary
      const weekRes = await fetch(`http://192.168.2.14:3001/api/time/weekly-summary?weekOffset=${weekOffset}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (weekRes.ok) {
        const weekData = await weekRes.json();
        setWeeklyData(weekData);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching time data:', error);
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/time/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      const res = await makeAuthenticatedRequest(`http://192.168.2.14:3001/api/time/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => 
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        ));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/time/notifications/clear-all', {
        method: 'PUT'
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_cleared: true })));
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchNotifications();
  }, [weekOffset]);

  const handleClockIn = async () => {
    try {
      console.log('Clock in button clicked');
      const token = localStorage.getItem('access_token');
      console.log('Token exists:', !!token);
      console.log('Token value:', token ? token.substring(0, 20) + '...' : 'null');
      
      const res = await fetch('http://192.168.2.14:3001/api/time/clock-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);
      
      if (res.ok) {
        fetchData();
      } else {
        alert(`Error clocking in: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error clocking in:', error);
      alert('Error clocking in. Please try again.');
    }
  };

  const handleClockOut = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('http://192.168.2.14:3001/api/time/clock-out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      if (res.ok) {
        fetchData();
      } else {
        alert(`Error clocking out: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      alert('Error clocking out. Please try again.');
    }
  };

  const handleEditRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/time/edit-request', {
        method: 'POST',
        body: JSON.stringify({
          entry_id: selectedEntry.entry_id,
          requested_clock_in: editRequest.clockIn,
          requested_clock_out: editRequest.clockOut,
          requested_break_minutes: parseInt(editRequest.breakMinutes),
          reason: editRequest.reason
        })
      });
      
      if (res.ok) {
        alert('Edit request submitted successfully!');
        setShowEditModal(false);
        setEditRequest(null);
        setSelectedEntry(null);
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Error submitting request: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error submitting edit request:', error);
      alert('Error submitting edit request. Please try again.');
    }
  };

  const handleDeleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/time/delete-request', {
        method: 'POST',
        body: JSON.stringify({
          entry_id: selectedEntry.entry_id,
          reason: deleteRequest.reason
        })
      });
      
      if (res.ok) {
        alert('Delete request submitted successfully!');
        setShowDeleteModal(false);
        setDeleteRequest(null);
        setSelectedEntry(null);
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Error submitting delete request: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error submitting delete request:', error);
      alert('Error submitting delete request. Please try again.');
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    // Parse datetime string directly without timezone conversion
    // Expected format: "2025-08-26T07:30:00.000Z" or "2025-08-26 07:30:00"
    const cleanDateString = dateString.replace(' ', 'T').replace('.000Z', '').substring(0, 16);
    return cleanDateString;
  };

  const handleRequestEdit = (entry: any) => {
    setSelectedEntry(entry);
    setEditRequest({
      clockIn: formatDateTime(entry.clock_in),
      clockOut: formatDateTime(entry.clock_out),
      breakMinutes: entry.break_minutes || 0,
      reason: ''
    });
    setShowEditModal(true);
  };

  const handleRequestDelete = (entry: any) => {
    setSelectedEntry(entry);
    setDeleteRequest({
      reason: ''
    });
    setShowDeleteModal(true);
  };

  const handleWeekChange = (offset: number) => {
    setWeekOffset(offset);
  };

  const handleShowNotifications = () => {
    setShowNotifications(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditRequest(null);
    setSelectedEntry(null);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteRequest(null);
    setSelectedEntry(null);
  };

  const handleEditRequestChange = (field: string, value: any) => {
    setEditRequest((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleDeleteRequestChange = (field: string, value: any) => {
    setDeleteRequest((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <>
      <div className="space-y-6">
        <TimeClockDisplay 
          clockStatus={clockStatus}
          notifications={notifications}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
          onShowNotifications={handleShowNotifications}
        />

        <WeeklySummary 
          weeklyData={weeklyData}
          weekOffset={weekOffset}
          onWeekChange={handleWeekChange}
          onRequestEdit={handleRequestEdit}
          onRequestDelete={handleRequestDelete}
        />
      </div>

      <EditRequestForm 
        selectedEntry={selectedEntry}
        showEditModal={showEditModal}
        showDeleteModal={showDeleteModal}
        editRequest={editRequest}
        deleteRequest={deleteRequest}
        onCloseEdit={handleCloseEditModal}
        onCloseDelete={handleCloseDeleteModal}
        onEditRequest={handleEditRequest}
        onDeleteRequest={handleDeleteRequest}
        onEditRequestChange={handleEditRequestChange}
        onDeleteRequestChange={handleDeleteRequestChange}
      />

      <NotificationsModal 
        showNotifications={showNotifications}
        notifications={notifications}
        showClearedNotifications={showClearedNotifications}
        onClose={() => setShowNotifications(false)}
        onToggleCleared={() => setShowClearedNotifications(!showClearedNotifications)}
        onClearAll={clearAllNotifications}
        onMarkAsRead={markNotificationAsRead}
      />
    </>
  );
}

export default TimeTracking;