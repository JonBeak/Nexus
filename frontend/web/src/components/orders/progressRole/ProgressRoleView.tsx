/**
 * ProgressRoleView Component
 * Card-based view of tasks organized by production role
 *
 * Updated: 2025-01-16 - Refactored to use AuthContext
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Clock, RotateCcw, ChevronDown } from 'lucide-react';
import { ordersApi, timeSchedulesApi } from '../../../services/api';
import { useTasksSocket } from '../../../hooks/useTasksSocket';
import RoleCard from './RoleCard';
import SessionsModal from '../../staff/SessionsModal';
import { useAuth } from '../../../contexts/AuthContext';
import { useAlert } from '../../../contexts/AlertContext';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
}

// Time window options for completed tasks filter
const TIME_WINDOWS = [
  { value: 24, label: 'Last 24 hours' },
  { value: 48, label: 'Last 48 hours' },
  { value: 168, label: 'Last 7 days' },
  { value: 720, label: 'Last 30 days' },
  { value: 0, label: 'All time' },
];

// Production roles organized by workflow rows (3 cards per row)
const ROLE_ROWS: { role: string; label: string }[][] = [
  // Row 1: Design & Management
  [
    { role: 'designer', label: 'Designer' },
    { role: 'manager', label: 'Manager' },
    { role: 'painter', label: 'Painter' },
  ],
  // Row 2: Material Prep
  [
    { role: 'vinyl_applicator', label: 'Vinyl Applicator' },
    { role: 'cnc_router_operator', label: 'CNC Router Operator' },
  ],
  // Row 3: Fabrication - Cut & Form
  [
    { role: 'cut_bender_operator', label: 'Cut & Bend Operator' },
    { role: 'return_fabricator', label: 'Return Fabricator' },
    { role: 'trim_fabricator', label: 'Trim Fabricator' },
  ],
  // Row 4: Fabrication - Finish
  [
    { role: 'return_gluer', label: 'Return Gluer' },
    { role: 'led_installer', label: 'LED Installer' },
  ],
  // Row 5: Assembly
  [
    { role: 'mounting_assembler', label: 'Mounting Assembler' },
    { role: 'face_assembler', label: 'Face Assembler' },
  ],
  // Row 6: Backer/Raceway & QC
  [
    { role: 'backer_raceway_fabricator', label: 'Backer / Raceway Fabricator' },
    { role: 'backer_raceway_assembler', label: 'Backer / Raceway Assembler' },
    { role: 'qc_packer', label: 'QC/Packer' },
  ],
];

export const ProgressRoleView: React.FC = () => {
  // Get user data from AuthContext (no API call needed!)
  const { userId: currentUserId, userRole, isManager } = useAuth();
  const { showSuccess, showError, showConfirmation } = useAlert();

  const [tasksByRole, setTasksByRole] = useState<any>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const [hoursBack, setHoursBack] = useState<number>(24);
  const [stagedUpdates, setStagedUpdates] = useState<Map<number, TaskUpdate>>(new Map());
  const [saving, setSaving] = useState(false);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());

  // Sessions modal state
  const [sessionsModalTask, setSessionsModalTask] = useState<{
    taskId: number;
    taskRole: string | null;
  } | null>(null);

  // Fetch holidays on mount
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const data = await timeSchedulesApi.getHolidays();
        const holidayDates = new Set(
          data.map((h: any) => h.holiday_date?.split('T')[0])
        );
        setHolidays(holidayDates);
      } catch (error) {
        console.error('Error fetching holidays:', error);
      }
    };
    fetchHolidays();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [showCompleted, hoursBack]);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await ordersApi.getTasksByRole(showCompleted, hoursBack);
      setTasksByRole(data);
    } catch (error) {
      console.error('Error fetching tasks by role:', error);
    }
  }, [showCompleted, hoursBack]);

  // WebSocket subscription for real-time updates
  useTasksSocket({
    onTasksUpdated: fetchTasks,
    onOrderStatus: fetchTasks,
    onOrderCreated: fetchTasks,
    onOrderUpdated: fetchTasks,
    onOrderDeleted: fetchTasks,
    onInvoiceUpdated: fetchTasks,
    onReconnect: fetchTasks
  });

  const handleTaskUpdate = (
    taskId: number,
    field: 'started' | 'completed',
    value: boolean,
    originalStarted: boolean,
    originalCompleted: boolean
  ) => {
    // Only handle 'completed' field in batch updates now
    // 'started' is handled via sessions
    if (field !== 'completed') return;

    setStagedUpdates(prev => {
      const newUpdates = new Map(prev);
      const existing = newUpdates.get(taskId) || { task_id: taskId };
      const updated = { ...existing, [field]: value };

      // If completed matches original, remove from staged updates
      if (value === originalCompleted) {
        newUpdates.delete(taskId);
      } else {
        newUpdates.set(taskId, updated);
      }

      return newUpdates;
    });
  };

  const handleOpenSessionsModal = (taskId: number, taskRole: string | null) => {
    setSessionsModalTask({ taskId, taskRole });
  };

  const handleCloseSessionsModal = () => {
    setSessionsModalTask(null);
  };

  const handleSessionChange = () => {
    // Refresh tasks when sessions change
    fetchTasks();
  };

  // Complete a task directly (from sessions modal)
  const handleCompleteTask = async (taskId: number) => {
    try {
      await ordersApi.batchUpdateTasks([{ task_id: taskId, completed: true }]);
      await fetchTasks();
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  // Find if a task is completed (for sessions modal)
  const isTaskCompleted = (taskId: number): boolean => {
    for (const roleData of Object.values(tasksByRole) as any[]) {
      const task = roleData?.tasks?.find((t: any) => t.task_id === taskId);
      if (task) return !!task.completed;
    }
    return false;
  };

  const handleRecordProgress = useCallback(async () => {
    if (stagedUpdates.size === 0) return;

    try {
      setSaving(true);
      const updates = Array.from(stagedUpdates.values());
      await ordersApi.batchUpdateTasks(updates);

      // Clear staged updates and refresh
      setStagedUpdates(new Map());
      await fetchTasks();

      showSuccess(`Successfully recorded ${updates.length} task updates`);
    } catch (error) {
      console.error('Error recording progress:', error);
      showError('Failed to record progress. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [stagedUpdates, fetchTasks, showSuccess, showError]);

  const handleReset = useCallback(async () => {
    if (stagedUpdates.size === 0) return;
    const confirmed = await showConfirmation({
      title: 'Reset Changes',
      message: `Reset ${stagedUpdates.size} staged changes?`,
      variant: 'warning'
    });
    if (confirmed) {
      setStagedUpdates(new Map());
    }
  }, [stagedUpdates.size, showConfirmation]);

  const hasUpdates = stagedUpdates.size > 0;

  return (
    <div className={`h-full flex flex-col ${PAGE_STYLES.page.background} relative`}>
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto p-3">
        {/* Role cards - organized by workflow rows */}
        <div
          className="space-y-4"
          style={{
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)'
          }}
        >
          {ROLE_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {row.map(({ role, label }) => (
                <RoleCard
                  key={role}
                  role={role}
                  label={label}
                  tasks={tasksByRole[role] || []}
                  stagedUpdates={stagedUpdates}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskNotesUpdate={fetchTasks}
                  showCompleted={showCompleted}
                  hoursBack={hoursBack}
                  userRole={userRole}
                  currentUserId={currentUserId || undefined}
                  onOpenSessionsModal={isManager ? handleOpenSessionsModal : undefined}
                  holidays={holidays}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Empty space at bottom for floating buttons */}
        <div className="h-14" />
      </div>

      {/* Floating action buttons - always visible */}
      <div className="fixed bottom-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showCompleted
              ? 'bg-gray-700 text-white hover:bg-gray-600'
              : 'bg-gray-500 text-white hover:bg-gray-400'
          }`}
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
        >
          <Clock className="w-4 h-4 inline mr-1" />
          {showCompleted ? 'Hide' : 'Show'} Completed
        </button>
        {showCompleted && (
          <div className="relative">
            <select
              value={hoursBack}
              onChange={(e) => setHoursBack(Number(e.target.value))}
              className={`appearance-none px-3 py-2 pr-8 rounded-lg text-sm font-medium ${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border} cursor-pointer transition-colors ${PAGE_STYLES.interactive.hover}`}
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
            >
              {TIME_WINDOWS.map((tw) => (
                <option key={tw.value} value={tw.value}>
                  {tw.label}
                </option>
              ))}
            </select>
            <ChevronDown className={`w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${PAGE_STYLES.panel.textMuted}`} />
          </div>
        )}
        <button
          onClick={handleReset}
          disabled={!hasUpdates}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            hasUpdates
              ? 'bg-red-600 text-white hover:bg-red-700'
              : `${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.textMuted} border ${PAGE_STYLES.panel.border} cursor-not-allowed`
          }`}
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
        >
          <RotateCcw className="w-4 h-4 inline mr-1" />
          Reset
        </button>
        <button
          onClick={handleRecordProgress}
          disabled={!hasUpdates || saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            hasUpdates && !saving
              ? `${MODULE_COLORS.orders.base} text-white ${MODULE_COLORS.orders.hover}`
              : `${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.textMuted} border ${PAGE_STYLES.panel.border} cursor-not-allowed`
          }`}
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
        >
          <CheckCircle className="w-4 h-4 inline mr-1" />
          {saving ? 'Saving...' : `Record${hasUpdates ? ` (${stagedUpdates.size})` : ''}`}
        </button>
      </div>

      {/* Sessions Modal for managers */}
      {sessionsModalTask && currentUserId && (
        <SessionsModal
          taskId={sessionsModalTask.taskId}
          taskRole={sessionsModalTask.taskRole}
          isOpen={true}
          onClose={handleCloseSessionsModal}
          currentUserId={currentUserId}
          isManager={isManager}
          onSessionChange={handleSessionChange}
          taskCompleted={isTaskCompleted(sessionsModalTask.taskId)}
          onComplete={handleCompleteTask}
        />
      )}
    </div>
  );
};

export default ProgressRoleView;
