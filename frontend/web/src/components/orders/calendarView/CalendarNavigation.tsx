/**
 * CalendarNavigation Component
 * Week navigation controls for the calendar view
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

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
        className={`flex items-center px-3 py-1.5 text-sm ${PAGE_STYLES.header.text} ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-lg ${PAGE_STYLES.interactive.hover} transition-colors`}
        title="Previous week"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Prev
      </button>

      {/* Today Button */}
      <button
        onClick={() => onNavigate('today')}
        className={`px-3 py-1.5 text-sm font-medium ${MODULE_COLORS.orders.text} ${MODULE_COLORS.orders.light} border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors`}
      >
        Today
      </button>

      {/* Next Week Button */}
      <button
        onClick={() => onNavigate('next')}
        className={`flex items-center px-3 py-1.5 text-sm ${PAGE_STYLES.header.text} ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-lg ${PAGE_STYLES.interactive.hover} transition-colors`}
        title="Next week"
      >
        Next
        <ChevronRight className="w-4 h-4 ml-1" />
      </button>

      {/* Current Date Range Display */}
      <span className={`text-sm ${PAGE_STYLES.panel.textMuted} ml-4`}>
        Starting: {formatDate(viewStartDate)}
      </span>
    </div>
  );
};

export default CalendarNavigation;
