/**
 * CompactTaskCard Component
 * Mini 2-row task card for compact list display
 *
 * Created: 2025-01-08
 * Updated: 2025-01-08 - Support multiple concurrent active tasks
 */

import React from 'react';
import { Play, Square, CheckCircle, RotateCcw, Users, MessageSquare } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import type { StaffTask } from '../../services/api/staff/types';
import { calculateWorkDaysLeft } from '../orders/calendarView/utils';

interface Props {
  task: StaffTask;
  isMyActiveTask: boolean;
  onStart: (taskId: number) => void;
  onStop: (taskId: number) => void;
  onComplete: (taskId: number) => void;
  onUncomplete: (taskId: number) => void;
  onViewSessions: (taskId: number) => void;
  holidays: Set<string>;
  loading: boolean;
}

/**
 * Get due date badge styling and text based on work days
 */
const getWorkDaysBadge = (
  dueDate: string | null,
  dueTime: string | null,
  holidays: Set<string>
): { text: string; className: string } => {
  if (!dueDate) return { text: 'No date', className: 'bg-gray-100 text-gray-500' };

  const workDaysLeft = calculateWorkDaysLeft(dueDate, dueTime, holidays);

  if (workDaysLeft === null) return { text: 'No date', className: 'bg-gray-100 text-gray-500' };

  if (workDaysLeft < 0) {
    const overdue = Math.abs(workDaysLeft);
    const days = Math.round(overdue);
    return { text: `${days} ${days === 1 ? 'day' : 'days'} overdue`, className: 'bg-red-100 text-red-700' };
  }
  if (workDaysLeft < 1) return { text: 'Today', className: 'bg-orange-100 text-orange-700' };
  if (workDaysLeft < 2) return { text: '1 day', className: 'bg-orange-100 text-orange-700' };
  const days = Math.round(workDaysLeft);
  if (workDaysLeft <= 3) return { text: `${days} ${days === 1 ? 'day' : 'days'}`, className: 'bg-yellow-100 text-yellow-700' };

  return { text: `${days} ${days === 1 ? 'day' : 'days'}`, className: 'bg-gray-100 text-gray-600' };
};

export const CompactTaskCard: React.FC<Props> = ({
  task,
  isMyActiveTask,
  onStart,
  onStop,
  onComplete,
  onUncomplete,
  onViewSessions,
  holidays,
  loading
}) => {
  const dueBadge = getWorkDaysBadge(task.due_date, task.hard_due_date_time || null, holidays);
  const hasActiveWorkers = task.active_sessions_count > 0;
  const hasSessions = Number(task.total_sessions_count) > 0;

  // Card styling based on state (border + background)
  const getCardStyles = () => {
    if (isMyActiveTask) return 'border-2 border-blue-500 bg-blue-50';
    if (task.completed) return 'border-2 border-green-400 bg-green-50';
    if (hasActiveWorkers) return 'border-2 border-yellow-400 bg-yellow-50';
    return 'border border-gray-200 bg-white';
  };

  return (
    <div className={`${getCardStyles()} rounded py-2 px-3 transition-all hover:shadow-sm`}>
      {/* Row 1: Job name (left) + Due date (right) */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-sm font-medium truncate ${task.completed ? 'line-through text-gray-400' : PAGE_STYLES.panel.text}`}>
          {task.order_name}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${dueBadge.className}`}>
          {dueBadge.text}
        </span>
      </div>

      {/* Row 2: Job # (left) + Buttons (right) */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${task.completed ? 'text-gray-400' : PAGE_STYLES.panel.textMuted}`}>
          #{task.order_number}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Sessions button */}
          <button
            onClick={() => onViewSessions(task.task_id)}
            title="View sessions"
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              hasSessions
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Users className="w-3 h-3" />
          </button>

          {/* Start/Stop button */}
          {isMyActiveTask ? (
            <button
              onClick={() => onStop(task.task_id)}
              disabled={loading}
              title="Stop working"
              className="p-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : !task.completed ? (
            <button
              onClick={() => onStart(task.task_id)}
              disabled={loading}
              title="Start this task"
              className="p-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          ) : null}

          {/* Complete/Reopen button */}
          {!task.completed ? (
            <button
              onClick={() => onComplete(task.task_id)}
              disabled={loading}
              title="Mark complete"
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              <CheckCircle className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={() => onUncomplete(task.task_id)}
              disabled={loading}
              title="Reopen task"
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Row 3: Notes preview (only if notes exist) */}
      {(task.notes_count > 0 || task.latest_note) && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-300">
          <button
            onClick={() => onViewSessions(task.task_id)}
            className="w-full text-left flex items-start gap-1.5 group"
            title="View all notes in sessions"
          >
            <MessageSquare className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-gray-500 line-clamp-2 group-hover:text-gray-700">
              {task.latest_note
                ? `${task.latest_note}${task.notes_count > 1 ? ` (+${task.notes_count - 1} more)` : ''}`
                : `${task.notes_count} note${task.notes_count !== 1 ? 's' : ''}`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CompactTaskCard;
