import React from 'react';
import { Package } from 'lucide-react';
import TaskChecklistItem from './TaskChecklistItem';
import type { UserRole } from '../../../types/user';

interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
}

interface Props {
  role: string;
  label: string;
  tasks: any[];
  stagedUpdates: Map<number, TaskUpdate>;
  onTaskUpdate: (taskId: number, field: 'started' | 'completed', value: boolean, originalStarted: boolean, originalCompleted: boolean) => void;
  onTaskNotesUpdate: () => void;
  showCompleted: boolean;
  hoursBack: number;
  userRole: UserRole;
}

// Format hours into human-readable time window
const formatTimeWindow = (hours: number): string => {
  if (hours === 0) return '';
  if (hours <= 24) return '24 hours';
  if (hours <= 48) return '48 hours';
  if (hours <= 168) return '7 days';
  if (hours <= 720) return '30 days';
  return `${hours} hours`;
};

export const RoleCard: React.FC<Props> = ({
  role,
  label,
  tasks,
  stagedUpdates,
  onTaskUpdate,
  onTaskNotesUpdate,
  showCompleted,
  hoursBack,
  userRole
}) => {
  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const displayTasks = showCompleted ? completedTasks : incompleteTasks;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 flex flex-col h-[400px]">
      {/* Card Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-3 py-2 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Package className="w-4 h-4" />
          <h3 className="font-semibold text-sm">{label}</h3>
        </div>
      </div>

      {/* Task List - Scrollable */}
      <div className="flex-1 overflow-y-auto p-2">
        {displayTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">
              {showCompleted
                ? `No completed tasks${hoursBack > 0 ? ` in the last ${formatTimeWindow(hoursBack)}` : ''}`
                : 'No active tasks'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayTasks.map((task) => (
              <TaskChecklistItem
                key={task.task_id}
                task={task}
                stagedUpdate={stagedUpdates.get(task.task_id)}
                onUpdate={onTaskUpdate}
                onNotesUpdate={onTaskNotesUpdate}
                showCompleted={showCompleted}
                userRole={userRole}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleCard;
