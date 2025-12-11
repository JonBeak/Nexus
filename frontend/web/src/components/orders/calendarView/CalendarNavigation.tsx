/**
 * CalendarNavigation Component
 * Week navigation controls for the calendar view
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarNavigationProps {
  viewStartDate: Date;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CalendarNavigation: React.FC<CalendarNavigationProps> = ({
  viewStartDate,
  onNavigate
}) => {
  // Format the start date for display
  const formatDate = (date: Date): string => {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Prev Week Button */}
      <button
        onClick={() => onNavigate('prev')}
        className="flex items-center px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title="Previous week"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Prev
      </button>

      {/* Today Button */}
      <button
        onClick={() => onNavigate('today')}
        className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
      >
        Today
      </button>

      {/* Next Week Button */}
      <button
        onClick={() => onNavigate('next')}
        className="flex items-center px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title="Next week"
      >
        Next
        <ChevronRight className="w-4 h-4 ml-1" />
      </button>

      {/* Current Date Range Display */}
      <span className="text-sm text-gray-500 ml-4">
        Starting: {formatDate(viewStartDate)}
      </span>
    </div>
  );
};

export default CalendarNavigation;
