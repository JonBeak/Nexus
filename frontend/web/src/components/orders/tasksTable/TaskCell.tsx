/**
 * TaskCell Component
 * Renders a task completion cell with checkbox and note below
 * States: checkmark (complete - green), empty box (pending - role color), dash (N/A - dark gray)
 */

import React from 'react';
import { Check, Minus } from 'lucide-react';
import { TaskCellProps } from './types';
import { getRoleColors } from './roleColors';
import { PAGE_STYLES } from '../../../constants/moduleColors';

export const TaskCell: React.FC<TaskCellProps> = ({ task, onToggle, disabled = false }) => {
  // N/A state - task doesn't exist for this part (darker gray, grabbable for scrolling)
  if (!task) {
    return (
      <td className={`px-1 py-1 text-center border-r ${PAGE_STYLES.panel.border} ${PAGE_STYLES.header.background} cursor-grab`} data-task-cell>
        <div className="flex items-center justify-center pointer-events-none">
          <Minus className={`w-3 h-3 ${PAGE_STYLES.panel.textMuted}`} />
        </div>
      </td>
    );
  }

  const colors = getRoleColors(task.role);
  const isClickable = !disabled && onToggle;
  const hasNote = !!task.notes;

  const handleClick = () => {
    if (isClickable) {
      onToggle(task.taskId, !task.completed);
    }
  };

  // Completed state - rich green color with inset ring outline
  if (task.completed) {
    return (
      <td
        className={`px-1 text-center border-r ${PAGE_STYLES.panel.border} bg-emerald-100 ring-2 ring-inset ring-emerald-400 ${isClickable ? 'cursor-pointer hover:bg-emerald-200' : ''}`}
        onClick={handleClick}
        title={task.notes || task.taskName}
        data-task-cell
        style={{ paddingTop: hasNote ? '4px' : '4px', paddingBottom: hasNote ? '2px' : '4px' }}
      >
        <div className="flex flex-col items-center">
          <div className="w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
          {hasNote && (
            <span
              className="text-emerald-800 mt-0.5 leading-tight text-center max-w-[70px] break-words"
              style={{ fontSize: '9px', lineHeight: '1.1' }}
            >
              {task.notes}
            </span>
          )}
        </div>
      </td>
    );
  }

  // Pending state - role color with empty checkbox and inset ring outline
  return (
    <td
      className={`px-1 text-center border-r ${PAGE_STYLES.panel.border} ${colors.cellBg} ring-2 ring-inset ${colors.ring} ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={handleClick}
      title={task.notes || task.taskName}
      data-task-cell
      style={{ paddingTop: hasNote ? '4px' : '4px', paddingBottom: hasNote ? '2px' : '4px' }}
    >
      <div className="flex flex-col items-center">
        <div className={`w-5 h-5 rounded border-2 ${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.background} flex-shrink-0`} />
        {hasNote && (
          <span
            className="text-gray-700 mt-0.5 leading-tight text-center max-w-[70px] break-words"
            style={{ fontSize: '9px', lineHeight: '1.1' }}
          >
            {task.notes}
          </span>
        )}
      </div>
    </td>
  );
};

export default TaskCell;
