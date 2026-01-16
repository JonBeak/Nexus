/**
 * TaskChecklistItem Component
 * Individual task display in the role-based view
 *
 * Updated: 2025-01-15
 * - Managers: Start button opens SessionsModal
 * - Staff/Designers: Start button directly starts/stops their session
 * - Complete button still uses batch update approach
 */

import React, { useState } from 'react';
import { Play, Square, Check, Loader2 } from 'lucide-react';
import type { UserRole } from '../../../types/user';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { staffTasksApi } from '../../../services/api/staff/staffTasksApi';

interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
}

interface Props {
  task: any;
  stagedUpdate?: TaskUpdate;
  onUpdate: (taskId: number, field: 'started' | 'completed', value: boolean, originalStarted: boolean, originalCompleted: boolean) => void;
  onNotesUpdate: () => void;
  showCompleted: boolean;
  userRole: UserRole;
  isManager?: boolean;
  currentUserId?: number;
  onOpenSessionsModal?: (taskId: number, taskRole: string | null) => void;
}

// Roles that can see customer name (Designer and up)
const ROLES_WITH_CUSTOMER_VIEW: UserRole[] = ['designer', 'manager', 'owner'];

// Roles that are considered managers (can assign sessions to others)
const MANAGER_ROLES: UserRole[] = ['manager', 'owner'];

export const TaskChecklistItem: React.FC<Props> = ({
  task,
  stagedUpdate,
  onUpdate,
  onNotesUpdate,
  showCompleted,
  userRole,
  isManager: isManagerProp,
  currentUserId,
  onOpenSessionsModal
}) => {
  const [startingSession, setStartingSession] = useState(false);
  const [stoppingSession, setStoppingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Determine if user is a manager
  const isManager = isManagerProp ?? MANAGER_ROLES.includes(userRole);

  // Original database values
  // Task is considered "started" if any session has ever existed OR started_at is set
  const hasAnySessions = (task.total_sessions_count > 0) || (task.active_sessions_count > 0);
  const originalStarted = !!task.started_at || hasAnySessions;
  const originalCompleted = !!task.completed;

  // Determine current state (staged changes override database values for completed)
  // For "started", we use session-based state (total_sessions_count) or started_at
  const isStarted = hasAnySessions || !!task.started_at;

  const isCompleted = stagedUpdate?.completed !== undefined
    ? stagedUpdate.completed
    : originalCompleted;

  const hasChanges = stagedUpdate !== undefined;
  const canViewCustomer = ROLES_WITH_CUSTOMER_VIEW.includes(userRole);

  // Check if current user has an active session on this task
  const userHasActiveSession = task.my_active_session != null;

  const handleStartClick = async () => {
    if (isManager && onOpenSessionsModal) {
      // Managers open the modal
      onOpenSessionsModal(task.task_id, task.assigned_role);
    } else {
      // Staff directly start/stop their own session
      setSessionError(null);

      if (userHasActiveSession) {
        // Stop session
        try {
          setStoppingSession(true);
          await staffTasksApi.stopTask(task.task_id);
          onNotesUpdate(); // Refresh tasks
        } catch (err: any) {
          console.error('Error stopping session:', err);
          setSessionError(err?.response?.data?.message || 'Failed to stop session');
        } finally {
          setStoppingSession(false);
        }
      } else {
        // Start session
        try {
          setStartingSession(true);
          await staffTasksApi.startTask(task.task_id);
          onNotesUpdate(); // Refresh tasks
        } catch (err: any) {
          console.error('Error starting session:', err);
          setSessionError(err?.response?.data?.message || 'Failed to start session');
        } finally {
          setStartingSession(false);
        }
      }
    }
  };

  const handleCompleteToggle = () => {
    onUpdate(task.task_id, 'completed', !isCompleted, originalStarted, originalCompleted);
  };

  // Build product display: "Specs Display Name [Scope]" or "Job Level" for QC tasks
  const isJobLevelTask = task.part_id === null;
  const productName = isJobLevelTask ? 'Job Level' : (task.specs_display_name || 'Unknown');
  const productDisplay = !isJobLevelTask && task.part_scope
    ? `${productName} [${task.part_scope}]`
    : productName;

  // Determine start button state and appearance
  const isSessionLoading = startingSession || stoppingSession;
  const showActiveIndicator = isStarted && !isManager;

  return (
    <div
      className={`border rounded px-2 py-1.5 transition-all ${
        hasChanges
          ? 'border-orange-400 bg-orange-50'
          : `${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.background}`
      }`}
    >
      {/* Session error message */}
      {sessionError && (
        <div className="text-xs text-red-600 mb-1 px-1">
          {sessionError}
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Main content - 2 lines */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Order Name, Customer Name */}
          <div className={`text-sm ${PAGE_STYLES.panel.text} truncate leading-tight`}>
            <span className="font-medium">{task.order_name}</span>
            {canViewCustomer && task.customer_name && (
              <span className={PAGE_STYLES.panel.textMuted}> - {task.customer_name}</span>
            )}
          </div>

          {/* Line 2: Product [Scope] */}
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate`}
              title={productDisplay}
            >
              {productDisplay}
            </span>
          </div>

          {/* Show timestamps if completed */}
          {showCompleted && task.completed_at && (
            <div className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-0.5`}>
              Completed: {new Date(task.completed_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Task name + Notes + Buttons on right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className={`text-xs font-medium ${PAGE_STYLES.panel.text}`}>
              {task.task_name}
            </div>
            {task.task_notes && (
              <div className={`text-xs ${PAGE_STYLES.panel.textMuted} italic`}>
                {task.task_notes}
              </div>
            )}
            {/* Show active sessions count for managers */}
            {isManager && task.active_sessions_count > 0 && (
              <div className="text-xs text-blue-600">
                {task.active_sessions_count} active
              </div>
            )}
          </div>

          {/* Start/Sessions button */}
          <button
            onClick={handleStartClick}
            disabled={isSessionLoading || isCompleted}
            title={
              isManager
                ? 'Manage sessions'
                : userHasActiveSession
                ? 'Stop working'
                : 'Start working'
            }
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
              isStarted
                ? 'bg-blue-600 text-white'
                : 'bg-white border-2 border-blue-400 text-blue-400 hover:bg-blue-50'
            }`}
          >
            {isSessionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isStarted && !isManager ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" style={{ marginLeft: '1px' }} />
            )}
          </button>

          {/* Complete button */}
          <button
            onClick={handleCompleteToggle}
            title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              isCompleted
                ? 'bg-green-600 text-white'
                : 'bg-white border-2 border-green-400 text-green-400 hover:bg-green-50'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskChecklistItem;
