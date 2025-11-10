import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { ordersApi } from '../../../services/api';
import ConfirmModal from './ConfirmModal';

interface Props {
  task: any;
  orderNumber: number;
  canRemove?: boolean;
  onUpdated: () => void;
}

export const TaskItem: React.FC<Props> = ({ task, orderNumber, canRemove = false, onUpdated }) => {
  const [updating, setUpdating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmModal(true);
  };

  const handleConfirmRemove = async () => {
    try {
      setRemoving(true);
      setShowConfirmModal(false);
      await ordersApi.removeTask(task.task_id);
      onUpdated();
    } catch (error) {
      console.error('Error removing task:', error);
      alert('Failed to remove task. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <ConfirmModal
        show={showConfirmModal}
        title="Remove Task"
        message={`Are you sure you want to remove the task "${task.task_name}"?`}
        onConfirm={handleConfirmRemove}
        onCancel={() => setShowConfirmModal(false)}
        confirmText="Remove"
        type="warning"
      />
      <div className="group flex items-center space-x-2 py-1 px-2 relative">
        <button
          onClick={handleToggle}
          disabled={updating}
          className={`
            flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all
            ${task.completed
              ? 'bg-indigo-600 border-indigo-600'
              : 'bg-white border-gray-300 hover:border-indigo-400'
            }
            ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {task.completed ? <Check className="w-3 h-3 text-white" /> : null}
        </button>

        <div className="flex-1 min-w-0">
          <span className={`
            text-base leading-tight truncate block
            ${task.completed ? 'text-gray-500 line-through' : 'text-gray-700'}
          `}>
            {task.task_name}
          </span>
        </div>

        {/* Remove Button (shows on hover) */}
        {canRemove && !task.completed && (
          <button
            onClick={handleRemoveClick}
            disabled={removing}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Remove task"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </>
  );
};

export default TaskItem;
