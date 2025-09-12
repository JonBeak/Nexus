import React from 'react';

interface ClockStatus {
  isClocked: boolean;
  currentEntry?: {
    clock_in: string;
    entry_id: number;
  };
}

interface TimeClockDisplayProps {
  clockStatus: ClockStatus | null;
  notifications: any[];
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
  const formatTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

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
            <div className="mb-6">
              <p className="text-lg text-gray-600 mb-2">Clocked in since</p>
              <p className="text-2xl font-bold text-primary-blue">
                {formatTime(clockStatus.currentEntry!.clock_in)}
              </p>
              <p className="text-gray-500 mt-1">
                {formatDate(clockStatus.currentEntry!.clock_in)}
              </p>
            </div>
            <button
              onClick={onClockOut}
              className="bg-red-600 hover:bg-red-700 text-white px-12 py-6 rounded-2xl font-bold text-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Clock Out
            </button>
          </>
        ) : (
          <>
            <p className="text-lg text-gray-600 mb-6">Not currently clocked in</p>
            <button
              onClick={onClockIn}
              className="bg-green-600 hover:bg-green-700 text-white px-12 py-6 rounded-2xl font-bold text-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Clock In
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default TimeClockDisplay;