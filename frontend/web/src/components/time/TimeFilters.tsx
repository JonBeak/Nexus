import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Users, Filter, Download, Clock } from 'lucide-react';
import { generateDatePresets, getCurrentPreset, type DatePreset } from '../../utils/datePresets';
import type { TimeUser, ViewMode, FilterStatus } from '../../types/time';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

const TIME_COLORS = MODULE_COLORS.timeTracking;

interface TimeFiltersProps {
  // Filter state
  dateRange: 'single' | 'range';
  selectedDate: string;
  endDate: string;
  selectedGroup: string;
  filterStatus: FilterStatus;
  searchTerm: string;
  viewMode: ViewMode;
  
  // UI state
  showExportMenu: boolean;
  
  // Data
  users: TimeUser[];
  
  // Event handlers
  onDateRangeChange: (range: 'single' | 'range') => void;
  onSelectedDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onSelectedGroupChange: (group: string) => void;
  onFilterStatusChange: (status: FilterStatus) => void;
  onSearchTermChange: (term: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onExportMenuToggle: () => void;
  onExport: (format: 'csv' | 'pdf') => void;
  onDatePresetApply: (startDate: string, endDate: string) => void;
}

export const TimeFilters: React.FC<TimeFiltersProps> = ({
  dateRange,
  selectedDate,
  endDate,
  selectedGroup,
  filterStatus,
  searchTerm,
  viewMode,
  showExportMenu,
  users,
  onDateRangeChange,
  onSelectedDateChange,
  onEndDateChange,
  onSelectedGroupChange,
  onFilterStatusChange,
  onSearchTermChange,
  onViewModeChange,
  onNavigateDate,
  onExportMenuToggle,
  onExport,
  onDatePresetApply
}) => {
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const datePresets = generateDatePresets();
  const currentPreset = getCurrentPreset(selectedDate, endDate);

  // Close preset menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(event.target as Node)) {
        setShowPresetMenu(false);
      }
    };

    if (showPresetMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPresetMenu]);

  const handlePresetSelect = (preset: DatePreset) => {
    // Automatically switch to range mode if needed
    if (preset.startDate !== preset.endDate && dateRange === 'single') {
      onDateRangeChange('range');
    }
    
    onDatePresetApply(preset.startDate, preset.endDate);
    setShowPresetMenu(false);
  };
  return (
    <>
      {/* Filter Bar */}
      <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8 py-4" style={{ maxWidth: '1408px' }}>
        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow p-4`}>
          {/* First Row - Date Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Date Range Toggle */}
            <div>
              <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => onDateRangeChange(e.target.value as 'single' | 'range')}
                className={`w-full px-3 py-2 ${PAGE_STYLES.input.border} rounded-md ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
              >
                <option value="single">Single Date</option>
                <option value="range">Date Range</option>
              </select>
            </div>

            {/* Quick Date Presets */}
            <div className="relative" ref={presetMenuRef}>
              <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
                <Clock className="inline w-4 h-4 mr-1" />
                Quick Select
              </label>
              <button
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                className={`w-full px-3 py-2 ${PAGE_STYLES.input.border} rounded-md text-left ${PAGE_STYLES.input.background} ${PAGE_STYLES.interactive.hover} flex items-center justify-between`}
              >
                <span className={`text-sm ${PAGE_STYLES.input.text}`}>
                  {currentPreset ? currentPreset.label : 'Choose date range...'}
                </span>
                <span className={PAGE_STYLES.panel.textMuted}>▼</span>
              </button>

              {showPresetMenu && (
                <div className={`absolute top-full left-0 mt-1 w-full ${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.border} border rounded-md shadow-lg z-20 max-h-64 overflow-y-auto`}>
                  {datePresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={`w-full px-3 py-2 text-left text-sm ${PAGE_STYLES.interactive.hover} border-b border-[var(--theme-border)] last:border-b-0 ${
                        currentPreset?.id === preset.id ? `${TIME_COLORS.light} ${TIME_COLORS.lightTextDark}` : PAGE_STYLES.panel.textSecondary
                      }`}
                      title={preset.description}
                    >
                      <div className="font-medium">{preset.label}</div>
                      <div className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-1`}>
                        {preset.startDate === preset.endDate ?
                          preset.startDate :
                          `${preset.startDate} to ${preset.endDate}`
                        }
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date with Navigation */}
            <div>
              <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
                <Calendar className="inline w-4 h-4 mr-1" />
                {dateRange === 'range' ? 'Start Date' : 'Date'}
              </label>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onNavigateDate('prev')}
                  className={`px-2 py-2 ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.interactive.hover} rounded-md`}
                  title="Previous period"
                >
                  ◀
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onSelectedDateChange(e.target.value)}
                  className={`flex-1 px-3 py-2 ${PAGE_STYLES.input.border} rounded-md ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
                />
                <button
                  onClick={() => onNavigateDate('next')}
                  className={`px-2 py-2 ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.interactive.hover} rounded-md`}
                  title="Next period"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* End Date */}
            {dateRange === 'range' && (
              <div>
                <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
                  <Calendar className="inline w-4 h-4 mr-1" />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className={`w-full px-3 py-2 ${PAGE_STYLES.input.border} rounded-md ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
                />
              </div>
            )}
          </div>

          {/* Second Row - Filters and Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* User Filter */}
            <div>
              <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
                <Users className="inline w-4 h-4 mr-1" />
                Users
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => onSelectedGroupChange(e.target.value)}
                className={`w-full px-3 py-2 ${PAGE_STYLES.input.border} rounded-md ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
              >
                <option value="all">All Users</option>
                <option value="Group A">Group A</option>
                <option value="Group B">Group B</option>
                <option disabled>──────────────</option>
                {users.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.first_name} {user.last_name} {user.user_group ? `(${user.user_group})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>
                <Filter className="inline w-4 h-4 mr-1" />
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => onFilterStatusChange(e.target.value as FilterStatus)}
                className={`w-full px-3 py-2 ${PAGE_STYLES.input.border} rounded-md ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
              >
                <option value="all">All Entries</option>
                <option value="active">Active Only</option>
                <option value="completed">Completed Only</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Search</label>
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className={`w-full px-3 py-2 ${PAGE_STYLES.input.border} rounded-md ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text} ${PAGE_STYLES.input.placeholder}`}
              />
            </div>

            {/* Actions */}
            <div className="relative">
              <label className={`block text-sm font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Actions</label>
              <button
                onClick={onExportMenuToggle}
                className={`w-full px-3 py-2 ${TIME_COLORS.base} text-white rounded-md ${TIME_COLORS.hover} flex items-center justify-center`}
              >
                <Download className="inline w-4 h-4 mr-1" />
                Export
              </button>

              {showExportMenu && (
                <div className={`absolute top-full left-0 mt-1 w-full ${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.border} border rounded-md shadow-lg z-10`}>
                  <button
                    onClick={() => onExport('csv')}
                    className={`w-full px-3 py-2 text-left text-sm ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.interactive.hover}`}
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => onExport('pdf')}
                    className={`w-full px-3 py-2 text-left text-sm ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.interactive.hover} border-t ${PAGE_STYLES.panel.border}`}
                  >
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* View Tabs */}
      <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: '1408px' }}>
        <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow px-4`}>
          <nav className="flex space-x-8">
            <button
              onClick={() => onViewModeChange('calendar')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'calendar'
                  ? `${TIME_COLORS.border} ${TIME_COLORS.textDark}`
                  : `border-transparent ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.textSecondary} hover:border-[var(--theme-border)]`
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => onViewModeChange('single')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'single'
                  ? `${TIME_COLORS.border} ${TIME_COLORS.textDark}`
                  : `border-transparent ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.textSecondary} hover:border-[var(--theme-border)]`
              }`}
            >
              Single Entries
            </button>
            <button
              onClick={() => onViewModeChange('summary')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'summary'
                  ? `${TIME_COLORS.border} ${TIME_COLORS.textDark}`
                  : `border-transparent ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.textSecondary} hover:border-[var(--theme-border)]`
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => onViewModeChange('analytics')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'analytics'
                  ? `${TIME_COLORS.border} ${TIME_COLORS.textDark}`
                  : `border-transparent ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.textSecondary} hover:border-[var(--theme-border)]`
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => onViewModeChange('missing')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'missing'
                  ? `${TIME_COLORS.border} ${TIME_COLORS.textDark}`
                  : `border-transparent ${PAGE_STYLES.panel.textMuted} hover:${PAGE_STYLES.panel.textSecondary} hover:border-[var(--theme-border)]`
              }`}
            >
              Missing Entries
            </button>
          </nav>
        </div>
      </div>
    </>
  );
};
