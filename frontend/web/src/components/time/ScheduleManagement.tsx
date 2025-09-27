import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Plus, Save, X } from 'lucide-react';
import type { TimeUser, AuthenticatedRequest } from '../../types/time';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface WorkSchedule {
  schedule_id?: number;
  user_id: number;
  day_of_week: string;
  is_work_day: boolean;
  expected_start_time: string | null;
  expected_end_time: string | null;
}

interface Holiday {
  holiday_id: number;
  holiday_name: string;
  holiday_date: string;
  is_active: boolean;
}

interface ScheduleManagementProps {
  onClose: () => void;
}

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'schedules' | 'holidays'>('schedules');
  const [users, setUsers] = useState<TimeUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '' });

  // Helper function to make authenticated requests
  const makeAuthenticatedRequest: AuthenticatedRequest = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem('access_token');
    const headers = new Headers(options.headers ?? {});
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, {
      ...options,
      headers,
    });
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/auth/users');
      if (res.ok) {
        const data: TimeUser[] = await res.json();
        setUsers(data);
        if (data.length > 0) {
          setSelectedUser(data[0].user_id);
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [makeAuthenticatedRequest]);
 
  const fetchSchedules = useCallback(async (userId: number) => {
    try {
      const res = await makeAuthenticatedRequest(
        `http://192.168.2.14:3001/api/time-management/schedules/${userId}`
      );
      if (res.ok) {
        const data: WorkSchedule[] = await res.json();
        
        // Create default schedule if none exists
        if (data.length === 0) {
          const defaultSchedule = DAYS_OF_WEEK.map(day => ({
            user_id: userId,
            day_of_week: day,
            is_work_day: !['Saturday', 'Sunday'].includes(day),
            expected_start_time: '09:00',
            expected_end_time: '17:00'
          }));
          setSchedules(defaultSchedule);
        } else {
          setSchedules(data);
        }
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  }, [makeAuthenticatedRequest]);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await makeAuthenticatedRequest('http://192.168.2.14:3001/api/time-management/holidays');
      if (res.ok) {
        const data: Holiday[] = await res.json();
        setHolidays(data);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  }, [makeAuthenticatedRequest]);

  useEffect(() => {
    fetchUsers();
    fetchHolidays();
  }, [fetchUsers, fetchHolidays]);

  useEffect(() => {
    if (selectedUser) {
      fetchSchedules(selectedUser);
    }
  }, [selectedUser, fetchSchedules]);

  const saveSchedules = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    try {
      const res = await makeAuthenticatedRequest(
        `http://192.168.2.14:3001/api/time-management/schedules/${selectedUser}`,
        {
          method: 'PUT',
          body: JSON.stringify({ schedules })
        }
      );
      
      if (res.ok) {
        alert('Schedule saved successfully!');
      } else {
        alert('Failed to save schedule');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Error saving schedule');
    } finally {
      setLoading(false);
    }
  };

  const addHoliday = async (overwrite = false) => {
    if (!newHoliday.name || !newHoliday.date) return;
    
    try {
      const res = await makeAuthenticatedRequest(
        'http://192.168.2.14:3001/api/time-management/holidays',
        {
          method: 'POST',
          body: JSON.stringify({
            holiday_name: newHoliday.name,
            holiday_date: newHoliday.date,
            overwrite
          })
        }
      );
      
      if (res.ok) {
        setNewHoliday({ name: '', date: '' });
        fetchHolidays();
      } else if (res.status === 409) {
        // Conflict - holiday already exists
        const data = await res.json();
        const existingHoliday = data.existing_holiday;
        const confirmOverwrite = confirm(
          `A holiday "${existingHoliday.holiday_name}" already exists on ${new Date(existingHoliday.holiday_date).toLocaleDateString()}.\n\nDo you want to overwrite it with "${newHoliday.name}"?`
        );
        
        if (confirmOverwrite) {
          // Retry with overwrite flag
          await addHoliday(true);
        }
      } else {
        alert('Failed to add holiday');
      }
    } catch (error) {
      console.error('Error adding holiday:', error);
      alert('Error adding holiday');
    }
  };

  const removeHoliday = async (holidayId: number) => {
    if (!confirm('Are you sure you want to remove this holiday?')) return;
    
    try {
      const res = await makeAuthenticatedRequest(
        `http://192.168.2.14:3001/api/time-management/holidays/${holidayId}`,
        { method: 'DELETE' }
      );
      
      if (res.ok) {
        fetchHolidays();
      } else {
        alert('Failed to remove holiday');
      }
    } catch (error) {
      console.error('Error removing holiday:', error);
    }
  };

  const exportHolidays = async () => {
    try {
      const res = await makeAuthenticatedRequest(
        'http://192.168.2.14:3001/api/time-management/holidays/export'
      );
      
      if (res.ok) {
        const csvData = await res.text();
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'company_holidays.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to export holidays');
      }
    } catch (error) {
      console.error('Error exporting holidays:', error);
      alert('Error exporting holidays');
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const csvData = await file.text();
      await importHolidays(csvData);
      
      // Reset the file input
      event.target.value = '';
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file');
    }
  };

  const importHolidays = async (csvData: string, overwriteAll = false) => {
    try {
      const res = await makeAuthenticatedRequest(
        'http://192.168.2.14:3001/api/time-management/holidays/import',
        {
          method: 'POST',
          body: JSON.stringify({
            csvData,
            overwriteAll
          })
        }
      );

      if (res.ok) {
        const data = await res.json();
        alert(`${data.message}`);
        fetchHolidays(); // Refresh the holidays list
      } else if (res.status === 409) {
        // Conflicts found
        const data = await res.json();
        const conflictCount = data.conflicts.length;
        const confirmOverwrite = confirm(
          `Found ${conflictCount} holidays that conflict with existing ones.\n\nDo you want to overwrite all conflicting holidays?`
        );
        
        if (confirmOverwrite) {
          // Retry with overwriteAll flag
          await importHolidays(csvData, true);
        }
      } else {
        const errorData = await res.json();
        alert(`Failed to import holidays: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error importing holidays:', error);
      alert('Error importing holidays');
    }
  };

  const updateSchedule = <K extends keyof WorkSchedule>(dayIndex: number, field: K, value: WorkSchedule[K]) => {
    setSchedules(prev => 
      prev.map((schedule, index) => 
        index === dayIndex ? { ...schedule, [field]: value } : schedule
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Schedule Management</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('schedules')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schedules'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="inline w-4 h-4 mr-2" />
              Work Schedules
            </button>
            <button
              onClick={() => setActiveTab('holidays')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'holidays'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="inline w-4 h-4 mr-2" />
              Company Holidays
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {activeTab === 'schedules' ? (
            <div className="space-y-6">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Employee
                </label>
                <select
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {users.map(user => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Schedule Grid */}
              {selectedUser && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-4">Weekly Schedule</h3>
                  <div className="space-y-3">
                    {schedules.map((schedule, index) => (
                      <div key={schedule.day_of_week} className="flex items-center space-x-4 bg-white p-3 rounded">
                        <div className="w-24">
                          <span className="font-medium">{schedule.day_of_week}</span>
                        </div>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={schedule.is_work_day}
                            onChange={(e) => updateSchedule(index, 'is_work_day', e.target.checked)}
                            className="rounded mr-2"
                          />
                          Work Day
                        </label>

                        {schedule.is_work_day && (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">From:</span>
                              <input
                                type="time"
                                value={schedule.expected_start_time || ''}
                                onChange={(e) => updateSchedule(index, 'expected_start_time', e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">To:</span>
                              <input
                                type="time"
                                value={schedule.expected_end_time || ''}
                                onChange={(e) => updateSchedule(index, 'expected_end_time', e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={saveSchedules}
                    disabled={loading}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="inline w-4 h-4 mr-2" />
                    {loading ? 'Saving...' : 'Save Schedule'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Add Holiday */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Add Company Holiday</h3>
                <div className="flex space-x-4">
                  <input
                    type="text"
                    placeholder="Holiday name"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <button
                    onClick={() => addHoliday()}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Import/Export Holidays */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Bulk Operations</h3>
                <div className="flex space-x-4">
                  <button
                    onClick={exportHolidays}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
                  >
                    <span>📥</span>
                    <span>Export CSV</span>
                  </button>
                  <label className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer flex items-center space-x-2">
                    <span>📤</span>
                    <span>Import CSV</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileImport}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  CSV format: "Holiday Name","Date" (YYYY-MM-DD)
                </p>
              </div>

              {/* Holidays List */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Current Holidays</h3>
                {holidays.map(holiday => (
                  <div key={holiday.holiday_id} className="flex items-center justify-between bg-white p-3 rounded border">
                    <div>
                      <span className="font-medium">{holiday.holiday_name}</span>
                      <span className="text-gray-500 ml-2">
                        {new Date(holiday.holiday_date).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={() => removeHoliday(holiday.holiday_id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {holidays.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No holidays configured</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
