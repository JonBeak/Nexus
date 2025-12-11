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
  // N/A state - task doesn't exist for this part (darker gray, grabbable for scrolling)
  if (!task) {
    return (
      <td className="px-1 py-1 text-center border-r border-gray-300 bg-gray-200 cursor-grab" data-task-cell>
        <div className="flex items-center justify-center pointer-events-none">
          <Minus className="w-3 h-3 text-gray-500" />
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

  // Completed state - rich green color with inset ring outline
  if (task.completed) {
    return (
      <td
        className={`px-1 py-1 text-center border-r border-gray-300 bg-emerald-100 ring-2 ring-inset ring-emerald-400 ${isClickable ? 'cursor-pointer hover:bg-emerald-200' : ''}`}
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

  // Pending state - role color with empty checkbox and inset ring outline
  return (
    <td
      className={`px-1 py-1 text-center border-r border-gray-300 ${colors.cellBg} ring-2 ring-inset ${colors.ring} ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={handleClick}
      title={task.notes || task.taskName}
      data-task-cell
    >
      <div className="flex items-center justify-center">
        <div className="w-5 h-5 rounded border-2 border-gray-600 bg-white" />
      </div>
    </td>
  );
};

export default TaskCell;
