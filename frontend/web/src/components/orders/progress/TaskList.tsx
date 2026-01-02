import React from 'react';
import TaskItem from './TaskItem';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface Props {
  tasks: any[];
  orderNumber: number;
  canRemove?: boolean;
  onTaskUpdated: () => void;
}

export const TaskList: React.FC<Props> = ({ tasks, orderNumber, canRemove = false, onTaskUpdated }) => {
  if (tasks.length === 0) {
    return (
      <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted}`}>
        No tasks
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskItem
          key={task.task_id}
          task={task}
          orderNumber={orderNumber}
          canRemove={canRemove}
          onUpdated={onTaskUpdated}
        />
      ))}
    </div>
  );
};

export default TaskList;
