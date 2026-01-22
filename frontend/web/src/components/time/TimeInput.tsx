import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatTimeForDisplay, parse24HourTime, convert12To24Hour } from '@/lib/timeUtils';
import { PAGE_STYLES, MODULE_COLORS } from '@/constants/moduleColors';

const TIME_COLORS = MODULE_COLORS.timeTracking;

interface TimeInputProps {
  value: string;           // MySQL datetime or ISO format
  onChange: (value: string) => void;  // Returns HH:MM (24-hour)
  className?: string;
  isEdited?: boolean;      // Triggers orange highlight
  activeState?: 'today' | 'other-day';  // Active entry indicator
}

/**
 * Get period text based on browser locale
 */
const getPeriodText = (period: 'AM' | 'PM'): string => {
  const locale = navigator.language;
  if (locale.startsWith('ko')) {
    return period === 'AM' ? '오전' : '오후';
  }
  return period;
};

/**
 * Custom time input component with 12-hour dropdown picker
 * Optimized for compact calendar cells (90px width)
 */
export const TimeInput = ({ value, onChange, className = '', isEdited = false, activeState }: TimeInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse initial value into 12-hour components and round minutes to nearest 5
  const initialComponents = parse24HourTime(value);
  const roundToNearest5 = (min: number) => Math.min(55, Math.round(min / 5) * 5);

  const [hour, setHour] = useState(initialComponents.hour);
  const [minute, setMinute] = useState(roundToNearest5(initialComponents.minute));
  const [period, setPeriod] = useState(initialComponents.period);

  // Update local state when value prop changes
  useEffect(() => {
    const components = parse24HourTime(value);
    setHour(components.hour);
    setMinute(roundToNearest5(components.minute));
    setPeriod(components.period);
  }, [value]);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX
      });
    }
  }, [isOpen]);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'Enter' && isOpen) {
      applyTime();
    }
  };

  // Apply selected time and close dropdown
  const applyTime = () => {
    const time24 = convert12To24Hour(hour, minute, period);
    onChange(time24);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  // Generate minute options (5-minute increments)
  const minuteOptions = [];
  for (let i = 0; i < 60; i += 5) {
    minuteOptions.push(i);
  }

  // Display text for button
  const displayText = value ? formatTimeForDisplay(value) : '--:-- --';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`
          w-full px-1 py-1 text-xs border text-left
          ${isEdited
            ? 'bg-orange-100 border-orange-300'
            : activeState === 'other-day'
              ? 'bg-red-200 border-red-400'
              : activeState === 'today'
                ? 'bg-green-100 border-green-300'
                : `${PAGE_STYLES.input.border} ${PAGE_STYLES.input.background}`}
          hover:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-500
          ${PAGE_STYLES.input.text}
          ${className}
        `}
      >
        {displayText}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 9999
          }}
          className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.border} border rounded shadow-lg`}
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-col gap-2 p-3 min-w-[200px]">
            {/* Time Selectors */}
            <div className="flex gap-2">
              {/* Hour Select */}
              <div className="flex-1">
                <label className={`block text-xs ${PAGE_STYLES.panel.textSecondary} mb-1`}>Hour</label>
                <select
                  value={hour}
                  onChange={(e) => setHour(parseInt(e.target.value))}
                  className={`w-full text-xs p-1 ${PAGE_STYLES.input.border} border rounded focus:ring-1 focus:ring-yellow-500 focus:outline-none ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
                >
                  {[...Array(12)].map((_, i) => {
                    const h = i + 1;
                    return (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Minute Select */}
              <div className="flex-1">
                <label className={`block text-xs ${PAGE_STYLES.panel.textSecondary} mb-1`}>Min</label>
                <select
                  value={minute}
                  onChange={(e) => setMinute(parseInt(e.target.value))}
                  className={`w-full text-xs p-1 ${PAGE_STYLES.input.border} border rounded focus:ring-1 focus:ring-yellow-500 focus:outline-none ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
                >
                  {minuteOptions.map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period Select */}
              <div className="w-16">
                <label className={`block text-xs ${PAGE_STYLES.panel.textSecondary} mb-1`}>
                  {navigator.language.startsWith('ko') ? '시간' : 'Period'}
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as 'AM' | 'PM')}
                  className={`w-full text-xs p-1 ${PAGE_STYLES.input.border} border rounded focus:ring-1 focus:ring-yellow-500 focus:outline-none ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.text}`}
                >
                  <option value="AM">{getPeriodText('AM')}</option>
                  <option value="PM">{getPeriodText('PM')}</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className={`flex gap-2 justify-end pt-1 border-t ${PAGE_STYLES.panel.border}`}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`px-3 py-1 text-xs ${PAGE_STYLES.panel.textSecondary} ${PAGE_STYLES.interactive.hover} rounded`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyTime}
                className={`px-3 py-1 text-xs text-white ${TIME_COLORS.base} ${TIME_COLORS.hover} rounded`}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
