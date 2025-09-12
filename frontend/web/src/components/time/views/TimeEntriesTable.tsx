import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { formatTime, formatDate, getStatusColor } from '../utils/timeCalculations';
import type { TimeEntry } from '../../../types/time';

interface TimeEntriesTableProps {
  timeEntries: TimeEntry[];
  loading: boolean;
  selectedEntries: number[];
  editingEntry: number | null;
  editValues: {
    clock_in: string;
    clock_out: string;
    break_minutes: number;
  };
  onSelectAll: () => void;
  onSelectEntry: (entryId: number) => void;
  onStartEditing: (entry: TimeEntry) => void;
  onCancelEditing: () => void;
  onSaveEdit: (entryId: number) => void;
  onDeleteEntry: (entryId: number) => void;
  onEditValuesChange: (values: any) => void;
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
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-500">Loading time entries...</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={selectedEntries.length === timeEntries.length && timeEntries.length > 0}
                onChange={onSelectAll}
                className="rounded"
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Employee
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Clock In
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Clock Out
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Break (min)
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Hours
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {timeEntries.map((entry) => (
            <tr key={entry.entry_id} className={getStatusColor(entry)}>
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
                  <div className="text-sm font-medium text-gray-900">
                    {entry.first_name} {entry.last_name}
                  </div>
                  {entry.has_multiple_entries && (
                    <AlertTriangle className="ml-2 w-4 h-4 text-yellow-500" title="Multiple entries for this day" />
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(entry.clock_in)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {editingEntry === entry.entry_id ? (
                  <input
                    type="datetime-local"
                    value={editValues.clock_in}
                    onChange={(e) => onEditValuesChange({ ...editValues, clock_in: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                ) : (
                  formatTime(entry.clock_in)
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {editingEntry === entry.entry_id ? (
                  <input
                    type="datetime-local"
                    value={editValues.clock_out}
                    onChange={(e) => onEditValuesChange({ ...editValues, clock_out: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                ) : (
                  formatTime(entry.clock_out)
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {editingEntry === entry.entry_id ? (
                  <input
                    type="number"
                    min="0"
                    max="480"
                    value={editValues.break_minutes}
                    onChange={(e) => onEditValuesChange({ ...editValues, break_minutes: Number(e.target.value) })}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                ) : (
                  entry.break_minutes
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => onStartEditing(entry)}
                      className="text-indigo-600 hover:text-indigo-900"
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
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No time entries found</p>
        </div>
      )}
    </div>
  );
};