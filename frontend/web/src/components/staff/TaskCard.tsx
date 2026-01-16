/**
 * TaskCard Component
 * Individual task card for staff jobs page
 *
 * Created: 2025-01-07
 * Displays task info with start/stop/complete buttons and session info
 */

import React from 'react';
import { Play, Square, CheckCircle, Clock, Users, MessageSquare } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import type { StaffTask } from '../../services/api/staff/types';
import { formatDuration } from '../../utils/dateUtils';

interface Props {
  task: StaffTask;
  isMyActiveTask: boolean;
  hasAnyActiveTask: boolean;  // User has an active task (may be different)
  onStart: (taskId: number) => void;
  onStop: () => void;
  onComplete: (taskId: number) => void;
  onViewSessions: (taskId: number) => void;
  loading: boolean;
}

/**
 * Format due date relative to today
 */
const formatDueDate = (dateStr: string | null): string => {
  if (!dateStr) return 'No due date';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `Overdue (${Math.abs(diffDays)}d ago)`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days`;

  return date.toLocaleDateString();
};

export const TaskCard: React.FC<Props> = ({
  task,
  isMyActiveTask,
  hasAnyActiveTask,
  onStart,
  onStop,
  onComplete,
  onViewSessions,
  loading
}) => {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const hasOtherWorkersActive = task.active_sessions_count > 0 && !isMyActiveTask;

  // Card border color based on state
  const getBorderClass = () => {
    if (isMyActiveTask) return 'border-blue-500 ring-2 ring-blue-200';
    if (task.completed) return 'border-green-300';
    if (isOverdue) return 'border-red-300';
    return PAGE_STYLES.panel.border;
  };

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${getBorderClass()} ${PAGE_STYLES.panel.background}`}
    >
      {/* Header: Order info + Due date */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${PAGE_STYLES.panel.text} truncate`}>
            Order #{task.order_number}
          </div>
          <div className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate`} title={task.order_name}>
            {task.order_name}
          </div>
        </div>
        <div className={`text-xs px-2 py-1 rounded ${
          isOverdue
            ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {formatDueDate(task.due_date)}
        </div>
      </div>

      {/* Task name + Product type */}
      <div className={`${PAGE_STYLES.header.background} rounded px-2 py-1.5 mb-3`}>
        <div className={`text-sm font-semibold ${PAGE_STYLES.header.text}`}>
          {task.task_name}
        </div>
        <div className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
          {task.part_description || task.product_type || 'Order-level task'}
        </div>
      </div>

      {/* Session stats */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        {/* Active workers */}
        <div className={`flex items-center gap-1 ${
          task.active_sessions_count > 0 ? 'text-blue-600' : PAGE_STYLES.panel.textMuted
        }`}>
          <Users className="w-3.5 h-3.5" />
          <span>
            {task.active_sessions_count > 0
              ? `${task.active_sessions_count} working`
              : 'No one working'}
          </span>
        </div>

        {/* Total time */}
        <div className={`flex items-center gap-1 ${PAGE_STYLES.panel.textMuted}`}>
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDuration(task.total_time_minutes)} total</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {isMyActiveTask ? (
          // User is working on this task - show STOP button
          <button
            onClick={onStop}
            disabled={loading}
            title="Stop working"
            className="flex items-center justify-center p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            <Square className="w-5 h-5" />
          </button>
        ) : (
          // User is not working on this task - show START button
          <button
            onClick={() => onStart(task.task_id)}
            disabled={loading || hasAnyActiveTask || task.completed}
            title={
              task.completed
                ? 'Task is already completed'
                : hasAnyActiveTask
                  ? 'Stop your current task first'
                  : 'Start working on this task'
            }
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              task.completed
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : hasAnyActiveTask
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <Play className="w-4 h-4" />
            Start
          </button>
        )}

        {/* Complete button */}
        <button
          onClick={() => onComplete(task.task_id)}
          disabled={loading || task.completed}
          title={task.completed ? 'Already completed' : 'Mark task as complete'}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
            task.completed
              ? 'bg-green-100 text-green-700'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          {task.completed ? 'Done' : 'Complete'}
        </button>
      </div>

      {/* View sessions link */}
      {(() => {
        const sessionCount = Number(task.total_sessions_count) || 0;
        const notesCount = Number(task.notes_count) || 0;
        const hasSessions = sessionCount > 0;
        return (
          <button
            onClick={() => onViewSessions(task.task_id)}
            className={`w-full mt-2 text-xs flex items-center justify-center gap-1.5 py-1 rounded transition-colors ${
              hasSessions
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : `${PAGE_STYLES.panel.textMuted} hover:text-blue-600`
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>
              {hasSessions
                ? `${sessionCount} session${sessionCount > 1 ? 's' : ''} (${formatDuration(task.total_time_minutes)})`
                : 'No sessions'}
            </span>
            {notesCount > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <MessageSquare className="w-3 h-3" />
                <span>{notesCount}</span>
              </>
            )}
          </button>
        );
      })()}

      {/* My active session indicator */}
      {isMyActiveTask && task.my_active_session && (
        <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span>
            Working since {new Date(task.my_active_session.started_at).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Other workers indicator */}
      {hasOtherWorkersActive && !isMyActiveTask && (
        <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
          {task.active_sessions_count} other staff member{task.active_sessions_count > 1 ? 's' : ''} working on this task
        </div>
      )}
    </div>
  );
};

export default TaskCard;
