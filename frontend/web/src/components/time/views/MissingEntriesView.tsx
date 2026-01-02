import React from 'react';
import { Clock } from 'lucide-react';
import type { MissingEntry } from '../../../types/time';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

const TIME_COLORS = MODULE_COLORS.timeTracking;

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
        <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${TIME_COLORS.border}`}></div>
        <p className={`mt-2 ${PAGE_STYLES.panel.textMuted}`}>Loading missing entries...</p>
      </div>
    );
  }

  return (
    <div className={`${PAGE_STYLES.panel.background} shadow rounded-lg overflow-hidden`}>
      <div className={`px-6 py-4 border-b ${PAGE_STYLES.panel.border}`}>
        <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Missing Time Entries</h3>
        <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
          Employees who were scheduled to work but have no time entries
        </p>
      </div>

      {missingEntries.length > 0 ? (
        <table className={`min-w-full ${PAGE_STYLES.panel.divider}`}>
          <thead className={PAGE_STYLES.header.background}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
                Employee
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
                Missing Date
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
                Day of Week
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
                Expected Hours
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.divider}`}>
            {missingEntries.map((entry) => (
              <tr key={`${entry.user_id}-${entry.missing_date}`} className={PAGE_STYLES.interactive.hover}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                    {entry.first_name} {entry.last_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm ${PAGE_STYLES.panel.text}`}>
                    {new Date(entry.missing_date + 'T12:00:00').toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm ${PAGE_STYLES.panel.text}`}>
                    {entry.day_of_week}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm ${PAGE_STYLES.panel.text}`}>
                    {entry.expected_start} - {entry.expected_end}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onAddMissingEntry(entry)}
                    className={`${TIME_COLORS.textDark} ${TIME_COLORS.textHover} mr-4`}
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
          <p className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>
            No missing entries found - all employees have logged their time!
          </p>
        </div>
      )}
    </div>
  );
};
