import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, Save, AlertTriangle } from 'lucide-react';

interface CalendarViewProps {
  user: any;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedGroup: string;
  makeAuthenticatedRequest: (url: string, options?: any) => Promise<Response>;
}

interface TimeEntry {
  entry_id: number;
  user_id: number;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number;
  status: string;
}

interface UserTimeData {
  user_id: number;
  first_name: string;
  last_name: string;
  entries: { [date: string]: TimeEntry };
  multipleEntriesWarning: { [date: string]: boolean };
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  user, 
  selectedDate, 
  setSelectedDate, 
  selectedGroup,
  makeAuthenticatedRequest 
}) => {
  // Initialize weekStart immediately
  const [weekStart, setWeekStart] = useState<string>(() => {
    const today = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = today.getDay();
    let daysBack;
    if (dayOfWeek === 6) {
      daysBack = 0; // Today is Saturday
    } else if (dayOfWeek === 0) {
      daysBack = 1; // Today is Sunday, go back 1 day
    } else {
      daysBack = dayOfWeek + 1; // Monday=2, Tuesday=3, etc.
    }
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - daysBack);
    saturday.setHours(12, 0, 0, 0);
    return saturday.toISOString().split('T')[0];
  });
  const [timeData, setTimeData] = useState<UserTimeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());
  const [focusedBreakCell, setFocusedBreakCell] = useState<string | null>(null);

  // Generate 14-day date range for 2 weeks (Saturday to Friday of following week)
  const generateWeekDates = (startDate: string): string[] => {
    const dates: string[] = [];
    const start = new Date(startDate + 'T12:00:00');
    
    // Validate the date
    if (isNaN(start.getTime())) {
      console.error('Invalid start date:', startDate);
      return [];
    }
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  };

  // Get current week start (Saturday)
  const getCurrentWeekStart = () => {
    const today = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Find the most recent Saturday (6 = Saturday)
    // If today is Sunday (0), go back 1 day to Saturday
    // If today is Monday (1), go back 2 days to Saturday
    // If today is Tuesday (2), go back 3 days to Saturday
    // etc.
    let daysBack;
    if (dayOfWeek === 6) {
      daysBack = 0; // Today is Saturday
    } else if (dayOfWeek === 0) {
      daysBack = 1; // Today is Sunday, go back 1 day
    } else {
      daysBack = dayOfWeek + 1; // Monday=2, Tuesday=3, etc.
    }
    
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - daysBack);
    saturday.setHours(12, 0, 0, 0);
    
    return saturday.toISOString().split('T')[0];
  };

  useEffect(() => {
    const newWeekStart = getCurrentWeekStart();
    setWeekStart(newWeekStart);
  }, [selectedDate]);

  useEffect(() => {
    if (weekStart && selectedGroup !== undefined) {
      fetchTimeData();
    }
  }, [weekStart, selectedGroup]);

  // Force initial data fetch on component mount
  useEffect(() => {
    // Always trigger initial fetch regardless of conditions
    const performInitialFetch = async () => {
      if (weekStart) {
        await fetchTimeData();
      }
    };
    performInitialFetch();
  }, []); // Only run once on mount

  const fetchTimeData = async () => {
    setLoading(true);
    
    try {
      const endDate = new Date(weekStart + 'T12:00:00');
      endDate.setDate(endDate.getDate() + 13); // Get 2-week end (Friday of following week)
      
      const params = new URLSearchParams({
        startDate: weekStart,
        endDate: endDate.toISOString().split('T')[0],
        group: selectedGroup
      });

      const url = `http://192.168.2.14:3001/api/time-management/entries?${params}`;
      
      const response = await makeAuthenticatedRequest(url);
      
      
      if (response.ok) {
        const data = await response.json();
        
        // Extract entries array from response object
        const entries = data.entries || [];
        
        // Group entries by user
        const userMap: { [userId: number]: UserTimeData } = {};
        
        entries.forEach((entry: any) => {
          if (!userMap[entry.user_id]) {
            userMap[entry.user_id] = {
              user_id: entry.user_id,
              first_name: entry.first_name,
              last_name: entry.last_name,
              entries: {},
              multipleEntriesWarning: {}
            };
          }
          
          const entryDate = entry.clock_in.split('T')[0];
          
          // Check if there's already an entry for this date
          if (userMap[entry.user_id].entries[entryDate]) {
            // Mark this date as having multiple entries
            userMap[entry.user_id].multipleEntriesWarning[entryDate] = true;
          }
          
          userMap[entry.user_id].entries[entryDate] = entry;
        });
        
        setTimeData(Object.values(userMap));
        
      } else {
        console.error('API request failed:', response.status, response.statusText);
        try {
          const errorText = await response.text();
          console.error('Error response:', errorText);
        } catch (textError) {
          console.error('Could not read error response:', textError);
        }
      }
    } catch (error) {
      console.error('Error fetching time data:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(weekStart + 'T12:00:00');
    current.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(current.toISOString().split('T')[0]);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleCellEdit = (userId: number, date: string, field: 'in' | 'out' | 'break', value: string) => {
    const cellKey = `${userId}-${date}-${field}`;
    console.log('Time edit:', { userId, date, field, value });
    setEditedCells(prev => {
      const newSet = new Set(prev).add(cellKey);
      return newSet;
    });
    
    // Update local state immediately for responsive UI
    setTimeData(prev => prev.map(userData => {
      if (userData.user_id === userId) {
        // Get existing entry or create a new one if it doesn't exist
        const existingEntry = userData.entries[date];
        const entry = existingEntry ? { ...existingEntry } : {
          entry_id: null, // Will be null for new entries
          user_id: userId,
          clock_in: '',
          clock_out: '',
          break_minutes: 30,
          total_hours: 0,
          status: 'completed'
        };
        
        if (field === 'in') {
          entry.clock_in = value ? date + 'T' + value + ':00.000Z' : '';
        } else if (field === 'out') {
          entry.clock_out = value ? date + 'T' + value + ':00.000Z' : '';
        } else if (field === 'break') {
          entry.break_minutes = parseInt(value) || 0;
        }
        
        console.log('After field update:', {
          field,
          value,
          clock_in: entry.clock_in,
          clock_out: entry.clock_out,
          break_minutes: entry.break_minutes
        });
        
        
        // Recalculate total hours if we have both in and out times
        if (entry.clock_in && entry.clock_out) {
          const start = new Date(entry.clock_in);
          const end = new Date(entry.clock_out);
          console.log('Time calculation debug:', {
            clock_in: entry.clock_in,
            clock_out: entry.clock_out,
            start_date: start.toString(),
            end_date: end.toString(),
            start_time: start.getTime(),
            end_time: end.getTime(),
            raw_diff_ms: end.getTime() - start.getTime(),
            raw_diff_hours: (end.getTime() - start.getTime()) / (1000 * 60 * 60)
          });
          
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            const breakHours = (entry.break_minutes || 0) / 60;
            const calculatedHours = Math.max(0, diffHours - breakHours);
            entry.total_hours = Math.round(calculatedHours * 100) / 100; // Round to 2 decimal places like backend
            console.log(`Final calculation: ${entry.clock_in} to ${entry.clock_out} - ${entry.break_minutes}min break = ${entry.total_hours}h`);
          }
        }
        
        return {
          ...userData,
          entries: {
            ...userData.entries,
            [date]: entry
          }
        };
      }
      return userData;
    }));
  };

  const formatTime = (datetime: string | null): string => {
    if (!datetime) return '';
    return datetime.split('T')[1]?.substring(0, 5) || '';
  };

  const convertToMySQLDateTime = (isoString: string | null): string | null => {
    if (!isoString) return null;
    // Convert from '2025-08-26T17:55:00.000Z' to '2025-08-26 17:55:00'
    return isoString.replace('T', ' ').replace('.000Z', '');
  };

  const saveChanges = async () => {
    console.log('Save changes called, edited cells:', Array.from(editedCells));
    
    if (editedCells.size === 0) {
      console.log('No changes to save');
      return;
    }
    
    try {
      const updates = Array.from(editedCells).map(cellKey => {
        // Parse cell key: format is "userId-YYYY-MM-DD-field"
        const parts = cellKey.split('-');
        const userIdStr = parts[0];
        const date = `${parts[1]}-${parts[2]}-${parts[3]}`; // Reconstruct date
        const field = parts[4];
        const userId = parseInt(userIdStr);
        const userData = timeData.find(ud => ud.user_id === userId);
        const entry = userData?.entries[date];
        
        console.log('Processing cell:', { cellKey, userId, userData: !!userData, entry: !!entry });
        
        if (!entry) {
          console.log('No entry found for cell:', cellKey);
          console.log('Available entries for user:', userData?.entries ? Object.keys(userData.entries) : 'no entries');
          console.log('Looking for date:', date);
          return null;
        }
        
        const update = {
          entry_id: entry.entry_id,
          user_id: entry.user_id,
          clock_in: entry.clock_in,
          clock_out: entry.clock_out,
          break_minutes: entry.break_minutes,
          isNew: !entry.entry_id // New entries will have null entry_id
        };
        
        console.log('Created update:', update);
        return update;
      }).filter(Boolean);
      
      console.log('All updates before filtering:', updates);
      
      // Group updates by entry_id to avoid duplicate API calls
      const uniqueUpdates = updates.reduce((acc: any[], update: any) => {
        const existing = acc.find(u => u.entry_id === update.entry_id && u.isNew === update.isNew);
        if (!existing) {
          acc.push(update);
        }
        return acc;
      }, []);
      
      console.log('Unique updates to save:', uniqueUpdates);
      
      // Save each updated entry
      for (const update of uniqueUpdates) {
        console.log('Saving update:', update);
        let response;
        
        if (update.isNew) {
          // Create new entry
          response = await makeAuthenticatedRequest(
            'http://192.168.2.14:3001/api/time-management/entries',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: update.user_id,
                clock_in: convertToMySQLDateTime(update.clock_in),
                clock_out: convertToMySQLDateTime(update.clock_out),
                break_minutes: update.break_minutes,
                status: 'completed'
              })
            }
          );
        } else {
          // Update existing entry
          response = await makeAuthenticatedRequest(
            `http://192.168.2.14:3001/api/time-management/entries/${update.entry_id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                clock_in: convertToMySQLDateTime(update.clock_in),
                clock_out: convertToMySQLDateTime(update.clock_out),
                break_minutes: update.break_minutes
              })
            }
          );
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to save entry:', update.entry_id || 'new', errorText);
        }
      }
      
      // Clear edited cells on successful save
      console.log('Save completed successfully, clearing edited cells');
      setEditedCells(new Set());
      
      // Refresh data to show updated values
      console.log('Refreshing calendar data...');
      await fetchTimeData();
      console.log('Calendar data refresh completed');
      
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  const dates = weekStart ? generateWeekDates(weekStart) : [];
  const dayLabels = dates.map(date => {
    const d = new Date(date + 'T12:00:00');
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate(),
      fullDate: date
    };
  });

  // Show loading state if weekStart is not initialized
  if (!weekStart) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Initializing calendar...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading calendar data...</div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Header with Week Navigation */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bi-Weekly Time Calendar</h2>
              <p className="text-sm text-gray-600 mt-1">
                Note: Employees will see these time changes reflected on their dashboards
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="px-3 py-2 border border-gray-300 rounded-md min-w-[250px] text-center">
                {weekStart} to {dates[13] || ''}
              </span>
              <button
                onClick={() => navigateWeek('next')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={saveChanges}
                disabled={editedCells.size === 0}
                className={`px-4 py-2 rounded flex items-center space-x-2 ${
                  editedCells.size > 0 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
                {editedCells.size > 0 && (
                  <span className="bg-white text-blue-600 px-2 py-1 rounded-full text-xs">
                    {editedCells.size}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => {
                  setEditedCells(new Set());
                  fetchTimeData();
                }}
                disabled={editedCells.size === 0}
                className={`px-4 py-2 rounded flex items-center space-x-2 ${
                  editedCells.size > 0 
                    ? 'bg-gray-600 text-white hover:bg-gray-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span>Reset Changes</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                Employee
              </th>
              {dayLabels.map((label, idx) => (
                <th key={idx} className="px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] max-w-[100px]">
                  <div>{label.day}</div>
                  <div className="text-gray-400">{label.date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timeData.map(userData => (
              <tr key={userData.user_id} className="hover:bg-gray-50">
                <td className="sticky left-0 bg-white px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r">
                  <div>
                    <div className="font-semibold">{userData.first_name} {userData.last_name}</div>
                  </div>
                </td>
                {dates.map(date => {
                  const entry = userData.entries[date];
                  const hasMultipleEntries = userData.multipleEntriesWarning?.[date] || false;
                  const isWeekend = new Date(date + 'T12:00:00').getDay() === 0 || 
                                   new Date(date + 'T12:00:00').getDay() === 6;
                  const cellBg = isWeekend ? 'bg-gray-50' : 'bg-white';
                  
                  return (
                    <td key={date} className={`px-1 py-1 text-center text-xs ${cellBg} border-l relative w-[100px] max-w-[100px]`}>
                      {hasMultipleEntries && (
                        <div className="absolute inset-0 flex items-center justify-center z-10" title="Multiple time entries found for this date">
                          <AlertTriangle className="h-8 w-8 text-amber-500 fill-amber-100" />
                        </div>
                      )}
                      {entry ? (
                        <div className="space-y-2">
                          <input
                            type="time"
                            value={formatTime(entry.clock_in)}
                            onChange={(e) => handleCellEdit(userData.user_id, date, 'in', e.target.value)}
                            className={`w-full px-1 py-1 text-xs border rounded border-gray-300 max-w-[90px] ${
                              editedCells.has(`${userData.user_id}-${date}-in`) 
                                ? 'bg-orange-100 border-orange-300' 
                                : ''
                            }`}
                          />
                          <input
                            type="time"
                            value={formatTime(entry.clock_out)}
                            onChange={(e) => handleCellEdit(userData.user_id, date, 'out', e.target.value)}
                            className={`w-full px-1 py-1 text-xs border rounded border-gray-300 max-w-[90px] ${
                              editedCells.has(`${userData.user_id}-${date}-out`) 
                                ? 'bg-orange-100 border-orange-300' 
                                : ''
                            }`}
                          />
                          <input
                            type="text"
                            value={
                              focusedBreakCell === `${userData.user_id}-${date}-break`
                                ? (entry.break_minutes || '')
                                : (entry.break_minutes ? `${entry.break_minutes} min break` : '')
                            }
                            onChange={(e) => {
                              const value = focusedBreakCell === `${userData.user_id}-${date}-break`
                                ? e.target.value
                                : e.target.value.replace(/ min break$/, '');
                              handleCellEdit(userData.user_id, date, 'break', value);
                            }}
                            onFocus={() => setFocusedBreakCell(`${userData.user_id}-${date}-break`)}
                            onBlur={() => setFocusedBreakCell(null)}
                            placeholder="30 min break"
                            className={`w-full px-1 py-1 text-xs border rounded border-gray-300 max-w-[90px] ${
                              editedCells.has(`${userData.user_id}-${date}-break`) 
                                ? 'bg-orange-100 border-orange-300' 
                                : ''
                            }`}
                          />
                          <div className="font-bold text-xs mt-2 text-gray-700 max-w-[90px] truncate">
                            {(parseFloat(entry.total_hours) || 0).toFixed(2)}h
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-400 py-8">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};