/**
 * DocumentScheduleModal - Schedule email sub-modal
 *
 * Date/time picker for scheduling document emails.
 */

import React, { useRef } from 'react';
import { X, Clock, Calendar, Loader2 } from 'lucide-react';

interface DocumentScheduleModalProps {
  isMobile: boolean;
  loading: boolean;
  scheduledDate: string;
  scheduledTime: string;
  onScheduledDateChange: (v: string) => void;
  onScheduledTimeChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const DocumentScheduleModal: React.FC<DocumentScheduleModalProps> = ({
  isMobile, loading, scheduledDate, scheduledTime,
  onScheduledDateChange, onScheduledTimeChange, onConfirm, onClose,
}) => {
  const scheduleModalRef = useRef<HTMLDivElement>(null);
  const scheduleMouseDownOutsideRef = useRef(false);

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    scheduleMouseDownOutsideRef.current = scheduleModalRef.current ? !scheduleModalRef.current.contains(e.target as Node) : false;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (scheduleMouseDownOutsideRef.current && scheduleModalRef.current && !scheduleModalRef.current.contains(e.target as Node)) {
      onClose();
    }
    scheduleMouseDownOutsideRef.current = false;
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-[60] ${isMobile ? 'flex items-end' : 'flex items-center justify-center'}`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={scheduleModalRef} className={`bg-white shadow-2xl w-full ${isMobile ? 'rounded-t-2xl p-4 pb-6' : 'rounded-lg max-w-sm p-6'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />Schedule Email
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => onScheduledDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className={`w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isMobile ? 'px-4 py-3 min-h-[48px]' : 'px-3 py-2'
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => onScheduledTimeChange(e.target.value)}
              className={`w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isMobile ? 'px-4 py-3 min-h-[48px]' : 'px-3 py-2'
              }`}
            />
          </div>
        </div>
        <div className={`mt-6 ${isMobile ? 'flex flex-col gap-3' : 'flex justify-end gap-3'}`}>
          <button
            onClick={onConfirm}
            disabled={loading || !scheduledDate}
            className={`rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${
              loading || !scheduledDate ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            } ${isMobile ? 'w-full py-3 min-h-[48px] order-1' : 'px-4 py-2'}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Confirm Schedule
          </button>
          <button
            onClick={onClose}
            className={`text-gray-600 hover:text-gray-800 active:text-gray-900 text-sm ${isMobile ? 'w-full py-3 min-h-[44px] order-2' : 'px-4 py-2'}`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
