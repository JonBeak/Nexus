import React from 'react';
import { ordersApi, orderTasksApi } from '../../../services/api';
import { TaskRow } from '../common/TaskRow';

interface Props {
  task: any;
  orderNumber: number;
  canRemove?: boolean;
  onUpdated: () => void;
}

export const TaskItem: React.FC<Props> = ({ task, canRemove = false, onUpdated }) => {
  const handleStart = async () => {
    try {
      await orderTasksApi.batchUpdateTasks([{ task_id: task.task_id, started: true }]);
      onUpdated();
    } catch (error) {
      console.error('Error starting task:', error);
    }
  };

  const handleComplete = async () => {
    try {
      await orderTasksApi.batchUpdateTasks([{ task_id: task.task_id, completed: true }]);
      onUpdated();
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handleUncomplete = async () => {
    try {
      await orderTasksApi.batchUpdateTasks([{ task_id: task.task_id, completed: false }]);
      onUpdated();
    } catch (error) {
      console.error('Error uncompleting task:', error);
    }
  };

  const handleUnstart = async () => {
    try {
      await orderTasksApi.batchUpdateTasks([{ task_id: task.task_id, started: false }]);
      onUpdated();
    } catch (error) {
      console.error('Error un-starting task:', error);
    }
  };

  const handleNotesChange = async (notes: string) => {
    try {
      await ordersApi.updateTaskNotes(task.task_id, notes);
      onUpdated();
    } catch (error) {
      console.error('Error updating notes:', error);
      alert('Failed to update notes');
    }
  };

  const handleRemove = async () => {
    try {
      await ordersApi.removeTask(task.task_id);
      onUpdated();
    } catch (error) {
      console.error('Error removing task:', error);
      alert('Failed to remove task. Please try again.');
    }
  };

  return (
    <TaskRow
      task={task}
      onStart={handleStart}
      onComplete={handleComplete}
      onUncomplete={handleUncomplete}
      onUnstart={handleUnstart}
      onNotesChange={handleNotesChange}
      onRemove={canRemove && !task.completed ? handleRemove : undefined}
    />
  );
};

export default TaskItem;
