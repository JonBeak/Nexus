import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Save, AlertTriangle, Plus, X, Pencil } from 'lucide-react';
import { timeApi } from '../../services/api';
import type { TimeEntry, TimeUser } from '../../types/time';
import { calendarHelpers, type UserTimeData as HelperUserTimeData } from './utils/calendarHelpers';
import { getPreviousSaturdayOfWeek, getSaturdayOfWeek, createNoonDate, toDateString } from '../../lib/timeUtils';
import { TimeInput } from './TimeInput';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

const TIME_COLORS = MODULE_COLORS.timeTracking;

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

  // Memoize pay period group calculation - needs to be after weekStart is defined
  // but we need the getPayPeriodGroup function, so we'll compute it inline
  const payPeriodGroup = useMemo(() => {
    if (!weekStart) return 'A';
    const GROUP_A_REFERENCE = new Date('2025-12-13T12:00:00');
    const startDate = createNoonDate(weekStart);
    const diffTime = startDate.getTime() - GROUP_A_REFERENCE.getTime();
    const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
    return diffWeeks % 2 === 0 ? 'A' : 'B';
  }, [weekStart]);

  const [timeData, setTimeData] = useState<UserTimeData[]>([]);
  const [allUsers, setAllUsers] = useState<TimeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());

  // Today's date for active entry detection
  const today = useMemo(() => toDateString(new Date()), []);
  const [focusedBreakCell, setFocusedBreakCell] = useState<string | null>(null);
  const [bulkEditValues, setBulkEditValues] = useState<{ [date: string]: { in: string; out: string; break: string } }>({});
  const [bulkEditOpen, setBulkEditOpen] = useState<Set<string>>(new Set());
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<{
    userId: number;
    date: string;
    progress: number;
  } | null>(null);
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

  // Fetch holidays on mount
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const holidays = await timeApi.getHolidays();
        const dates = new Set<string>();
        holidays.forEach((h: { holiday_date: string }) => {
          // Normalize date format to YYYY-MM-DD
          const dateStr = typeof h.holiday_date === 'string'
            ? h.holiday_date.split('T')[0]
            : new Date(h.holiday_date).toISOString().split('T')[0];
          dates.add(dateStr);
        });
        setHolidayDates(dates);
      } catch (error) {
        console.error('Error fetching holidays:', error);
      }
    };
    fetchHolidays();
  }, []);

  const navigateWeek = (direction: 'prev' | 'next') => {
    // Calculate from selectedDate to ensure consistency (single source of truth)
    const currentSaturday = getSaturdayOfWeek(selectedDate);
    const current = createNoonDate(currentSaturday);
    current.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
    const newDate = toDateString(current);
    setSelectedDate(newDate); // Only update parent state - useMemo will recalculate weekStart
  };

  const navigateToToday = () => {
    const today = toDateString(new Date());
    setSelectedDate(today);
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

  const handleBulkEditChange = (date: string, field: 'in' | 'out' | 'break', value: string) => {
    setBulkEditValues(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [field]: value
      }
    }));
  };

  const applyBulkEdit = (date: string) => {
    const bulkValues = bulkEditValues[date];
    if (!bulkValues) return;

    // Apply to all users who have entries for this date
    timeData.forEach(userData => {
      if (bulkValues.in) {
        handleCellEdit(userData.user_id, date, 'in', bulkValues.in);
      }
      if (bulkValues.out) {
        handleCellEdit(userData.user_id, date, 'out', bulkValues.out);
      }
      if (bulkValues.break) {
        handleCellEdit(userData.user_id, date, 'break', bulkValues.break);
      }
    });

    // Clear the bulk edit values and close the cell
    setBulkEditValues(prev => {
      const newValues = { ...prev };
      delete newValues[date];
      return newValues;
    });
    setBulkEditOpen(prev => {
      const newSet = new Set(prev);
      newSet.delete(date);
      return newSet;
    });
  };

  const toggleBulkEditOpen = (date: string) => {
    setBulkEditOpen(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
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

    // Update progress every 10ms - delete triggers when progress reaches 100
    progressIntervalRef.current = setInterval(() => {
      setDeletingEntry(prev => {
        if (!prev) return null;

        const newProgress = prev.progress + 1;

        if (newProgress >= 100) {
          // Clear interval and trigger delete
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }

          // Trigger delete (async, runs after state update)
          timeApi.deleteEntry(entryId).then(() => {
            setTimeData(prevData => prevData.map(userData => {
              if (userData.user_id === userId) {
                const newEntries = { ...userData.entries };
                delete newEntries[date];
                return { ...userData, entries: newEntries };
              }
              return userData;
            }));
          }).catch(error => {
            console.error('Failed to delete time entry:', error);
          }).finally(() => {
            setDeletingEntry(null);
          });

          return { ...prev, progress: 100 };
        }

        return { ...prev, progress: newProgress };
      });
    }, 10);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setDeletingEntry(null);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
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
        <div className={PAGE_STYLES.panel.textSecondary}>Initializing calendar...</div>
      </div>
    );
  }

  return (
    <div className={`${PAGE_STYLES.panel.background} shadow rounded-lg overflow-hidden`}>
      {/* Header with Week Navigation */}
      <div className={`${PAGE_STYLES.header.background} px-6 py-4 border-b ${PAGE_STYLES.panel.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className={`text-lg font-semibold ${TIME_COLORS.lightTextDark}`}>Bi-Weekly Time Calendar</h2>
              <p className={`text-sm ${PAGE_STYLES.panel.text} mt-1`}>
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
                    ? `${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
                    : `${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.interactive.hover}`
                }`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={navigateToToday}
                disabled={loading}
                className={`px-3 py-1.5 text-sm font-medium rounded ${
                  loading
                    ? `${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
                    : `${TIME_COLORS.lightTextDark} ${TIME_COLORS.light} border border-yellow-300 hover:bg-yellow-100`
                }`}
              >
                Today
              </button>
              <span className={`px-3 py-2 ${PAGE_STYLES.input.border} border rounded-md min-w-[320px] text-center ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}>
                Group {payPeriodGroup}: {createNoonDate(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {dates[13] ? createNoonDate(dates[13]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
              </span>
              <button
                onClick={() => navigateWeek('next')}
                disabled={loading}
                className={`p-2 rounded ${
                  loading
                    ? `${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
                    : `${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.interactive.hover}`
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
                    ? `${TIME_COLORS.base} text-white ${TIME_COLORS.hover}`
                    : `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
                }`}
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
                {editedCells.size > 0 && (
                  <span className={`bg-white ${TIME_COLORS.textDark} px-2 py-1 rounded-full text-xs`}>
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
                    : `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed`
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
        <table className={`min-w-full ${PAGE_STYLES.panel.divider} table-fixed`}>
          <thead className={PAGE_STYLES.header.background}>
            <tr className={`border-b-2 ${PAGE_STYLES.panel.border}`}>
              <th className={`sticky left-0 ${PAGE_STYLES.header.background} px-4 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.text} uppercase tracking-wider border-r ${PAGE_STYLES.panel.border}`} style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                Employee
              </th>
              {dayLabels.map((label, idx) => {
                const isColumnHovered = hoveredColumn === label.fullDate;
                return (
                  <th key={idx} className={`px-1 py-3 text-center text-xs font-medium ${PAGE_STYLES.panel.text} uppercase tracking-wider transition-colors ${isColumnHovered ? 'bg-yellow-100' : ''}`} style={{ width: '70px', minWidth: '70px', maxWidth: '70px' }}>
                    <div>{label.day}</div>
                    <div className={PAGE_STYLES.panel.textSecondary}>{label.date}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={`${PAGE_STYLES.panel.background}`}>
            {timeData.map(userData => (
              <tr key={userData.user_id} className={`${PAGE_STYLES.interactive.hover} border-b ${PAGE_STYLES.panel.border}`}>
                <td className={`sticky left-0 ${PAGE_STYLES.panel.background} px-4 py-4 whitespace-nowrap text-sm font-medium ${PAGE_STYLES.panel.text} border-r ${PAGE_STYLES.panel.border}`} style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                  <div>
                    <div className="font-semibold">{userData.first_name} {userData.last_name}</div>
                    <div className={`text-xs ${PAGE_STYLES.panel.textSecondary} mt-1`}>
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
                  const isHoliday = holidayDates.has(date);
                  const isToday = date === today;

                  // Detect active entry (no clock_out)
                  const isActiveEntry = entry && (!entry.clock_out || entry.clock_out === '');
                  const activeState = isActiveEntry
                    ? (isToday ? 'today' : 'other-day')
                    : undefined;

                  // Missing work day: no entry, not weekend, not holiday, not future
                  const isMissingWorkDay = !entry && !isWeekend && !isHoliday && date <= today;

                  // Cell background priority: column hover > holiday > weekend > missing work day > normal
                  const isColumnHovered = hoveredColumn === date;
                  const cellBg = isColumnHovered
                    ? 'bg-yellow-100'
                    : isHoliday
                      ? 'bg-amber-100'
                      : isWeekend
                        ? PAGE_STYLES.header.background
                        : isMissingWorkDay
                          ? 'bg-red-100'
                          : PAGE_STYLES.panel.background;

                  return (
                    <td key={date} className={`text-center text-xs ${cellBg} border-l ${PAGE_STYLES.panel.border} relative transition-colors`} style={{ width: '70px', minWidth: '70px', maxWidth: '70px' }}>
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
                            activeState={activeState}
                          />
                          <TimeInput
                            value={entry.clock_out}
                            onChange={(value) => handleCellEdit(userData.user_id, date, 'out', value)}
                            className="w-full max-w-[90px]"
                            isEdited={editedCells.has(calendarHelpers.generateCellKey(userData.user_id, date, 'out'))}
                            activeState={activeState}
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
                            className={`w-full max-w-[90px] px-1 py-1 text-xs border hover:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 ${PAGE_STYLES.input.text} ${
                              editedCells.has(calendarHelpers.generateCellKey(userData.user_id, date, 'break'))
                                ? 'bg-orange-100 border-orange-300'
                                : activeState === 'other-day'
                                  ? 'bg-red-200 border-red-400'
                                  : activeState === 'today'
                                    ? 'bg-green-100 border-green-300'
                                    : `${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background}`
                            }`}
                          />
                          <div className={`font-bold text-xs mt-2 pl-1 pb-1 ${PAGE_STYLES.panel.textSecondary} text-left truncate max-w-[90px]`}>
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
                          <div className={PAGE_STYLES.panel.textMuted}>-</div>

                          {/* Hover overlay with Add button - now shows on all days including weekends */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => handleAddEntry(userData.user_id, date)}
                              className={`p-2 ${TIME_COLORS.textDark} ${PAGE_STYLES.panel.background} rounded-full shadow-md ${TIME_COLORS.lightHover} hover:scale-110 transition-all`}
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

            {/* Edit All Row */}
            {(() => {
              const anyOpen = bulkEditOpen.size > 0;
              return (
                <tr className={`${PAGE_STYLES.header.background} border-t-2 ${PAGE_STYLES.panel.border}`}>
                  <td className={`sticky left-0 ${PAGE_STYLES.header.background} px-4 ${anyOpen ? 'py-3' : 'py-2'} whitespace-nowrap text-sm font-semibold ${TIME_COLORS.lightTextDark} border-r-2 ${PAGE_STYLES.panel.border}`} style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                    Edit All
                  </td>
                  {dates.map(date => {
                    const bulkValues = bulkEditValues[date] || { in: '', out: '', break: '' };
                    const hasValues = bulkValues.in || bulkValues.out || bulkValues.break;
                    const isOpen = bulkEditOpen.has(date);
                    const isColumnHovered = hoveredColumn === date;

                    return (
                      <td
                        key={`bulk-${date}`}
                        className={`text-center text-xs border-l ${PAGE_STYLES.panel.border} transition-colors ${isColumnHovered ? 'bg-yellow-100' : PAGE_STYLES.header.background}`}
                        style={{ width: '70px', minWidth: '70px', maxWidth: '70px' }}
                        onMouseEnter={() => setHoveredColumn(date)}
                        onMouseLeave={() => setHoveredColumn(null)}
                      >
                        {isOpen ? (
                          <div className="space-y-0 p-1">
                            <TimeInput
                              value={bulkValues.in ? `${date}T${bulkValues.in}:00.000Z` : ''}
                              onChange={(value) => handleBulkEditChange(date, 'in', value)}
                              className="w-full max-w-[90px]"
                            />
                            <TimeInput
                              value={bulkValues.out ? `${date}T${bulkValues.out}:00.000Z` : ''}
                              onChange={(value) => handleBulkEditChange(date, 'out', value)}
                              className="w-full max-w-[90px]"
                            />
                            <input
                              type="text"
                              value={bulkValues.break}
                              onChange={(e) => handleBulkEditChange(date, 'break', e.target.value)}
                              placeholder="Break"
                              className={`w-full max-w-[90px] px-1 py-1 text-xs border ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} hover:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-500`}
                            />
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => applyBulkEdit(date)}
                                disabled={!hasValues}
                                className={`flex-1 px-1 py-1 text-xs rounded ${
                                  hasValues
                                    ? `${TIME_COLORS.base} text-white ${TIME_COLORS.hover}`
                                    : `${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.textMuted} cursor-not-allowed border ${PAGE_STYLES.panel.border}`
                                }`}
                              >
                                Apply
                              </button>
                              <button
                                onClick={() => toggleBulkEditOpen(date)}
                                className={`px-1 py-1 text-xs rounded ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.interactive.hover}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={`group ${anyOpen ? 'h-24' : 'h-10'} flex items-center justify-center relative`}>
                            <div className={PAGE_STYLES.panel.textMuted}>-</div>
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                onClick={() => toggleBulkEditOpen(date)}
                                className={`p-2 ${TIME_COLORS.textDark} ${PAGE_STYLES.panel.background} rounded-full shadow-md ${TIME_COLORS.lightHover} hover:scale-110 transition-all`}
                                title="Bulk edit all entries for this day"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};
