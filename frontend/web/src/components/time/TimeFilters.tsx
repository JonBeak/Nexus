import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Users, Filter, Download, Clock } from 'lucide-react';
import { generateDatePresets, getCurrentPreset, type DatePreset } from '../../utils/datePresets';

// Pure UI component for time management filters
interface User {
  user_id: number;
  first_name: string;
  last_name: string;
  user_group?: string;
}

type ViewMode = 'calendar' | 'single' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'semi-yearly' | 'yearly' | 'analytics' | 'missing';
type FilterStatus = 'all' | 'active' | 'completed';

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
  users: User[];
  
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
        <div className="bg-white rounded-lg shadow p-4">
          {/* First Row - Date Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Date Range Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => onDateRangeChange(e.target.value as 'single' | 'range')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="single">Single Date</option>
                <option value="range">Date Range</option>
              </select>
            </div>

            {/* Quick Date Presets */}
            <div className="relative" ref={presetMenuRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="inline w-4 h-4 mr-1" />
                Quick Select
              </label>
              <button
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-left bg-white hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="text-sm">
                  {currentPreset ? currentPreset.label : 'Choose date range...'}
                </span>
                <span className="text-gray-400">▼</span>
              </button>
              
              {showPresetMenu && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-64 overflow-y-auto">
                  {datePresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        currentPreset?.id === preset.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                      title={preset.description}
                    >
                      <div className="font-medium">{preset.label}</div>
                      <div className="text-xs text-gray-500 mt-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline w-4 h-4 mr-1" />
                {dateRange === 'range' ? 'Start Date' : 
                 viewMode === 'daily' ? 'Date' :
                 viewMode === 'weekly' ? 'Week (Sat-Fri)' :
                 viewMode === 'bi-weekly' ? 'Bi-Week (Sat-Fri)' : 'Date'}
              </label>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onNavigateDate('prev')}
                  className="px-2 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                  title={`Previous ${viewMode === 'daily' ? 'day' : 'week'}`}
                >
                  ◀
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onSelectedDateChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                />
                <button
                  onClick={() => onNavigateDate('next')}
                  className="px-2 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                  title={`Next ${viewMode === 'daily' ? 'day' : 'week'}`}
                >
                  ▶
                </button>
              </div>
            </div>
            
            {/* End Date */}
            {dateRange === 'range' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            )}
          </div>
          
          {/* Second Row - Filters and Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* User Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Users className="inline w-4 h-4 mr-1" />
                Users
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => onSelectedGroupChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Filter className="inline w-4 h-4 mr-1" />
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => onFilterStatusChange(e.target.value as FilterStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Entries</option>
                <option value="active">Active Only</option>
                <option value="completed">Completed Only</option>
              </select>
            </div>
            
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            {/* Actions */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Actions</label>
              <button 
                onClick={onExportMenuToggle}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
              >
                <Download className="inline w-4 h-4 mr-1" />
                Export
              </button>
              
              {showExportMenu && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-10">
                  <button
                    onClick={() => onExport('csv')}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => onExport('pdf')}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-200"
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
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => onViewModeChange('calendar')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'calendar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => onViewModeChange('single')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'single'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Single View
            </button>
            <button
              onClick={() => onViewModeChange('weekly')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'weekly'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => onViewModeChange('bi-weekly')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'bi-weekly'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Bi-Weekly
            </button>
            <button
              onClick={() => onViewModeChange('monthly')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'monthly'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => onViewModeChange('quarterly')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'quarterly'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Quarterly
            </button>
            <button
              onClick={() => onViewModeChange('semi-yearly')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'semi-yearly'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Semi-Yearly
            </button>
            <button
              onClick={() => onViewModeChange('yearly')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'yearly'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Yearly
            </button>
            <button
              onClick={() => onViewModeChange('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => onViewModeChange('missing')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'missing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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