import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectMultipleEntries } from '../../../lib/timeUtils';
import type {
  ViewMode,
  FilterStatus,
  TimeEntry,
  WeeklySummary,
  AnalyticsData,
  MissingEntry
} from '../../../types/time';

interface UseTimeManagementContainerProps {
  user: any;
}

export const useTimeManagementContainer = ({ user }: UseTimeManagementContainerProps) => {
  const navigate = useNavigate();
  
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
      return new Response('', { status: 401 });
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // Only logout on authentication failures, not other errors
      if (response.status === 401) {
        alert('Your session has expired. Please log in again.');
        handleAuthFailure();
        return new Response('', { status: 401 });
      }

      return response;
    } catch (error) {
      console.error('Network error:', error);
      throw error;
    }
  };
  
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState<'single' | 'range'>('single');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [missingEntries, setMissingEntries] = useState<MissingEntry[]>([]);
  const [users, setUsers] = useState<any[]>([]);
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
  const [bulkEditValues, setBulkEditValues] = useState<{
    clock_in?: string;
    clock_out?: string;
    break_minutes?: number;
  }>({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showScheduleManagement, setShowScheduleManagement] = useState(false);
  
  // Check if user has access
  useEffect(() => {
    if (user?.role !== 'manager' && user?.role !== 'owner') {
      navigate('/dashboard');
    }
  }, [user, navigate]);
  
  // Fetch users list
  useEffect(() => {
    fetchUsers();
  }, []);
  
  useEffect(() => {
    if (viewMode === 'single') {
      fetchTimeEntries();
    } else if (viewMode === 'weekly') {
      fetchWeeklySummary();
    } else if (viewMode === 'bi-weekly') {
      fetchWeeklySummary(); // Reuse weekly summary logic for bi-weekly
    } else if (viewMode === 'monthly' || viewMode === 'quarterly' || viewMode === 'semi-yearly' || viewMode === 'yearly') {
      fetchWeeklySummary(); // Reuse weekly summary logic for longer periods
    } else if (viewMode === 'analytics') {
      fetchAnalytics();
    } else if (viewMode === 'missing') {
      fetchMissingEntries();
    }
  }, [viewMode, selectedDate, endDate, dateRange, selectedGroup, filterStatus, searchTerm]);
  
  // Helper functions for date calculations
  const getSaturdayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const daysToSaturday = (6 - dayOfWeek) % 7;
    const saturday = new Date(date);
    saturday.setDate(date.getDate() - daysToSaturday - 7); // Previous Saturday to get Saturday-Friday week
    return saturday.toISOString().split('T')[0];
  };

  const getFridayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const daysToFriday = (5 - dayOfWeek + 7) % 7;
    const friday = new Date(date);
    friday.setDate(date.getDate() + daysToFriday);
    if (dayOfWeek === 6) { // If it's Saturday, get next Friday
      friday.setDate(date.getDate() + 6);
    }
    return friday.toISOString().split('T')[0];
  };

  const fetchUsers = async () => {
    try {
      const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };
  
  const fetchTimeEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: selectedDate,
        endDate: dateRange === 'range' ? endDate : selectedDate,
        status: filterStatus,
        group: selectedGroup,
        search: searchTerm
      });
      
      const res = await makeAuthenticatedRequest(
        `http://192.168.2.14:3001/api/time-management/entries?${params}`
      );
      
      if (res.ok) {
        const data = await res.json();
        // Group by user and date to detect multiple entries
        const entriesWithWarnings = detectMultipleEntries(data.entries || data);
        setTimeEntries(entriesWithWarnings);
      }
    } catch (error) {
      console.error('Error fetching time entries:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchWeeklySummary = async () => {
    setLoading(true);
    try {
      let startDateParam, endDateParam;
      
      if (dateRange === 'range') {
        startDateParam = selectedDate;
        endDateParam = endDate;
      } else {
        // Calculate date ranges based on view mode
        const currentDate = new Date(selectedDate + 'T12:00:00');
        
        if (viewMode === 'weekly') {
          startDateParam = getSaturdayOfWeek(selectedDate);
          endDateParam = getFridayOfWeek(selectedDate);
        } else if (viewMode === 'bi-weekly') {
          const weekStartSat = getSaturdayOfWeek(selectedDate);
          const biWeekStart = new Date(weekStartSat + 'T12:00:00');
          biWeekStart.setDate(biWeekStart.getDate() - 7);
          startDateParam = biWeekStart.toISOString().split('T')[0];
          endDateParam = getFridayOfWeek(selectedDate);
        } else if (viewMode === 'monthly') {
          const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          startDateParam = monthStart.toISOString().split('T')[0];
          endDateParam = monthEnd.toISOString().split('T')[0];
        } else if (viewMode === 'quarterly') {
          const quarter = Math.floor(currentDate.getMonth() / 3);
          const quarterStart = new Date(currentDate.getFullYear(), quarter * 3, 1);
          const quarterEnd = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);
          startDateParam = quarterStart.toISOString().split('T')[0];
          endDateParam = quarterEnd.toISOString().split('T')[0];
        } else if (viewMode === 'semi-yearly') {
          const half = currentDate.getMonth() < 6 ? 0 : 1;
          const halfStart = new Date(currentDate.getFullYear(), half * 6, 1);
          const halfEnd = new Date(currentDate.getFullYear(), half * 6 + 6, 0);
          startDateParam = halfStart.toISOString().split('T')[0];
          endDateParam = halfEnd.toISOString().split('T')[0];
        } else if (viewMode === 'yearly') {
          const yearStart = new Date(currentDate.getFullYear(), 0, 1);
          const yearEnd = new Date(currentDate.getFullYear(), 11, 31);
          startDateParam = yearStart.toISOString().split('T')[0];
          endDateParam = yearEnd.toISOString().split('T')[0];
        } else {
          startDateParam = selectedDate;
          endDateParam = selectedDate;
        }
      }
      
      const params = new URLSearchParams({
        startDate: startDateParam,
        endDate: endDateParam,
        group: selectedGroup
      });
      
      const res = await makeAuthenticatedRequest(
        `http://192.168.2.14:3001/api/time-management/weekly-summary?${params}`
      );
      
      if (res.ok) {
        const data = await res.json();
        setWeeklySummary(data);
      }
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: selectedDate,
        endDate: dateRange === 'range' ? endDate : selectedDate,
        group: selectedGroup
      });
      
      const res = await makeAuthenticatedRequest(
        `http://192.168.2.14:3001/api/time-management/analytics-overview?${params}`
      );
      
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMissingEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: selectedDate,
        endDate: dateRange === 'range' ? endDate : selectedDate,
        group: selectedGroup
      });
      
      const res = await makeAuthenticatedRequest(
        `http://192.168.2.14:3001/api/time-management/missing-entries?${params}`
      );
      
      if (res.ok) {
        const data = await res.json();
        setMissingEntries(data);
      }
    } catch (error) {
      console.error('Error fetching missing entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMissingEntry = async (missingEntry: any) => {
    const clockInTime = prompt(`Add time entry for ${missingEntry.first_name} ${missingEntry.last_name} on ${new Date(missingEntry.missing_date + 'T12:00:00').toLocaleDateString()}.\n\nClock in time (HH:MM format):`, missingEntry.expected_start);
    const clockOutTime = prompt(`Clock out time (HH:MM format):`, missingEntry.expected_end);
    
    if (!clockInTime || !clockOutTime) {
      alert('Both clock in and clock out times are required');
      return;
    }
    
    const breakMinutes = Number(prompt('Break minutes (0-480):', '30') || 0);
    
    try {
      const res = await makeAuthenticatedRequest(
        'http://192.168.2.14:3001/api/time-management/entries',
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: missingEntry.user_id,
            clock_in: `${missingEntry.missing_date} ${clockInTime}:00`,
            clock_out: `${missingEntry.missing_date} ${clockOutTime}:00`,
            break_minutes: breakMinutes,
            notes: 'Added from missing entries',
            status: 'completed'
          })
        }
      );
      
      if (res.ok) {
        alert('Time entry added successfully');
        setMissingEntries([]);
        setTimeout(() => {
          fetchMissingEntries();
          if (viewMode === 'single') {
            fetchTimeEntries();
          }
        }, 100);
      } else {
        alert('Failed to add time entry');
      }
    } catch (error) {
      console.error('Error adding time entry:', error);
      alert('Error adding time entry');
    }
  };
  
  const markExcused = async (missingEntry: any) => {
    const reason = prompt(`Mark ${missingEntry.first_name} ${missingEntry.last_name} as excused for ${new Date(missingEntry.missing_date + 'T12:00:00').toLocaleDateString()}.\n\nReason (optional):`);
    
    try {
      const res = await makeAuthenticatedRequest(
        'http://192.168.2.14:3001/api/time-management/entries',
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: missingEntry.user_id,
            clock_in: `${missingEntry.missing_date} 12:00:00`,
            clock_out: `${missingEntry.missing_date} 12:00:00`,
            break_minutes: 0,
            notes: reason ? `Excused: ${reason}` : 'Excused absence',
            status: 'completed'
          })
        }
      );
      
      if (res.ok) {
        alert('Marked as excused');
        setMissingEntries([]);
        setTimeout(() => {
          fetchMissingEntries();
        }, 100);
      } else {
        alert('Failed to mark as excused');
      }
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
    makeAuthenticatedRequest,
    addMissingEntry,
    markExcused,
    
    // Helper functions
    handleAuthFailure
  };
};