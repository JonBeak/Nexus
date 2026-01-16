/**
 * TaskColumn Component
 * Single column for a task type showing TODO or completed tasks
 *
 * Created: 2025-01-08
 * Updated: 2025-01-08 - Support multiple concurrent active tasks
 */

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import type { StaffTask } from '../../services/api/staff/types';
import { CompactTaskCard } from './CompactTaskCard';

interface Props {
  title: string;
  tasks: StaffTask[];
  isCompletedColumn?: boolean;
  activeTaskIds: Set<number>;
  onStart: (taskId: number) => void;
  onStop: (taskId: number) => void;
  onComplete: (taskId: number) => void;
  onUncomplete: (taskId: number) => void;
  onViewSessions: (taskId: number) => void;
  holidays: Set<string>;
  loading: boolean;
}

export const TaskColumn: React.FC<Props> = ({
  title,
  tasks,
  isCompletedColumn = false,
  activeTaskIds,
  onStart,
  onStop,
  onComplete,
  onUncomplete,
  onViewSessions,
  holidays,
  loading
}) => {
  return (
    <div className={`flex-shrink-0 w-72 flex flex-col rounded-lg border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.background}`}>
      {/* Column Header */}
      <div className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 rounded-t-lg ${
        isCompletedColumn ? 'bg-green-50' : 'bg-blue-50'
      }`}>
        {isCompletedColumn && <CheckCircle className="w-4 h-4 text-green-600" />}
        <span className={`text-sm font-medium truncate ${
          isCompletedColumn ? 'text-green-800' : 'text-blue-800'
        }`} title={title}>
          {title}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          isCompletedColumn ? 'bg-green-200 text-green-700' : 'bg-blue-200 text-blue-700'
        }`}>
          {tasks.length}
        </span>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {tasks.length === 0 ? (
          <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted} text-xs`}>
            {isCompletedColumn ? 'No tasks completed today' : 'No pending tasks'}
          </div>
        ) : (
          tasks.map(task => (
            <CompactTaskCard
              key={task.task_id}
              task={task}
              isMyActiveTask={activeTaskIds.has(task.task_id)}
              onStart={onStart}
              onStop={onStop}
              onComplete={onComplete}
              onUncomplete={onUncomplete}
              onViewSessions={onViewSessions}
              holidays={holidays}
              loading={loading}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TaskColumn;
