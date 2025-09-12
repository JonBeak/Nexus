import React from 'react';
import { Clock, ArrowLeft, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Hooks
import { useTimeManagementContainer } from './hooks/useTimeManagementContainer';
import { useTimeEntryActions } from './hooks/useTimeEntryActions';

// Components
import { TimeFilters } from './TimeFilters';
import { CalendarView } from './CalendarView';
import { TimeEntriesTable } from './views/TimeEntriesTable';
import { TimeAnalyticsView } from './views/TimeAnalyticsView';
import { MissingEntriesView } from './views/MissingEntriesView';
import { BulkEditModal } from './modals/BulkEditModal';
import { ScheduleManagement } from './ScheduleManagement';
import { WeeklySummary } from './WeeklySummary';

// Utils
import { navigateDate } from './utils/timeCalculations';
import { exportData } from './utils/exportUtils';

interface TimeManagementProps {
  user: any;
}

export const TimeManagement: React.FC<TimeManagementProps> = ({ user }) => {
  const navigate = useNavigate();
  
  // Main container hook - all state and API logic
  const container = useTimeManagementContainer({ user });
  
  // Entry actions hook - CRUD operations
  const entryActions = useTimeEntryActions({
    makeAuthenticatedRequest: container.makeAuthenticatedRequest,
    onDataRefresh: () => {
      if (container.viewMode === 'single') {
        container.fetchTimeEntries();
      } else if (['weekly', 'bi-weekly', 'monthly', 'quarterly', 'semi-yearly', 'yearly'].includes(container.viewMode)) {
        container.fetchWeeklySummary();
      } else if (container.viewMode === 'analytics') {
        container.fetchAnalytics();
      } else if (container.viewMode === 'missing') {
        container.fetchMissingEntries();
      }
    }
  });

  // Selection handlers
  const handleSelectAll = () => {
    if (container.selectedEntries.length === container.timeEntries.length) {
      container.setSelectedEntries([]);
    } else {
      container.setSelectedEntries(container.timeEntries.map(e => e.entry_id));
    }
  };
  
  const handleSelectEntry = (entryId: number) => {
    container.setSelectedEntries(prev => 
      prev.includes(entryId) 
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  // Bulk operations
  const handleBulkEdit = async () => {
    const success = await entryActions.bulkEdit(container.selectedEntries, container.bulkEditValues);
    if (success) {
      container.setSelectedEntries([]);
      container.setShowBulkEditModal(false);
      container.setBulkEditValues({});
    }
  };

  const handleBulkDelete = async () => {
    const success = await entryActions.bulkDelete(container.selectedEntries);
    if (success) {
      container.setSelectedEntries([]);
    }
  };

  // Export handler
  const handleExport = async (format: 'csv' | 'pdf') => {
    await exportData({
      selectedDate: container.selectedDate,
      endDate: container.endDate,
      dateRange: container.dateRange,
      selectedGroup: container.selectedGroup,
      searchTerm: container.searchTerm,
      format,
      makeAuthenticatedRequest: container.makeAuthenticatedRequest
    });
    container.setShowExportMenu(false);
  };

  // Date navigation
  const handleNavigateDate = (direction: 'prev' | 'next') => {
    navigateDate(container.selectedDate, container.viewMode, direction, container.setSelectedDate);
  };

  // Date preset handler
  const handleDatePresetApply = (startDate: string, endDate: string) => {
    container.setSelectedDate(startDate);
    container.setEndDate(endDate);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: '1408px' }}>
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                title="Return to Dashboard"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <Clock className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Time Management</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage employee time entries and schedules
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => container.setShowScheduleManagement(true)}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100"
              >
                <Settings className="inline w-4 h-4 mr-2" />
                Manage Schedules
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Filters */}
      <TimeFilters
        dateRange={container.dateRange}
        selectedDate={container.selectedDate}
        endDate={container.endDate}
        selectedGroup={container.selectedGroup}
        filterStatus={container.filterStatus}
        searchTerm={container.searchTerm}
        viewMode={container.viewMode}
        showExportMenu={container.showExportMenu}
        users={container.users}
        onDateRangeChange={container.setDateRange}
        onSelectedDateChange={container.setSelectedDate}
        onEndDateChange={container.setEndDate}
        onSelectedGroupChange={container.setSelectedGroup}
        onFilterStatusChange={container.setFilterStatus}
        onSearchTermChange={container.setSearchTerm}
        onViewModeChange={container.setViewMode}
        onNavigateDate={handleNavigateDate}
        onExportMenuToggle={() => container.setShowExportMenu(!container.showExportMenu)}
        onExport={handleExport}
        onDatePresetApply={handleDatePresetApply}
      />
      
      {/* Content Area */}
      <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ maxWidth: '1408px' }}>
        {container.viewMode === 'calendar' ? (
          <CalendarView 
            user={user}
            selectedDate={container.selectedDate}
            setSelectedDate={container.setSelectedDate}
            selectedGroup={container.selectedGroup}
            makeAuthenticatedRequest={container.makeAuthenticatedRequest}
          />
        ) : container.viewMode === 'single' ? (
          <TimeEntriesTable
            timeEntries={container.timeEntries}
            loading={container.loading}
            selectedEntries={container.selectedEntries}
            editingEntry={entryActions.editingEntry}
            editValues={entryActions.editValues}
            onSelectAll={handleSelectAll}
            onSelectEntry={handleSelectEntry}
            onStartEditing={entryActions.startEditing}
            onCancelEditing={entryActions.cancelEditing}
            onSaveEdit={entryActions.saveEdit}
            onDeleteEntry={entryActions.deleteEntry}
            onEditValuesChange={entryActions.setEditValues}
          />
        ) : ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'semi-yearly', 'yearly'].includes(container.viewMode) ? (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {container.viewMode === 'monthly' ? 'Monthly' : 
                 container.viewMode === 'quarterly' ? 'Quarterly' :
                 container.viewMode === 'semi-yearly' ? 'Semi-Yearly' :
                 container.viewMode === 'yearly' ? 'Yearly' :
                 container.viewMode === 'bi-weekly' ? 'Bi-Weekly' : 'Weekly'} Summary
              </h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Regular Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overtime Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Worked
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Late Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Edited Entries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {container.weeklySummary.map((summary) => {
                  const totalHours = parseFloat(summary.total_hours) || 0;
                  const overtimeHours = parseFloat(summary.overtime_hours) || 0;
                  const regularHours = Math.max(0, totalHours - overtimeHours);
                  const hasOvertime = overtimeHours > 0;
                  const hasLateEntries = Number(summary.late_days) > 0;
                  const hasEdits = Number(summary.edited_entries) > 0;
                  
                  return (
                    <tr key={summary.user_id} className={`${hasOvertime || hasLateEntries ? 'bg-yellow-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {summary.first_name} {summary.last_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {totalHours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {regularHours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hasOvertime ? (
                          <span className="text-blue-600 font-medium">
                            🔵 {overtimeHours.toFixed(2)}
                          </span>
                        ) : (
                          '0.00'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {summary.days_worked}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hasLateEntries ? (
                          <span className="text-red-600 font-medium">
                            🔴 {summary.late_days}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hasEdits ? (
                          <span className="text-gray-600 font-medium">
                            ⚫ {summary.edited_entries}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => {
                            container.setSelectedGroup(summary.user_id.toString());
                            container.setViewMode('single');
                          }}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Select User
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {container.weeklySummary.length === 0 && (
              <div className="text-center py-12">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No data found for this period</p>
              </div>
            )}
          </div>
        ) : container.viewMode === 'analytics' ? (
          <TimeAnalyticsView
            analyticsData={container.analyticsData}
            loading={container.loading}
          />
        ) : container.viewMode === 'missing' ? (
          <MissingEntriesView
            missingEntries={container.missingEntries}
            loading={container.loading}
            onAddMissingEntry={container.addMissingEntry}
            onMarkExcused={container.markExcused}
          />
        ) : null}
      </div>
      
      {/* Bulk Actions Bar */}
      {container.selectedEntries.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="max-w-none mx-auto flex justify-between items-center" style={{ maxWidth: '1408px' }}>
            <span className="text-sm text-gray-700">
              {container.selectedEntries.length} entries selected
            </span>
            <div className="space-x-2">
              <button 
                onClick={() => container.setShowBulkEditModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Bulk Edit
              </button>
              <button 
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Bulk Delete
              </button>
              <button 
                onClick={() => container.setSelectedEntries([])}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Edit Modal */}
      {container.showBulkEditModal && (
        <BulkEditModal
          selectedEntries={container.selectedEntries}
          bulkEditValues={container.bulkEditValues}
          onBulkEditValuesChange={container.setBulkEditValues}
          onApplyChanges={handleBulkEdit}
          onClose={() => {
            container.setShowBulkEditModal(false);
            container.setBulkEditValues({});
          }}
        />
      )}
      
      {/* Schedule Management Modal */}
      {container.showScheduleManagement && (
        <ScheduleManagement
          user={user}
          onClose={() => container.setShowScheduleManagement(false)}
        />
      )}
    </div>
  );
};