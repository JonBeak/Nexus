/**
 * TaskItem Component
 * Wrapper around TaskRow for order progress tasks
 *
 * Updated: 2025-01-15 - Added manager session modal support
 */

import React from 'react';
import { ordersApi, orderTasksApi } from '../../../services/api';
import { staffTasksApi } from '../../../services/api/staff/staffTasksApi';
import { TaskRow } from '../common/TaskRow';

interface Props {
  task: any;
  orderNumber: number;
  canRemove?: boolean;
  onUpdated: () => void;
  // Manager session modal support
  isManager?: boolean;
  onOpenSessionsModal?: (taskId: number, taskRole: string | null) => void;
}

export const TaskItem: React.FC<Props> = ({
  task,
  canRemove = false,
  onUpdated,
  isManager = false,
  onOpenSessionsModal
}) => {
  const handleStart = async () => {
    // Use session-based start for non-managers
    try {
      await staffTasksApi.startTask(task.task_id);
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
    // Use session-based stop for non-managers
    try {
      await staffTasksApi.stopTask(task.task_id);
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
      isManager={isManager}
      onOpenSessionsModal={onOpenSessionsModal}
    />
  );
};

export default TaskItem;
