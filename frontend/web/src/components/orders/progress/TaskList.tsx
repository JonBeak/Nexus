import React from 'react';
import TaskItem from './TaskItem';

interface Props {
  tasks: any[];
  orderNumber: number;
  onTaskUpdated: () => void;
}

export const TaskList: React.FC<Props> = ({ tasks, orderNumber, onTaskUpdated }) => {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No tasks for this part
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
          onUpdated={onTaskUpdated}
        />
      ))}
    </div>
  );
};

export default TaskList;
