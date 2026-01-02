import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { formatTime, formatDate, getStatusColor } from '../utils/timeCalculations';
import type { TimeEntry, EditValues } from '../../../types/time';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

const TIME_COLORS = MODULE_COLORS.timeTracking;

interface TimeEntriesTableProps {
  timeEntries: TimeEntry[];
  loading: boolean;
  selectedEntries: number[];
  editingEntry: number | null;
  editValues: EditValues;
  onSelectAll: () => void;
  onSelectEntry: (entryId: number) => void;
  onStartEditing: (entry: TimeEntry) => void;
  onCancelEditing: () => void;
  onSaveEdit: (entryId: number) => void;
  onDeleteEntry: (entryId: number) => void;
  onEditValuesChange: (values: EditValues) => void;
}

export const TimeEntriesTable: React.FC<TimeEntriesTableProps> = ({
  timeEntries,
  loading,
  selectedEntries,
  editingEntry,
  editValues,
  onSelectAll,
  onSelectEntry,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onDeleteEntry,
  onEditValuesChange
}) => {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${TIME_COLORS.border}`}></div>
        <p className={`mt-2 ${PAGE_STYLES.panel.textMuted}`}>Loading time entries...</p>
      </div>
    );
  }

  return (
    <div className={`${PAGE_STYLES.panel.background} shadow rounded-lg overflow-hidden`}>
      <table className={`min-w-full ${PAGE_STYLES.panel.divider}`}>
        <thead className={PAGE_STYLES.header.background}>
          <tr>
            <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
              <input
                type="checkbox"
                checked={selectedEntries.length === timeEntries.length && timeEntries.length > 0}
                onChange={onSelectAll}
                className="rounded"
              />
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
              Employee
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
              Date
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
              Clock In
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
              Clock Out
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
              Break (min)
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
              Total Hours
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
              Status
            </th>
            <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.divider}`}>
          {timeEntries.map((entry) => (
            <tr key={entry.entry_id} className={`${getStatusColor(entry)} ${PAGE_STYLES.interactive.hover}`}>
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedEntries.includes(entry.entry_id)}
                  onChange={() => onSelectEntry(entry.entry_id)}
                  className="rounded"
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                    {entry.first_name} {entry.last_name}
                  </div>
                  {entry.has_multiple_entries && (
                    <AlertTriangle className="ml-2 w-4 h-4 text-yellow-500" title="Multiple entries for this day" />
                  )}
                </div>
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.textMuted}`}>
                {formatDate(entry.clock_in)}
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`}>
                {editingEntry === entry.entry_id ? (
                  <input
                    type="datetime-local"
                    value={editValues.clock_in}
                    onChange={(e) => onEditValuesChange({ ...editValues, clock_in: e.target.value })}
                    className={`w-full px-2 py-1 ${PAGE_STYLES.input.border} rounded text-xs ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
                  />
                ) : (
                  formatTime(entry.clock_in)
                )}
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`}>
                {editingEntry === entry.entry_id ? (
                  <input
                    type="datetime-local"
                    value={editValues.clock_out}
                    onChange={(e) => onEditValuesChange({ ...editValues, clock_out: e.target.value })}
                    className={`w-full px-2 py-1 ${PAGE_STYLES.input.border} rounded text-xs ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
                  />
                ) : (
                  formatTime(entry.clock_out)
                )}
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`}>
                {editingEntry === entry.entry_id ? (
                  <input
                    type="number"
                    min="0"
                    max="480"
                    value={editValues.break_minutes}
                    onChange={(e) => onEditValuesChange({ ...editValues, break_minutes: Number(e.target.value) })}
                    className={`w-16 px-2 py-1 ${PAGE_STYLES.input.border} rounded text-xs ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
                  />
                ) : (
                  entry.break_minutes
                )}
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                {Number(entry.total_hours).toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  entry.status === 'active' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }`}>
                  {entry.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {editingEntry === entry.entry_id ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onSaveEdit(entry.entry_id)}
                      className="text-green-600 hover:text-green-900"
                    >
                      Save
                    </button>
                    <button
                      onClick={onCancelEditing}
                      className={`${PAGE_STYLES.panel.textSecondary} hover:${PAGE_STYLES.panel.text}`}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onStartEditing(entry)}
                      className={`${TIME_COLORS.textDark} ${TIME_COLORS.textHover}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteEntry(entry.entry_id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {timeEntries.length === 0 && !loading && (
        <div className="text-center py-12">
          <Clock className={`mx-auto h-12 w-12 ${PAGE_STYLES.panel.textMuted}`} />
          <p className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>No time entries found</p>
        </div>
      )}
    </div>
  );
};
