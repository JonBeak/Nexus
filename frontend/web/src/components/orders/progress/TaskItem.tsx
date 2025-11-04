import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { ordersApi } from '../../../services/api';

interface Props {
  task: any;
  orderNumber: number;
  onUpdated: () => void;
}

export const TaskItem: React.FC<Props> = ({ task, orderNumber, onUpdated }) => {
  const [updating, setUpdating] = useState(false);

  const handleToggle = async () => {
    try {
      setUpdating(true);
      await ordersApi.updateTaskCompletion(orderNumber, task.task_id, !task.completed);
      onUpdated();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
      <button
        onClick={handleToggle}
        disabled={updating}
        className={`
          flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all
          ${task.completed
            ? 'bg-indigo-600 border-indigo-600'
            : 'bg-white border-gray-300 hover:border-indigo-400'
          }
          ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {task.completed && <Check className="w-3 h-3 text-white" />}
      </button>

      <div className="flex-1">
        <span className={`
          text-sm
          ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}
        `}>
          {task.task_name}
        </span>
        {task.completed_at && (
          <div className="text-xs text-gray-500 mt-0.5">
            Completed {new Date(task.completed_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskItem;
