import React from 'react';
import { Clock } from 'lucide-react';
import type { MissingEntry } from '../../../types/time';

interface MissingEntriesViewProps {
  missingEntries: MissingEntry[];
  loading: boolean;
  onAddMissingEntry: (entry: MissingEntry) => void;
  onMarkExcused: (entry: MissingEntry) => void;
}

export const MissingEntriesView: React.FC<MissingEntriesViewProps> = ({
  missingEntries,
  loading,
  onAddMissingEntry,
  onMarkExcused
}) => {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-500">Loading missing entries...</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Missing Time Entries</h3>
        <p className="text-sm text-gray-500">
          Employees who were scheduled to work but have no time entries
        </p>
      </div>
      
      {missingEntries.length > 0 ? (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Missing Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Day of Week
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expected Hours
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {missingEntries.map((entry, index) => (
              <tr key={`${entry.user_id}-${entry.missing_date}`} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {entry.first_name} {entry.last_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(entry.missing_date + 'T12:00:00').toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {entry.day_of_week}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {entry.expected_start} - {entry.expected_end}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => onAddMissingEntry(entry)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Add Entry
                  </button>
                  <button 
                    onClick={() => onMarkExcused(entry)}
                    className="text-yellow-600 hover:text-yellow-900"
                  >
                    Mark Excused
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center py-12">
          <Clock className="mx-auto h-12 w-12 text-green-400" />
          <p className="mt-2 text-sm text-gray-500">
            No missing entries found - all employees have logged their time!
          </p>
        </div>
      )}
    </div>
  );
};