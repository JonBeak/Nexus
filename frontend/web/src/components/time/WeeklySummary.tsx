import React from 'react';
import type { WeeklyData, WeeklyEntry } from '../../types/time';

interface WeeklySummaryProps {
  weeklyData: WeeklyData | null;
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  onRequestEdit: (entry: WeeklyEntry) => void;
  onRequestDelete: (entry: WeeklyEntry) => void;
}

function WeeklySummary({ 
  weeklyData, 
  weekOffset, 
  onWeekChange, 
  onRequestEdit, 
  onRequestDelete 
}: WeeklySummaryProps) {
  // Helper function to safely format numbers
  const formatHours = (value: unknown): string => {
    // Handle null, undefined, empty string
    if (value == null || value === '') {
      // If weekTotal is null, calculate it from entries as fallback
      if (value === null && weeklyData?.entries?.length) {
        const calculated = weeklyData.entries.reduce((sum, entry) => {
          const hours = Number(entry.total_hours) || 0;
          return sum + hours;
        }, 0);
        return calculated.toFixed(2);
      }
      return '0.00';
    }
    
    // Convert to number
    const num = Number(value);
    
    // Check if it's a valid number
    if (isNaN(num)) {
      return '0.00';
    }
    
    return num.toFixed(2);
  };
  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';

    // Parse datetime string directly without timezone conversion
    const cleanDateString = dateString.replace(' ', 'T').replace('.000Z', '');
    const hour = parseInt(cleanDateString.substring(11, 13) || '0');
    const minute = parseInt(cleanDateString.substring(14, 16) || '0');
    
    // Format time manually to avoid timezone conversion
    const localDate = new Date(2000, 0, 1, hour, minute); // Use arbitrary date, just for time formatting
    return localDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    
    // Parse datetime string directly without timezone conversion
    const cleanDateString = dateString.replace(' ', 'T').replace('.000Z', '');
    const year = parseInt(cleanDateString.substring(0, 4));
    const month = parseInt(cleanDateString.substring(5, 7)) - 1;
    const day = parseInt(cleanDateString.substring(8, 10));
    
    // Create local date to avoid timezone conversion
    const localDate = new Date(year, month, day);
    return localDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-4 sm:p-8">
      {/* Mobile-friendly header */}
      <div className="mb-6">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-0">Weekly Summary</h3>
        
        {/* Week range - full width on mobile */}
        <div className="text-center mb-4">
          <span className="font-semibold text-gray-700 text-sm sm:text-base">
            {weeklyData && formatWeekRange(weeklyData.weekStart, weeklyData.weekEnd)}
          </span>
        </div>
        
        {/* Navigation buttons - full width on mobile */}
        <div className="flex justify-center space-x-2 sm:space-x-4">
          <button
            onClick={() => onWeekChange(weekOffset - 1)}
            className="bg-gray-200 hover:bg-gray-300 p-2 sm:p-3 rounded-lg transition-colors flex-1 sm:flex-initial"
          >
            <span className="text-gray-700 text-sm sm:text-base">← Previous</span>
          </button>
          <button
            onClick={() => onWeekChange(weekOffset + 1)}
            disabled={weekOffset >= 0}
            className="bg-gray-200 hover:bg-gray-300 p-2 sm:p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial"
          >
            <span className="text-gray-700 text-sm sm:text-base">Next →</span>
          </button>
        </div>
      </div>

      {weeklyData?.entries?.length > 0 ? (
        <>
          {/* Mobile card layout - show on small screens */}
          <div className="block sm:hidden space-y-4">
            {weeklyData.entries.map((entry: WeeklyEntry) => (
              <div key={entry.entry_id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-gray-800">{formatDate(entry.clock_in)}</div>
                    <div className="text-sm text-gray-600">
                      {formatTime(entry.clock_in)} - {formatTime(entry.clock_out)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-primary-blue">{formatHours(entry.total_hours)}h</div>
                    {entry.break_minutes > 0 && (
                      <div className="text-xs text-gray-500">{entry.break_minutes}min break</div>
                    )}
                  </div>
                </div>
                
                {(entry.status === 'completed' && !entry.request_id) && (
                  <div className="flex space-x-2 pt-2 border-t border-gray-300">
                    <button
                      onClick={() => onRequestEdit(entry)}
                      className="flex-1 bg-primary-blue hover:bg-primary-blue-dark text-white text-xs py-2 px-3 rounded font-semibold transition-colors"
                    >
                      Request Edit
                    </button>
                    <button
                      onClick={() => onRequestDelete(entry)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-3 rounded font-semibold transition-colors"
                    >
                      Request Delete
                    </button>
                  </div>
                )}
                {entry.request_id && (
                  <div className="pt-2 border-t border-gray-300">
                    <span className="text-yellow-600 font-semibold text-sm">Edit Pending</span>
                  </div>
                )}
              </div>
            ))}
            
            {/* Week total for mobile */}
            <div className="border-2 border-primary-blue rounded-lg p-4 bg-primary-blue/5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700">Week Total:</span>
                <span className="font-bold text-xl text-primary-blue">{formatHours(weeklyData.weekTotal)}h</span>
              </div>
            </div>
          </div>

          {/* Desktop table layout - show on larger screens */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Clock In</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Clock Out</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Break (min)</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Total Hours</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.entries.map((entry: WeeklyEntry) => (
                  <tr key={entry.entry_id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2">{formatDate(entry.clock_in)}</td>
                    <td className="py-3 px-2">{formatTime(entry.clock_in)}</td>
                    <td className="py-3 px-2">{formatTime(entry.clock_out)}</td>
                    <td className="py-3 px-2">{entry.break_minutes || 0}</td>
                    <td className="py-3 px-2 font-semibold">{formatHours(entry.total_hours)}</td>
                    <td className="py-3 px-2">
                      {entry.status === 'completed' && !entry.request_id && (
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => onRequestEdit(entry)}
                            className="text-primary-blue hover:text-primary-blue-dark font-semibold text-sm"
                          >
                            Request Edit
                          </button>
                          <button
                            onClick={() => onRequestDelete(entry)}
                            className="text-red-600 hover:text-red-800 font-semibold text-sm"
                          >
                            Request Delete
                          </button>
                        </div>
                      )}
                      {entry.request_id && (
                        <span className="text-yellow-600 font-semibold">Edit Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={4} className="py-3 px-2 font-bold text-gray-700">Week Total:</td>
                  <td className="py-3 px-2 font-bold text-xl text-primary-blue">{formatHours(weeklyData.weekTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-500 py-8">No time entries for this week</p>
      )}
    </div>
  );
}

export default WeeklySummary;
  const formatWeekRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startStr = start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const endStr = end.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    return `${startStr} - ${endStr}`;
  };
