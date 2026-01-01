import React from 'react';
import type { ClockStatus, TimeNotification } from '../../types/time';
import ClockSlider from './ClockSlider';
import { formatTime as sharedFormatTime, formatDate as sharedFormatDate } from './utils/timeCalculations';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import '../jobEstimation/JobEstimation.css';

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
    <div className={`${PAGE_STYLES.composites.panelContainer} p-8`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>Time Clock</h3>
        <button
          onClick={onShowNotifications}
          className={`relative ${MODULE_COLORS.timeTracking.base} ${MODULE_COLORS.timeTracking.hover} text-white px-4 py-2 rounded-lg font-semibold transition-colors`}
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
              <p className={`text-lg ${PAGE_STYLES.panel.textSecondary} mb-2`}>Clocked in since</p>
              <p className={`text-2xl font-bold ${MODULE_COLORS.timeTracking.text}`}>
                {sharedFormatTime(clockStatus.currentEntry!.clock_in)}
              </p>
              <p className={`${PAGE_STYLES.panel.textMuted} mt-1`}>
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
            <p className={`text-lg ${PAGE_STYLES.panel.textSecondary} mb-8`}>Not currently clocked in</p>
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
