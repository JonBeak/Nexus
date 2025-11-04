import React from 'react';
import { Play, CheckCircle } from 'lucide-react';

interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
}

interface Props {
  task: any;
  stagedUpdate?: TaskUpdate;
  onUpdate: (taskId: number, field: 'started' | 'completed', value: boolean) => void;
  showCompleted: boolean;
}

export const TaskChecklistItem: React.FC<Props> = ({
  task,
  stagedUpdate,
  onUpdate,
  showCompleted
}) => {
  // Determine current state (staged changes override database values)
  const isStarted = stagedUpdate?.started !== undefined
    ? stagedUpdate.started
    : !!task.started_at;

  const isCompleted = stagedUpdate?.completed !== undefined
    ? stagedUpdate.completed
    : task.completed;

  const hasChanges = stagedUpdate !== undefined;

  const handleStartToggle = () => {
    if (showCompleted) return; // Don't allow changes in completed view
    onUpdate(task.task_id, 'started', !isStarted);
  };

  const handleCompleteToggle = () => {
    if (showCompleted) return; // Don't allow changes in completed view except uncheck
    onUpdate(task.task_id, 'completed', !isCompleted);
  };

  return (
    <div
      className={`border rounded-lg p-3 transition-all ${
        hasChanges
          ? 'border-indigo-400 bg-indigo-50'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      {/* Task info */}
      <div className="mb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="font-medium text-gray-900">
              Order #{task.order_number}: {task.order_name}
            </div>
            <div className="text-sm text-gray-600 mt-0.5">
              {task.customer_name} • {task.product_type}
              {task.part_number && ` • Part ${task.part_number}`}
            </div>
          </div>
        </div>
      </div>

      {/* Task name */}
      <div className="mb-3 text-sm font-medium text-gray-800 bg-gray-100 px-2 py-1 rounded">
        {task.task_name}
      </div>

      {/* Dual checkbox controls */}
      <div className="flex items-center space-x-4">
        {/* Start checkbox */}
        <button
          onClick={handleStartToggle}
          disabled={showCompleted && isCompleted}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            isStarted
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } ${showCompleted && isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
              isStarted
                ? 'bg-blue-600 border-blue-600'
                : 'bg-white border-gray-300'
            }`}
          >
            {isStarted && <Play className="w-2.5 h-2.5 text-white fill-white" />}
          </div>
          <span>Start</span>
        </button>

        {/* Complete checkbox */}
        <button
          onClick={handleCompleteToggle}
          disabled={false} // Always allow toggling complete
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            isCompleted
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
              isCompleted
                ? 'bg-green-600 border-green-600'
                : 'bg-white border-gray-300'
            }`}
          >
            {isCompleted && <CheckCircle className="w-3 h-3 text-white" />}
          </div>
          <span>Complete</span>
        </button>
      </div>

      {/* Show if staged changes exist */}
      {hasChanges && (
        <div className="mt-2 text-xs text-indigo-600 font-medium">
          ✓ Staged for recording
        </div>
      )}

      {/* Show timestamps if completed */}
      {showCompleted && task.completed_at && (
        <div className="mt-2 text-xs text-gray-500">
          Completed: {new Date(task.completed_at).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default TaskChecklistItem;
