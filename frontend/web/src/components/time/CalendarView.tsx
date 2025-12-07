import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Save, AlertTriangle, Plus, X } from 'lucide-react';
import { timeApi } from '../../services/api';
import type { TimeEntry, TimeUser } from '../../types/time';
import { calendarHelpers, type UserTimeData as HelperUserTimeData } from './utils/calendarHelpers';
import { getPreviousSaturdayOfWeek, getSaturdayOfWeek, createNoonDate, toDateString } from '../../lib/timeUtils';
import { TimeInput } from './TimeInput';

interface CalendarViewProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedGroup: string;
}

type CalendarEntry = Omit<TimeEntry, 'entry_id'> & { entry_id: number | null };

// Using UserTimeData from calendarHelpers
type UserTimeData = HelperUserTimeData;

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDate,
  setSelectedDate,
  selectedGroup
}) => {
  // Calculate weekStart on-demand from selectedDate (single source of truth)
  const weekStart = useMemo(
    () => selectedDate ? getPreviousSaturdayOfWeek(selectedDate) : '',
    [selectedDate]
  );
  const [timeData, setTimeData] = useState<UserTimeData[]>([]);
  const [allUsers, setAllUsers] = useState<TimeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());
  const [focusedBreakCell, setFocusedBreakCell] = useState<string | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<{
    userId: number;
    date: string;
    progress: number;
  } | null>(null);
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTimeData = useCallback(async () => {
    if (!weekStart) {
      return;
    }
    setLoading(true);

    try {
      const endDate = createNoonDate(weekStart);
      endDate.setDate(endDate.getDate() + 13); // Get 2-week end (Friday of following week)

      // Fetch both entries and users in parallel
      const [entriesData, usersData] = await Promise.all([
        timeApi.getEntries({
          startDate: weekStart,
          endDate: toDateString(endDate),
          group: selectedGroup,
          status: 'all',
          search: ''
        }),
        timeApi.getUsers()
      ]);

      // Extract entries array from response object (handles dual format)
      const entries = Array.isArray(entriesData) ? entriesData : entriesData.entries || [];

      // Build user map from entries using helper
      const userMap = calendarHelpers.buildUserMapFromEntries(entries);

      // Filter users by current group
      const filteredUsers = calendarHelpers.filterUsers(usersData, selectedGroup);

      // Sort users: with entries first (A-Z), without entries second (A-Z)
      const dates = calendarHelpers.generateWeekDates(weekStart);
      const sortedUserData = calendarHelpers.sortUsers(filteredUsers, userMap, dates);

      setAllUsers(usersData);
      setTimeData(sortedUserData);
    } catch (error) {
      console.error('Error fetching time data:', error);
      // On error, fall back to showing just users with entries (previous behavior)
      setTimeData([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart, selectedGroup]);

  useEffect(() => {
    fetchTimeData();
  }, [fetchTimeData]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    // Calculate from selectedDate to ensure consistency (single source of truth)
    const currentSaturday = getSaturdayOfWeek(selectedDate);
    const current = createNoonDate(currentSaturday);
    current.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
    const newDate = toDateString(current);
    setSelectedDate(newDate); // Only update parent state - useMemo will recalculate weekStart
  };

  const handleCellEdit = (userId: number, date: string, field: 'in' | 'out' | 'break', value: string) => {
    const cellKey = calendarHelpers.generateCellKey(userId, date, field);
    setEditedCells(prev => {
      const newSet = new Set(prev).add(cellKey);
      return newSet;
    });

    // Update local state immediately for responsive UI
    setTimeData(prev => prev.map(userData => {
      if (userData.user_id === userId) {
        // Get existing entry or create a new one if it doesn't exist
        const existingEntry = userData.entries[date];
        const entry: CalendarEntry = existingEntry ? { ...existingEntry } : {
          entry_id: null, // Will be null for new entries
          user_id: userId,
          clock_in: '',
          clock_out: '',
          break_minutes: 30,
          total_hours: 0,
          status: 'completed'
        };

        if (field === 'in') {
          entry.clock_in = value ? `${date}T${value}:00.000Z` : '';
        } else if (field === 'out') {
          entry.clock_out = value ? `${date}T${value}:00.000Z` : '';
        } else if (field === 'break') {
          const parsed = Number(value);
          entry.break_minutes = Number.isNaN(parsed) ? 0 : parsed;
        }

        // Update completed


        // Recalculate total hours if we have both in and out times
        if (entry.clock_in && entry.clock_out) {
          const start = new Date(entry.clock_in);
          const end = new Date(entry.clock_out);
          // Calculate hours if both times are present

          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            const breakHours = (entry.break_minutes || 0) / 60;
            const calculatedHours = Math.max(0, diffHours - breakHours);
            entry.total_hours = Math.round(calculatedHours * 100) / 100; // Round to 2 decimal places like backend
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

  const handleAddEntry = (userId: number, date: string) => {
    // Create new entry with empty times - cell becomes editable
    handleCellEdit(userId, date, 'in', '');
  };

  const convertToMySQLDateTime = (isoString: string | null): string | null => {
    if (!isoString) return null;
    // Convert from '2025-08-26T17:55:00.000Z' to '2025-08-26 17:55:00'
    return isoString.replace('T', ' ').replace('.000Z', '');
  };

  interface EntryUpdate {
    entry_id: number | null;
    user_id: number;
    clock_in: string;
    clock_out: string | null;
    break_minutes: number;
    isNew: boolean;
  }

  const saveChanges = async () => {
    if (editedCells.size === 0) {
      return;
    }
    
    try {
      const updates = Array.from(editedCells).map(cellKey => {
        // Parse cell key using helper
        const { userId, date } = calendarHelpers.parseCellKey(cellKey);
        const userData = timeData.find(ud => ud.user_id === userId);
        const entry = userData?.entries[date];
        
        
        if (!entry) {
          return null;
        }
        
        const update: EntryUpdate = {
          entry_id: entry.entry_id,
          user_id: entry.user_id,
          clock_in: entry.clock_in,
          clock_out: entry.clock_out,
          break_minutes: entry.break_minutes,
          isNew: !entry.entry_id // New entries will have null entry_id
        };
        
        return update;
      }).filter((update): update is EntryUpdate => Boolean(update));
      
      
      // Group updates by entry_id to avoid duplicate API calls
      const uniqueUpdatesMap = new Map<string, EntryUpdate>();
      updates.forEach(update => {
        const key = `${update.entry_id ?? 'new'}-${update.user_id}`;
        if (!uniqueUpdatesMap.has(key)) {
          uniqueUpdatesMap.set(key, update);
        }
      });
      const uniqueUpdates = Array.from(uniqueUpdatesMap.values());
      
      
      // Save each updated entry
      for (const update of uniqueUpdates) {
        try {
          if (update.isNew) {
            // Create new entry
            const date = update.clock_in.split('T')[0];
            await timeApi.createEntry({
              user_id: update.user_id,
              date: date,
              clock_in: convertToMySQLDateTime(update.clock_in) || '',
              clock_out: convertToMySQLDateTime(update.clock_out) || '',
              break_minutes: update.break_minutes
            });
          } else {
            // Update existing entry
            await timeApi.updateEntry(update.entry_id!, {
              clock_in: convertToMySQLDateTime(update.clock_in) || undefined,
              clock_out: convertToMySQLDateTime(update.clock_out) || undefined,
              break_minutes: update.break_minutes
            });
          }
        } catch (error) {
          console.error('Failed to save entry:', update.entry_id || 'new', error);
        }
      }
      
      // Clear edited cells on successful save
      setEditedCells(new Set());
      
      // Refresh data to show updated values
      await fetchTimeData();
      
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  // Delete entry handlers
  const handleDeleteMouseDown = useCallback((userId: number, date: string, entryId: number) => {
    setDeletingEntry({ userId, date, progress: 0 });

    // Update progress every 10ms for smooth animation (100 steps over 1 second)
    progressIntervalRef.current = setInterval(() => {
      setDeletingEntry(prev =>
        prev ? { ...prev, progress: Math.min(prev.progress + 1, 100) } : null
      );
    }, 10);

    // Trigger delete after 1 second
    deleteTimerRef.current = setTimeout(async () => {
      try {
        await timeApi.deleteEntry(entryId);

        // Silently remove from local state
        setTimeData(prev => prev.map(userData => {
          if (userData.user_id === userId) {
            const newEntries = { ...userData.entries };
            delete newEntries[date];
            return { ...userData, entries: newEntries };
          }
          return userData;
        }));

        handleDeleteCancel();
      } catch (error) {
        console.error('Failed to delete time entry:', error);
        handleDeleteCancel();
      }
    }, 1000);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setDeletingEntry(null);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Memoize dates calculation for performance
  const dates = useMemo(() =>
    weekStart ? calendarHelpers.generateWeekDates(weekStart) : [],
    [weekStart]
  );

  const dayLabels = dates.map(date => {
    const d = createNoonDate(date);
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
                disabled={loading}
                className={`p-2 rounded ${
                  loading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="px-3 py-2 border border-gray-300 rounded-md min-w-[250px] text-center">
                {weekStart} to {dates[13] || ''}
              </span>
              <button
                onClick={() => navigateWeek('next')}
                disabled={loading}
                className={`p-2 rounded ${
                  loading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
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
      <div className={`overflow-x-auto transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r" style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                Employee
              </th>
              {dayLabels.map((label, idx) => (
                <th key={idx} className="px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '70px', minWidth: '70px', maxWidth: '70px' }}>
                  <div>{label.day}</div>
                  <div className="text-gray-400">{label.date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timeData.map(userData => (
              <tr key={userData.user_id} className="hover:bg-gray-50">
                <td className="sticky left-0 bg-white px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r" style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                  <div>
                    <div className="font-semibold">{userData.first_name} {userData.last_name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {calendarHelpers.calculateTotalHours(userData).toFixed(2)} hrs
                    </div>
                  </div>
                </td>
                {dates.map(date => {
                  const entry = userData.entries[date];
                  const hasMultipleEntries = userData.multipleEntriesWarning?.[date] || false;
                  const dateObj = createNoonDate(date);
                  const dayOfWeek = dateObj.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const cellBg = isWeekend ? 'bg-gray-50' : 'bg-white';
                  
                  return (
                    <td key={date} className={`text-center text-xs ${cellBg} border-l relative`} style={{ width: '70px', minWidth: '70px', maxWidth: '70px' }}>
                      {hasMultipleEntries && (
                        <div className="absolute inset-0 flex items-center justify-center z-10" title="Multiple time entries found for this date">
                          <AlertTriangle className="h-8 w-8 text-amber-500 fill-amber-100" />
                        </div>
                      )}
                      {entry ? (
                        <div className="relative space-y-0 group min-h-[96px]">
                          <TimeInput
                            value={entry.clock_in}
                            onChange={(value) => handleCellEdit(userData.user_id, date, 'in', value)}
                            className="w-full max-w-[90px]"
                            isEdited={editedCells.has(calendarHelpers.generateCellKey(userData.user_id, date, 'in'))}
                          />
                          <TimeInput
                            value={entry.clock_out}
                            onChange={(value) => handleCellEdit(userData.user_id, date, 'out', value)}
                            className="w-full max-w-[90px]"
                            isEdited={editedCells.has(calendarHelpers.generateCellKey(userData.user_id, date, 'out'))}
                          />
                          <input
                            type="text"
                            value={
                              focusedBreakCell === calendarHelpers.generateCellKey(userData.user_id, date, 'break')
                                ? (entry.break_minutes || '')
                                : (entry.break_minutes ? `${entry.break_minutes} min break` : '')
                            }
                            onChange={(e) => {
                              const breakCellKey = calendarHelpers.generateCellKey(userData.user_id, date, 'break');
                              const value = focusedBreakCell === breakCellKey
                                ? e.target.value
                                : e.target.value.replace(/ min break$/, '');
                              handleCellEdit(userData.user_id, date, 'break', value);
                            }}
                            onFocus={() => setFocusedBreakCell(calendarHelpers.generateCellKey(userData.user_id, date, 'break'))}
                            onBlur={() => setFocusedBreakCell(null)}
                            placeholder="No break"
                            className={`w-full max-w-[90px] px-1 py-1 text-xs border border-gray-300 ${
                              editedCells.has(calendarHelpers.generateCellKey(userData.user_id, date, 'break'))
                                ? 'bg-orange-100 border-orange-300'
                                : ''
                            }`}
                          />
                          <div className="font-bold text-xs mt-2 pl-1 pb-1 text-gray-700 text-left truncate max-w-[90px]">
                            {(parseFloat(entry.total_hours) || 0).toFixed(2)} hrs
                          </div>

                          {/* Delete button - shows for all entries */}
                          {entry.entry_id && (
                            <button
                              onMouseDown={() => handleDeleteMouseDown(userData.user_id, date, entry.entry_id!)}
                              onMouseUp={handleDeleteCancel}
                              onMouseLeave={handleDeleteCancel}
                              onTouchStart={(e) => {
                                e.preventDefault();
                                handleDeleteMouseDown(userData.user_id, date, entry.entry_id!);
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                handleDeleteCancel();
                              }}
                              className="absolute -bottom-0.5 right-0 p-0.5 rounded transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              title="Hold to delete time entry"
                            >
                              {/* SVG with circular progress indicator */}
                              <svg className="h-5 w-5 relative" viewBox="0 0 24 24">
                                {/* Progress ring - only show when holding, clockwise from top */}
                                {deletingEntry?.userId === userData.user_id &&
                                 deletingEntry?.date === date &&
                                 deletingEntry.progress > 0 && (
                                  <circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    fill="none"
                                    stroke="#dc2626"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 10}`}
                                    strokeDashoffset={`${2 * Math.PI * 10 * (1 - deletingEntry.progress / 100)}`}
                                    transform="rotate(-90 12 12)"
                                  />
                                )}

                                {/* X icon */}
                                <path
                                  d="M8 8L16 16M16 8L8 16"
                                  stroke="#dc2626"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="group relative h-24 flex items-center justify-center">
                          {/* Empty state */}
                          <div className="text-gray-400">-</div>

                          {/* Hover overlay with Add button - now shows on all days including weekends */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => handleAddEntry(userData.user_id, date)}
                              className="p-2 text-blue-600 bg-white rounded-full shadow-md hover:bg-blue-50 hover:scale-110 transition-all"
                              aria-label={`Add time entry for ${userData.first_name} ${userData.last_name} on ${date}`}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
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
