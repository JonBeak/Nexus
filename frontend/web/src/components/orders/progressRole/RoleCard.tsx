import React from 'react';
import { Package } from 'lucide-react';
import TaskChecklistItem from './TaskChecklistItem';

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
  onTaskUpdate: (taskId: number, field: 'started' | 'completed', value: boolean) => void;
  showCompleted: boolean;
}

export const RoleCard: React.FC<Props> = ({
  role,
  label,
  tasks,
  stagedUpdates,
  onTaskUpdate,
  showCompleted
}) => {
  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const displayTasks = showCompleted ? completedTasks : incompleteTasks;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 flex flex-col h-[600px]">
      {/* Card Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5" />
            <h3 className="font-semibold text-lg">{label}</h3>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm font-medium">
            {displayTasks.length} {showCompleted ? 'completed' : 'active'}
          </div>
        </div>
      </div>

      {/* Task List - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{showCompleted ? 'No recently completed tasks' : 'No active tasks'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayTasks.map((task) => (
              <TaskChecklistItem
                key={task.task_id}
                task={task}
                stagedUpdate={stagedUpdates.get(task.task_id)}
                onUpdate={onTaskUpdate}
                showCompleted={showCompleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleCard;
