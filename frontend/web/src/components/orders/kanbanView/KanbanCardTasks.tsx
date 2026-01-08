/**
 * KanbanCardTasks - Expandable task list for Kanban cards
 * Shows tasks grouped by parts with headers
 */

import React from 'react';
import { PlayCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { OrderTask, OrderPart } from '../../../types/orders';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface KanbanCardTasksProps {
  parts: OrderPart[];
  loading?: boolean;
  onTaskStart: (taskId: number) => void;
  onTaskComplete: (taskId: number) => void;
  onTaskUncomplete: (taskId: number) => void;
  onTaskUnstart: (taskId: number) => void;
}

export const KanbanCardTasks: React.FC<KanbanCardTasksProps> = ({
  parts,
  loading,
  onTaskStart,
  onTaskComplete,
  onTaskUncomplete,
  onTaskUnstart
}) => {
  if (loading) {
    return (
      <div className={`border-t ${PAGE_STYLES.panel.border} px-3 py-3 flex items-center justify-center`}>
        <Loader2 className={`w-4 h-4 animate-spin ${PAGE_STYLES.panel.textMuted}`} />
      </div>
    );
  }

  if (!parts.length) {
    return (
      <div className={`border-t ${PAGE_STYLES.panel.border} px-3 py-2`}>
        <p className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>No tasks</p>
      </div>
    );
  }

  return (
    <div className={`task-controls border-t ${PAGE_STYLES.panel.border}`} onClick={(e) => e.stopPropagation()}>
      {parts.map((part, idx) => (
        <div key={part.part_id}>
          {/* Part Header */}
          <div className={`px-3 py-1.5 ${PAGE_STYLES.header.background} ${idx > 0 ? `border-t ${PAGE_STYLES.panel.border}` : ''}`}>
            <span className={`text-xs font-medium ${PAGE_STYLES.header.text}`}>
              {part.product_type}
              {part.part_scope && ` - ${part.part_scope}`}
            </span>
          </div>

          {/* Tasks for this part */}
          <div className="px-3 py-1.5 space-y-1">
            {(part.tasks || []).map(task => (
              <div key={task.task_id} className="flex items-center gap-2 group">
                {/* Status icon - clickable */}
                <div className="flex-shrink-0">
                  {task.completed ? (
                    <button
                      onClick={() => onTaskUncomplete(task.task_id)}
                      className="hover:opacity-70 transition-opacity"
                      title="Mark as not completed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </button>
                  ) : task.started_at ? (
                    <button
                      onClick={() => onTaskUnstart(task.task_id)}
                      className="hover:opacity-70 transition-opacity"
                      title="Mark as not started"
                    >
                      <PlayCircle className="w-4 h-4 text-blue-500" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onTaskComplete(task.task_id)}
                      className="hover:opacity-70 transition-opacity"
                      title="Mark as completed"
                    >
                      <div className={`w-4 h-4 rounded-full border-2 ${PAGE_STYLES.panel.border} hover:border-emerald-400`} />
                    </button>
                  )}
                </div>

                {/* Task name */}
                <span className={`
                  text-xs truncate flex-shrink-0
                  ${task.completed
                    ? `line-through ${PAGE_STYLES.panel.textMuted}`
                    : task.started_at
                      ? 'text-blue-700 font-medium'
                      : PAGE_STYLES.panel.text
                  }
                `}>
                  {task.task_name}
                </span>

                {/* Task notes */}
                {task.notes && (
                  <span className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate flex-1 min-w-0`}>
                    {task.notes}
                  </span>
                )}

                {/* Start button for not-started tasks */}
                {!task.completed && !task.started_at && (
                  <button
                    onClick={() => onTaskStart(task.task_id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-blue-600 hover:bg-blue-100 rounded"
                    title="Start task"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KanbanCardTasks;
