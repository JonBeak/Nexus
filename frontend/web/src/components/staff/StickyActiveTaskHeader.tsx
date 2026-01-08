/**
 * StickyActiveTaskHeader Component
 * Sticky header showing current active tasks (multiple supported) or recommended next task
 *
 * Created: 2025-01-08
 * Updated: 2025-01-08 - Support for multiple concurrent active tasks
 */

import React from 'react';
import { Clock, Square, Play, AlertCircle, CheckCircle } from 'lucide-react';
import type { ActiveTasksResponse, StaffTask } from '../../services/api/staff/types';

interface Props {
  activeTasks: ActiveTasksResponse | null;
  recommendedTask: StaffTask | null;
  onStop: (taskId: number) => void;
  onStart: (taskId: number) => void;
  onComplete: (taskId: number) => void;
  loading: boolean;
}

/**
 * Format minutes as human-readable duration
 */
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export const StickyActiveTaskHeader: React.FC<Props> = ({
  activeTasks,
  recommendedTask,
  onStop,
  onStart,
  onComplete,
  loading
}) => {
  const hasActiveTasks = activeTasks?.has_active_tasks && activeTasks.active_tasks.length > 0;

  return (
    <div className="sticky top-0 z-10 mb-6">
      {hasActiveTasks ? (
        // Multiple Active Tasks Display - Horizontal Cards
        <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg shadow-md">
          <div className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-3">
            Currently Working On ({activeTasks.count} task{activeTasks.count > 1 ? 's' : ''})
          </div>

          {/* Horizontal scrollable task cards */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {activeTasks.active_tasks.map((activeTask) => (
              <div
                key={activeTask.session.session_id}
                className="flex-shrink-0 flex-1 min-w-[240px] max-w-[320px] p-3 bg-white rounded-lg border border-blue-200 shadow-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-sm font-semibold text-blue-900 truncate">
                      {activeTask.task.task_name}
                    </div>
                    <div className="text-xs text-blue-700 truncate">
                      #{activeTask.task.order_number} - {activeTask.task.order_name}
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0 mt-1" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-blue-700 text-sm">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">
                      {formatDuration(activeTask.elapsed_minutes)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onStop(activeTask.task.task_id)}
                      disabled={loading}
                      className="flex items-center gap-1 px-2 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      <Square className="w-3 h-3" />
                      Stop
                    </button>
                    <button
                      onClick={() => onComplete(activeTask.task.task_id)}
                      disabled={loading}
                      className="flex items-center gap-1 px-2 py-1.5 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Done
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // No Active Tasks - Show Recommended
        <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                  No Current Task
                </div>
                {recommendedTask ? (
                  <>
                    <div className="text-sm text-gray-700 mt-1">
                      <span className="font-medium">Recommended next:</span>{' '}
                      <span className="text-gray-900">{recommendedTask.task_name}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Order #{recommendedTask.order_number} - {recommendedTask.order_name}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 mt-1">
                    No pending tasks available
                  </div>
                )}
              </div>
            </div>

            {recommendedTask && (
              <button
                onClick={() => onStart(recommendedTask.task_id)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start Recommended
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StickyActiveTaskHeader;
