/**
 * TaskCell Component
 * Renders a task completion cell with appropriate state icon and colors
 * States: ✓ (complete - green), ◯ (pending - role color), - (N/A - dark gray)
 */

import React from 'react';
import { Check, Minus } from 'lucide-react';
import { PartTask } from './types';
import { getRoleColors } from './roleColors';

interface Props {
  task: PartTask | undefined;  // undefined = N/A (task doesn't apply to this part)
  onToggle?: (taskId: number, completed: boolean) => void;
  disabled?: boolean;
}

export const TaskCell: React.FC<Props> = ({ task, onToggle, disabled = false }) => {
  // N/A state - task doesn't exist for this part (dark gray)
  if (!task) {
    return (
      <td className="px-1 py-1 text-center border-r border-gray-200 bg-gray-100" data-task-cell>
        <div className="flex items-center justify-center">
          <Minus className="w-3 h-3 text-gray-400" />
        </div>
      </td>
    );
  }

  const colors = getRoleColors(task.role);
  const isClickable = !disabled && onToggle;

  const handleClick = () => {
    if (isClickable) {
      onToggle(task.taskId, !task.completed);
    }
  };

  // Completed state - rich green color
  if (task.completed) {
    return (
      <td
        className={`px-1 py-1 text-center border-r border-gray-200 bg-emerald-100 ${isClickable ? 'cursor-pointer hover:bg-emerald-200' : ''}`}
        onClick={handleClick}
        title={task.notes || task.taskName}
        data-task-cell
      >
        <div className="flex items-center justify-center">
          <div className="w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </div>
      </td>
    );
  }

  // Pending state - role color with empty checkbox (no circle icon)
  return (
    <td
      className={`px-1 py-1 text-center border-r border-gray-200 ${colors.cellBg} ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={handleClick}
      title={task.notes || task.taskName}
      data-task-cell
    >
      <div className="flex items-center justify-center">
        <div className={`w-5 h-5 rounded border-2 ${colors.border} bg-white`} />
      </div>
    </td>
  );
};

export default TaskCell;
