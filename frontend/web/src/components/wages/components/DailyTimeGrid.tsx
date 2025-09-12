import React from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { UserWageData } from '../types/WageTypes';
import { formatTime, generateDayLabels } from '../utils/WageCalculations';

interface DailyTimeGridProps {
  loading: boolean;
  wageData: UserWageData[];
  dates: string[];
  editedCells: Set<string>;
  onCellEdit: (userId: number, date: string, field: 'in' | 'out' | 'break', value: string) => void;
  onSaveChanges: () => void;
  onClearChanges: () => void;
}

export const DailyTimeGrid: React.FC<DailyTimeGridProps> = ({
  loading,
  wageData,
  dates,
  editedCells,
  onCellEdit,
  onSaveChanges,
  onClearChanges
}) => {
  const dayLabels = generateDayLabels(dates);
  const hasUnsavedChanges = editedCells.size > 0;

  return (
    <div className="max-w-full mx-auto px-4 pb-8">
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Daily Time Entries
              {hasUnsavedChanges && (
                <span className="ml-2 text-sm text-orange-600 font-medium">
                  ({editedCells.size} unsaved change{editedCells.size !== 1 ? 's' : ''})
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Note: Employees will not see these payroll adjustments on their dashboards
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges && (
              <button
                onClick={onClearChanges}
                className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center space-x-2 text-sm"
                title="Discard all unsaved changes"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Clear Changes</span>
              </button>
            )}
            <button
              onClick={onSaveChanges}
              disabled={!hasUnsavedChanges}
              className={`px-4 py-2 rounded flex items-center space-x-2 transition-all ${
                hasUnsavedChanges
                  ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
              }`}
              title={hasUnsavedChanges ? 'Save all pending changes' : 'No changes to save'}
            >
              <Save className="h-5 w-5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
        {!loading && (
          <table className="min-w-full table-fixed">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Employee
                </th>
                {dayLabels.map((label, idx) => (
                  <th key={idx} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">
                    <div>{label.day}</div>
                    <div className="text-gray-400">{label.date}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {wageData.map(userData => (
                <tr key={userData.user_id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r">
                    <div>{userData.first_name} {userData.last_name}</div>
                    <div className="text-xs text-gray-500">
                      ${userData.hourly_rate}/hr
                      {userData.user_group && ` • ${userData.user_group}`}
                    </div>
                  </td>
                  {dates.map(date => {
                    const entry = userData.entries[date];
                    const isWeekend = new Date(date + 'T12:00:00').getDay() === 0 || 
                                     new Date(date + 'T12:00:00').getDay() === 6;
                    
                    // Check if any field in this cell has unsaved changes
                    const cellKeyIn = `${userData.user_id}-${date}-in`;
                    const cellKeyOut = `${userData.user_id}-${date}-out`;
                    const cellKeyBreak = `${userData.user_id}-${date}-break`;
                    const hasUnsavedChanges = editedCells.has(cellKeyIn) || 
                                            editedCells.has(cellKeyOut) || 
                                            editedCells.has(cellKeyBreak);
                    
                    const cellBg = entry?.is_holiday ? 'bg-yellow-50' : 
                                   isWeekend ? 'bg-gray-50' : 'bg-white';
                    
                    return (
                      <td key={date} className={`px-1 py-1 text-center text-xs w-[120px] ${cellBg} border-l ${
                        hasUnsavedChanges ? 'ring-2 ring-orange-300 ring-inset' : ''
                      }`}>
                        {entry ? (
                          <div className="space-y-2">
                            <input
                              type="time"
                              value={formatTime(entry.payroll_clock_in)}
                              onChange={(e) => onCellEdit(userData.user_id, date, 'in', e.target.value)}
                              className={`w-full px-1 py-0.5 text-xs border rounded ${
                                editedCells.has(cellKeyIn) 
                                  ? 'border-orange-400 bg-orange-50 shadow-sm' 
                                  : entry.payroll_adjusted 
                                    ? 'border-blue-400 bg-blue-50' 
                                    : 'border-gray-300'
                              }`}
                            />
                            <input
                              type="time"
                              value={formatTime(entry.payroll_clock_out)}
                              onChange={(e) => onCellEdit(userData.user_id, date, 'out', e.target.value)}
                              className={`w-full px-1 py-0.5 text-xs border rounded ${
                                editedCells.has(cellKeyOut) 
                                  ? 'border-orange-400 bg-orange-50 shadow-sm' 
                                  : entry.payroll_adjusted 
                                    ? 'border-blue-400 bg-blue-50' 
                                    : 'border-gray-300'
                              }`}
                            />
                            <input
                              type="number"
                              value={entry.payroll_break_minutes || ''}
                              onChange={(e) => onCellEdit(userData.user_id, date, 'break', e.target.value)}
                              placeholder="Break"
                              className={`w-full px-1 py-0.5 text-xs border rounded ${
                                editedCells.has(cellKeyBreak) 
                                  ? 'border-orange-400 bg-orange-50 shadow-sm' 
                                  : entry.payroll_adjusted 
                                    ? 'border-blue-400 bg-blue-50' 
                                    : 'border-gray-300'
                              }`}
                            />
                            <div className={`font-bold text-sm mt-2 ${entry.is_overtime ? 'text-orange-600' : 'text-gray-700'}`}>
                              {(Number(entry.payroll_total_hours) || 0).toFixed(2)}h
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-400 py-8">OFF</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};