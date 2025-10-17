import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectMultipleEntries } from '../../../lib/timeUtils';
import { timeApi, authApi } from '../../../services/api';
import type {
  ViewMode,
  FilterStatus,
  TimeEntry,
  WeeklySummary,
  AnalyticsData,
  MissingEntry,
  TimeUser,
  BulkEditValues
} from '../../../types/time';

interface UseTimeManagementContainerProps {
  user: TimeUser;
}

export const useTimeManagementContainer = ({ user }: UseTimeManagementContainerProps) => {
  const navigate = useNavigate();
  
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState<'single' | 'range'>('single');
  const [displayStartDate, setDisplayStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [displayEndDate, setDisplayEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [missingEntries, setMissingEntries] = useState<MissingEntry[]>([]);
  const [users, setUsers] = useState<TimeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    clock_in: string;
    clock_out: string;
    break_minutes: number;
  }>({ clock_in: '', clock_out: '', break_minutes: 0 });
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState<BulkEditValues>({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showScheduleManagement, setShowScheduleManagement] = useState(false);
  
  const fetchUsers = useCallback(async () => {
    try {
      const data: TimeUser[] = await authApi.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);
  
  const fetchTimeEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data: { entries?: TimeEntry[] } | TimeEntry[] = await timeApi.getEntries({
        startDate: selectedDate,
        endDate: dateRange === 'range' ? endDate : selectedDate,
        status: filterStatus,
        group: selectedGroup,
        search: searchTerm
      });

      // Handle dual response format: Array OR {entries: Array}
      const entries = Array.isArray(data) ? data : data.entries || [];
      const entriesWithWarnings = detectMultipleEntries(entries);
      setTimeEntries(entriesWithWarnings);
    } catch (error) {
      console.error('Error fetching time entries:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, endDate, dateRange, filterStatus, selectedGroup, searchTerm]);
  
  const fetchWeeklySummary = useCallback(async () => {
    setLoading(true);
    try {
      // Use the date range selected by the user (via dateRange filters or Quick Select)
      const startDateParam = selectedDate;
      const endDateParam = dateRange === 'range' ? endDate : selectedDate;

      // Update display dates for UI
      setDisplayStartDate(startDateParam);
      setDisplayEndDate(endDateParam);

      const data: WeeklySummary[] = await timeApi.getWeeklySummary({
        startDate: startDateParam,
        endDate: endDateParam,
        group: selectedGroup
      });
      setWeeklySummary(data);
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedDate, endDate, selectedGroup]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const data: AnalyticsData = await timeApi.getAnalyticsOverview({
        startDate: selectedDate,
        endDate: dateRange === 'range' ? endDate : selectedDate,
        group: selectedGroup
      });
      setAnalyticsData(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, endDate, dateRange, selectedGroup]);

  const fetchMissingEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data: MissingEntry[] = await timeApi.getMissingEntries({
        startDate: selectedDate,
        endDate: dateRange === 'range' ? endDate : selectedDate,
        group: selectedGroup
      });
      setMissingEntries(data);
    } catch (error) {
      console.error('Error fetching missing entries:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, endDate, dateRange, selectedGroup]);

  // Check if user has access
  useEffect(() => {
    if (user?.role !== 'manager' && user?.role !== 'owner') {
      navigate('/dashboard');
    }
  }, [user, navigate]);
  
  // Fetch users list
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Auto-update endDate when in calendar mode (2-week range)
  useEffect(() => {
    if (viewMode === 'calendar') {
      const start = new Date(selectedDate + 'T12:00:00');
      const end = new Date(start);
      end.setDate(start.getDate() + 13); // 2 weeks = 14 days (0-13)
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [viewMode, selectedDate]);

  useEffect(() => {
    if (viewMode === 'single') {
      fetchTimeEntries();
    } else if (viewMode === 'summary') {
      fetchWeeklySummary();
    } else if (viewMode === 'analytics') {
      fetchAnalytics();
    } else if (viewMode === 'missing') {
      fetchMissingEntries();
    }
  }, [viewMode, fetchTimeEntries, fetchWeeklySummary, fetchAnalytics, fetchMissingEntries]);

  const addMissingEntry = async (missingEntry: MissingEntry) => {
    const clockInTime = prompt(`Add time entry for ${missingEntry.first_name} ${missingEntry.last_name} on ${new Date(missingEntry.missing_date + 'T12:00:00').toLocaleDateString()}.\n\nClock in time (HH:MM format):`, missingEntry.expected_start);
    const clockOutTime = prompt(`Clock out time (HH:MM format):`, missingEntry.expected_end);

    if (!clockInTime || !clockOutTime) {
      alert('Both clock in and clock out times are required');
      return;
    }

    const breakInput = prompt('Break minutes (0-480):', '30');
    const breakMinutes = Number(breakInput ?? 0);
    if (Number.isNaN(breakMinutes)) {
      alert('Invalid break minutes. Please try again.');
      return;
    }

    try {
      await timeApi.createEntry({
        user_id: missingEntry.user_id,
        date: missingEntry.missing_date,
        clock_in: `${missingEntry.missing_date} ${clockInTime}:00`,
        clock_out: `${missingEntry.missing_date} ${clockOutTime}:00`,
        break_minutes: breakMinutes
      });

      alert('Time entry added successfully');
      setMissingEntries([]);
      setTimeout(() => {
        fetchMissingEntries();
        if (viewMode === 'single') {
          fetchTimeEntries();
        }
      }, 100);
    } catch (error) {
      console.error('Error adding time entry:', error);
      alert('Error adding time entry');
    }
  };
  
  const markExcused = async (missingEntry: MissingEntry) => {
    const reason = prompt(`Mark ${missingEntry.first_name} ${missingEntry.last_name} as excused for ${new Date(missingEntry.missing_date + 'T12:00:00').toLocaleDateString()}.\n\nReason (optional):`);

    try {
      await timeApi.createEntry({
        user_id: missingEntry.user_id,
        date: missingEntry.missing_date,
        clock_in: `${missingEntry.missing_date} 12:00:00`,
        clock_out: `${missingEntry.missing_date} 12:00:00`,
        break_minutes: 0
      });

      alert('Marked as excused');
      setMissingEntries([]);
      setTimeout(() => {
        fetchMissingEntries();
      }, 100);
    } catch (error) {
      console.error('Error marking as excused:', error);
      alert('Error marking as excused');
    }
  };

  // Return all state and functions needed by the component
  return {
    // State
    viewMode,
    selectedDate,
    endDate,
    dateRange,
    selectedGroup,
    filterStatus,
    timeEntries,
    weeklySummary,
    analyticsData,
    missingEntries,
    users,
    loading,
    selectedEntries,
    searchTerm,
    editingEntry,
    editValues,
    showBulkEditModal,
    bulkEditValues,
    showExportMenu,
    showScheduleManagement,
    displayStartDate,
    displayEndDate,
    
    // Setters
    setViewMode,
    setSelectedDate,
    setEndDate,
    setDateRange,
    setSelectedGroup,
    setFilterStatus,
    setTimeEntries,
    setWeeklySummary,
    setAnalyticsData,
    setMissingEntries,
    setUsers,
    setLoading,
    setSelectedEntries,
    setSearchTerm,
    setEditingEntry,
    setEditValues,
    setShowBulkEditModal,
    setBulkEditValues,
    setShowExportMenu,
    setShowScheduleManagement,
    
    // API functions
    fetchUsers,
    fetchTimeEntries,
    fetchWeeklySummary,
    fetchAnalytics,
    fetchMissingEntries,
    addMissingEntry,
    markExcused,
  };
};
