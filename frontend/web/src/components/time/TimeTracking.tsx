import React, { useState, useEffect, useCallback } from 'react';
import TimeClockDisplay from './TimeClockDisplay';
import WeeklySummary from './WeeklySummary';
import EditRequestForm from './EditRequestForm';
import NotificationsModal from './NotificationsModal';
import { timeApi } from '../../services/api';
import type {
  ClockStatus,
  WeeklyData,
  WeeklyEntry,
  EditRequestDraft,
  DeleteRequestDraft,
  TimeNotification
} from '../../types/time';

function TimeTracking() {
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editRequest, setEditRequest] = useState<EditRequestDraft | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WeeklyEntry | null>(null);
  const [notifications, setNotifications] = useState<TimeNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showClearedNotifications, setShowClearedNotifications] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequestDraft | null>(null);

  // Fetch clock status and weekly data
  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      // Fetch clock status
      try {
        const statusData: ClockStatus = await timeApi.getStatus();
        setClockStatus(statusData);
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }

      // Fetch weekly summary
      try {
        const weekData: WeeklyData = await timeApi.getWeeklySummaryAlt(weekOffset);
        setWeeklyData(weekData);
      } catch (error) {
        console.error('Failed to fetch weekly summary:', error);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching time data:', error);
      setLoading(false);
    }
  }, [weekOffset]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data: TimeNotification[] = await timeApi.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      await timeApi.markNotificationAsRead(notificationId);
      setNotifications(prev => prev.map(n =>
        n.notification_id === notificationId ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await timeApi.clearAllNotifications();
      setNotifications(prev => prev.map(n => ({ ...n, is_cleared: true })));
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchNotifications();
  }, [fetchData, fetchNotifications]);

  const handleClockIn = async () => {
    try {
      const data = await timeApi.clockIn();

      if (data.message && data.message.includes('successfully')) {
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
      const data = await timeApi.clockOut();

      if (data.message && data.message.includes('successfully')) {
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
    if (!selectedEntry || !editRequest) {
      return;
    }
    try {
      await timeApi.submitEditRequest({
        entry_id: selectedEntry.entry_id,
        requested_clock_in: editRequest.clockIn,
        requested_clock_out: editRequest.clockOut,
        requested_break_minutes: editRequest.breakMinutes,
        reason: editRequest.reason
      });

      alert('Edit request submitted successfully!');
      setShowEditModal(false);
      setEditRequest(null);
      setSelectedEntry(null);
      fetchData();
    } catch (error: any) {
      console.error('Error submitting edit request:', error);
      alert(`Error submitting request: ${error.response?.data?.error || 'Unknown error'}`);
    }
  };

  const handleDeleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || !deleteRequest) {
      return;
    }
    try {
      await timeApi.submitDeleteRequest({
        entry_id: selectedEntry.entry_id,
        reason: deleteRequest.reason
      });

      alert('Delete request submitted successfully!');
      setShowDeleteModal(false);
      setDeleteRequest(null);
      setSelectedEntry(null);
      fetchData();
    } catch (error: any) {
      console.error('Error submitting delete request:', error);
      alert(`Error submitting delete request: ${error.response?.data?.error || 'Unknown error'}`);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '';
    // Parse datetime string directly without timezone conversion
    // Expected format: "2025-08-26T07:30:00.000Z" or "2025-08-26 07:30:00"
    const cleanDateString = dateString.replace(' ', 'T').replace('.000Z', '').substring(0, 16);
    return cleanDateString;
  };

  const handleRequestEdit = (entry: WeeklyEntry) => {
    setSelectedEntry(entry);
    setEditRequest({
      clockIn: formatDateTime(entry.clock_in),
      clockOut: formatDateTime(entry.clock_out),
      breakMinutes: entry.break_minutes || 0,
      reason: ''
    });
    setShowEditModal(true);
  };

  const handleRequestDelete = (entry: WeeklyEntry) => {
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

  const handleEditRequestChange = <K extends keyof EditRequestDraft>(field: K, value: EditRequestDraft[K]) => {
    setEditRequest(prev => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleDeleteRequestChange = <K extends keyof DeleteRequestDraft>(field: K, value: DeleteRequestDraft[K]) => {
    setDeleteRequest(prev => (prev ? { ...prev, [field]: value } : prev));
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
