/**
 * RoleSection Component
 * Displays completed and TODO lists for a single production role
 *
 * Created: 2025-01-08
 */

import React from 'react';
import { CheckCircle, ListTodo } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import type { StaffTask } from '../../services/api/staff/types';
import { CompactTaskCard } from './CompactTaskCard';

interface Props {
  roleName: string;
  completedTasks: StaffTask[];
  todoTasks: StaffTask[];
  activeTaskId: number | null;
  hasAnyActiveTask: boolean;
  onStart: (taskId: number) => void;
  onStop: () => void;
  onComplete: (taskId: number) => void;
  onViewSessions: (taskId: number) => void;
  loading: boolean;
}

/**
 * Format role name for display
 */
const formatRoleName = (role: string): string => {
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const RoleSection: React.FC<Props> = ({
  roleName,
  completedTasks,
  todoTasks,
  activeTaskId,
  hasAnyActiveTask,
  onStart,
  onStop,
  onComplete,
  onViewSessions,
  loading
}) => {
  return (
    <section className="mb-6">
      {/* Role Header */}
      <h2 className={`text-lg font-semibold ${PAGE_STYLES.panel.text} mb-3 flex items-center gap-2`}>
        <span className="w-2 h-2 bg-blue-500 rounded-full" />
        {formatRoleName(roleName)}
      </h2>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Completed Today (Left Column) */}
        <div className={`rounded-lg border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.background}`}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-green-50 rounded-t-lg">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Completed Today ({completedTasks.length})
            </span>
          </div>
          <div className="h-[300px] overflow-y-auto p-2 space-y-2">
            {completedTasks.length === 0 ? (
              <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted} text-sm`}>
                No tasks completed today
              </div>
            ) : (
              completedTasks.map(task => (
                <CompactTaskCard
                  key={task.task_id}
                  task={task}
                  isMyActiveTask={activeTaskId === task.task_id}
                  hasAnyActiveTask={hasAnyActiveTask}
                  onStart={onStart}
                  onStop={onStop}
                  onComplete={onComplete}
                  onViewSessions={onViewSessions}
                  loading={loading}
                />
              ))
            )}
          </div>
        </div>

        {/* TODO (Right Column) */}
        <div className={`rounded-lg border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.background}`}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-blue-50 rounded-t-lg">
            <ListTodo className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              TODO ({todoTasks.length})
            </span>
          </div>
          <div className="h-[300px] overflow-y-auto p-2 space-y-2">
            {todoTasks.length === 0 ? (
              <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted} text-sm`}>
                No pending tasks
              </div>
            ) : (
              todoTasks.map(task => (
                <CompactTaskCard
                  key={task.task_id}
                  task={task}
                  isMyActiveTask={activeTaskId === task.task_id}
                  hasAnyActiveTask={hasAnyActiveTask}
                  onStart={onStart}
                  onStop={onStop}
                  onComplete={onComplete}
                  onViewSessions={onViewSessions}
                  loading={loading}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoleSection;
