/**
 * StaffJobsPage Component
 * Main page for staff to view and work on tasks
 *
 * Created: 2025-01-07
 * Updated: 2025-01-08 - Redesigned to column-per-task-type layout
 *
 * Shows tasks in horizontal columns: Completed Today + one column per task type
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { HomeButton } from '../common/HomeButton';
import type { AccountUser } from '../../types/user';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { staffTasksApi } from '../../services/api/staff/staffTasksApi';
import { timeSchedulesApi } from '../../services/api/time/timeSchedulesApi';
import type { StaffTask, ActiveTasksResponse, CompletedSessionDisplay } from '../../services/api/staff/types';
import { StickyActiveTaskHeader } from './StickyActiveTaskHeader';
import { TaskColumn } from './TaskColumn';
import { SessionsColumn } from './SessionsColumn';
import { SessionsModal } from './SessionsModal';
import { useTasksSocket } from '../../hooks/useTasksSocket';
import { useEditRequestsSocket } from '../../hooks/useEditRequestsSocket';
import type { SessionStartedPayload, SessionStoppedPayload } from '../../services/socketClient';

interface Props {
  user: AccountUser;
}

export const StaffJobsPage: React.FC<Props> = ({ user }) => {
  // State
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [activeTasks, setActiveTasks] = useState<ActiveTasksResponse | null>(null);
  const [todaySessions, setTodaySessions] = useState<CompletedSessionDisplay[]>([]);
  const [todaySessionsTotal, setTodaySessionsTotal] = useState(0);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [sessionsModalTaskId, setSessionsModalTaskId] = useState<number | null>(null);

  // Load tasks - always include completed to show today's completions
  const loadTasks = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }

      const [tasksResult, activeResult, sessionsResult, holidaysResult] = await Promise.all([
        staffTasksApi.getTasks({
          include_completed: true,
          hours_back: undefined
        }),
        staffTasksApi.getActiveTasks(),
        staffTasksApi.getTodaySessions(),
        timeSchedulesApi.getHolidays()
      ]);

      setTasks(tasksResult?.tasks || []);
      setUserRoles(tasksResult?.user_roles || []);
      setActiveTasks(activeResult || null);
      setTodaySessions(sessionsResult?.sessions || []);
      setTodaySessionsTotal(sessionsResult?.total_time_minutes || 0);

      // Convert holidays to Set of date strings
      const holidayDates = new Set<string>(
        (holidaysResult?.data || []).map((h: { holiday_date: string }) => h.holiday_date.split('T')[0])
      );
      setHolidays(holidayDates);
    } catch (err) {
      console.error('Error loading tasks:', err);
      if (showLoading) {
        setError('Failed to load tasks. Please try again.');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // Silent reload for WebSocket updates (no spinner)
  const silentReload = useCallback(() => {
    loadTasks(false);
  }, [loadTasks]);

  // Handle session started - update active_sessions_count for affected task
  const handleSessionStarted = useCallback((payload: SessionStartedPayload) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.task_id === payload.taskId
          ? { ...task, active_sessions_count: payload.activeSessionsCount }
          : task
      )
    );
  }, []);

  // Handle session stopped - update active_sessions_count for affected task
  const handleSessionStopped = useCallback((payload: SessionStoppedPayload) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.task_id === payload.taskId
          ? { ...task, active_sessions_count: payload.activeSessionsCount }
          : task
      )
    );
  }, []);

  // Initial load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // WebSocket for real-time updates
  useTasksSocket({
    userId: user?.user_id,
    onSessionStarted: handleSessionStarted,
    onSessionStopped: handleSessionStopped,
    onTasksUpdated: loadTasks,
    onSessionNoteCreated: silentReload,
    onSessionNoteUpdated: silentReload,
    onSessionNoteDeleted: silentReload,
    onReconnect: loadTasks,
    enabled: userRoles.length > 0
  });

  // WebSocket for edit request updates (staff receives processed notifications)
  useEditRequestsSocket({
    userId: user?.user_id,
    isManager: false,
    onSessionRequestProcessed: loadTasks, // Refetch when our request is processed (e.g., delete approved)
    enabled: !!user?.user_id
  });

  // Elapsed time counter - increment all active task times every minute
  useEffect(() => {
    if (activeTasks?.has_active_tasks && activeTasks.count > 0) {
      const interval = setInterval(() => {
        setActiveTasks(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            active_tasks: prev.active_tasks.map(at => ({
              ...at,
              elapsed_minutes: at.elapsed_minutes + 1
            }))
          };
        });
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [activeTasks?.has_active_tasks, activeTasks?.count]);

  // Group tasks by task_name (task type)
  const { completedToday, tasksByType, taskTypeOrder } = useMemo(() => {
    const today = new Date().toDateString();
    const completed: StaffTask[] = [];
    const byType: Record<string, StaffTask[]> = {};

    tasks.forEach(task => {
      if (task.completed) {
        const completedAt = task.completed_at ? new Date(task.completed_at) : null;
        if (completedAt?.toDateString() === today) {
          completed.push(task);
        }
      } else {
        const taskType = task.task_name;
        if (!byType[taskType]) {
          byType[taskType] = [];
        }
        byType[taskType].push(task);
      }
    });

    // Sort completed by completion time (most recent first)
    completed.sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    });

    // Sort each task type's list by due date + sort_order
    Object.values(byType).forEach(taskList => {
      taskList.sort((a, b) => {
        if (!a.due_date && !b.due_date) return (a.sort_order || 0) - (b.sort_order || 0);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        const dateCompare = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
    });

    // Order task types by earliest due date in each group
    const typeOrder = Object.keys(byType).sort((a, b) => {
      const aFirst = byType[a][0];
      const bFirst = byType[b][0];
      if (!aFirst?.due_date && !bFirst?.due_date) return a.localeCompare(b);
      if (!aFirst?.due_date) return 1;
      if (!bFirst?.due_date) return -1;
      return new Date(aFirst.due_date).getTime() - new Date(bFirst.due_date).getTime();
    });

    return { completedToday: completed, tasksByType: byType, taskTypeOrder: typeOrder };
  }, [tasks]);

  // Recommended next task (earliest due, lowest sort_order)
  const recommendedTask = useMemo(() => {
    const todoTasks = tasks.filter(t => !t.completed && !t.my_active_session);
    if (todoTasks.length === 0) return null;

    todoTasks.sort((a, b) => {
      if (!a.due_date && !b.due_date) return (a.sort_order || 0) - (b.sort_order || 0);
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      const dateCompare = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    return todoTasks[0];
  }, [tasks]);

  // Handle start task
  const handleStartTask = async (taskId: number) => {
    try {
      await staffTasksApi.startTask(taskId);
      await loadTasks(false);
    } catch (err: any) {
      console.error('Error starting task:', err);
      await loadTasks(false);
    }
  };

  // Handle stop task - now requires taskId
  const handleStopTask = async (taskId: number) => {
    try {
      await staffTasksApi.stopTask(taskId);
      await loadTasks(false);
    } catch (err: any) {
      console.error('Error stopping task:', err);
      await loadTasks(false);
    }
  };

  // Handle complete task
  const handleCompleteTask = async (taskId: number) => {
    try {
      await staffTasksApi.completeTask(taskId);
      await loadTasks(false);
    } catch (err: any) {
      console.error('Error completing task:', err);
      await loadTasks(false);
    }
  };

  // Handle uncomplete task (reopen)
  const handleUncompleteTask = async (taskId: number) => {
    try {
      await staffTasksApi.uncompleteTask(taskId);
      await loadTasks(false);
    } catch (err: any) {
      console.error('Error reopening task:', err);
      await loadTasks(false);
    }
  };

  const isManager = user?.role === 'manager' || user?.role === 'owner';

  // Build set of active task IDs for quick lookup
  const activeTaskIds = useMemo(() => {
    const ids = new Set<number>();
    if (activeTasks?.active_tasks) {
      activeTasks.active_tasks.forEach(at => ids.add(at.task.task_id));
    }
    return ids;
  }, [activeTasks]);

  return (
    <div className={`h-screen flex flex-col ${PAGE_STYLES.background}`}>
      {/* Header */}
      <header className={`flex-shrink-0 ${PAGE_STYLES.header.background} border-b ${PAGE_STYLES.header.border} shadow-sm`}>
        <div className="max-w-full mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <HomeButton />
              <div>
                <h1 className={`text-2xl font-bold ${PAGE_STYLES.header.text}`}>
                  My Production Tasks
                </h1>
                <p className={`text-sm ${PAGE_STYLES.header.textMuted}`}>
                  {userRoles.length > 0
                    ? `Roles: ${userRoles.map(r => r.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(', ')}`
                    : 'No production roles assigned'}
                </p>
              </div>
            </div>

            <button
              onClick={loadTasks}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} hover:bg-gray-50`}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-4 md:px-6 py-4">
        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* No roles message */}
        {!loading && userRoles.length === 0 && (
          <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
            <p className="text-lg mb-2">No production roles assigned</p>
            <p className="text-sm">Contact your manager to get production roles assigned to your account.</p>
          </div>
        )}

        {/* Main Content */}
        {!loading && userRoles.length > 0 && (
          <>
            {/* Sticky Active Task Header */}
            <StickyActiveTaskHeader
              activeTasks={activeTasks}
              recommendedTask={recommendedTask}
              onStop={handleStopTask}
              onStart={handleStartTask}
              onComplete={handleCompleteTask}
              loading={false}
            />

            {/* Horizontal scrolling columns */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
              <div className="flex gap-4 min-w-min h-full">
                {/* Sessions Column */}
                <SessionsColumn
                  sessions={todaySessions}
                  totalMinutes={todaySessionsTotal}
                  onRequestSubmitted={loadTasks}
                />

                {/* Completed Today Column */}
                <TaskColumn
                  title="Completed Today"
                  tasks={completedToday}
                  isCompletedColumn
                  activeTaskIds={activeTaskIds}
                  onStart={handleStartTask}
                  onStop={handleStopTask}
                  onComplete={handleCompleteTask}
                  onUncomplete={handleUncompleteTask}
                  onViewSessions={setSessionsModalTaskId}
                  holidays={holidays}
                  loading={false}
                />

                {/* Task Type Columns */}
                {taskTypeOrder.map(taskType => (
                  <TaskColumn
                    key={taskType}
                    title={taskType}
                    tasks={tasksByType[taskType]}
                    activeTaskIds={activeTaskIds}
                    onStart={handleStartTask}
                    onStop={handleStopTask}
                    onComplete={handleCompleteTask}
                    onUncomplete={handleUncompleteTask}
                    onViewSessions={setSessionsModalTaskId}
                    holidays={holidays}
                    loading={false}
                  />
                ))}
              </div>
            </div>

            {/* No tasks message */}
            {tasks.length === 0 && (
              <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
                <p className="text-lg mb-2">No tasks found</p>
                <p className="text-sm">No tasks are assigned to your production roles right now.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Sessions Modal */}
      <SessionsModal
        taskId={sessionsModalTaskId || 0}
        isOpen={sessionsModalTaskId !== null}
        onClose={() => setSessionsModalTaskId(null)}
        currentUserId={user?.user_id || 0}
        isManager={isManager}
      />
    </div>
  );
};

export default StaffJobsPage;
