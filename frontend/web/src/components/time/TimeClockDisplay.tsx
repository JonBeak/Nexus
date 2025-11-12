import React from 'react';
import type { ClockStatus, TimeNotification } from '../../types/time';
import ClockSlider from './ClockSlider';
import { formatTime as sharedFormatTime, formatDate as sharedFormatDate } from './utils/timeCalculations';

interface TimeClockDisplayProps {
  clockStatus: ClockStatus | null;
  notifications: TimeNotification[];
  onClockIn: () => void;
  onClockOut: () => void;
  onShowNotifications: () => void;
}

function TimeClockDisplay({
  clockStatus,
  notifications,
  onClockIn,
  onClockOut,
  onShowNotifications
}: TimeClockDisplayProps) {

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-gray-800">Time Clock</h3>
        <button
          onClick={onShowNotifications}
          className="relative bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          Notifications
          {notifications.filter(n => !n.is_read).length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
              {notifications.filter(n => !n.is_read).length}
            </span>
          )}
        </button>
      </div>
      
      <div className="text-center">
        {clockStatus?.isClocked ? (
          <>
            <div className="mb-8">
              <p className="text-lg text-gray-600 mb-2">Clocked in since</p>
              <p className="text-2xl font-bold text-primary-blue">
                {sharedFormatTime(clockStatus.currentEntry!.clock_in)}
              </p>
              <p className="text-gray-500 mt-1">
                {sharedFormatDate(clockStatus.currentEntry!.clock_in)}
              </p>
            </div>
            <ClockSlider
              isClocked={true}
              onConfirm={onClockOut}
            />
          </>
        ) : (
          <>
            <p className="text-lg text-gray-600 mb-8">Not currently clocked in</p>
            <ClockSlider
              isClocked={false}
              onConfirm={onClockIn}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default TimeClockDisplay;
