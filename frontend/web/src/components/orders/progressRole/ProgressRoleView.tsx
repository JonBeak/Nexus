import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, RotateCcw, ChevronDown } from 'lucide-react';
import { ordersApi, authApi } from '../../../services/api';
import RoleCard from './RoleCard';
import type { UserRole } from '../../../types/user';
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

// Production roles organized by workflow rows (5 cards per row)
const ROLE_ROWS: { role: string; label: string }[][] = [
  // Row 1: Design, Management & Material Prep
  [
    { role: 'designer', label: 'Designer' },
    { role: 'manager', label: 'Manager' },
    { role: 'painter', label: 'Painter' },
    { role: 'vinyl_applicator', label: 'Vinyl Applicator' },
    { role: 'cnc_router_operator', label: 'CNC Router Operator' },
  ],
  // Row 2: Fabrication
  [
    { role: 'cut_bender_operator', label: 'Cut & Bend Operator' },
    { role: 'return_fabricator', label: 'Return Fabricator' },
    { role: 'trim_fabricator', label: 'Trim Fabricator' },
    { role: 'return_gluer', label: 'Return Gluer' },
    { role: 'led_installer', label: 'LED Installer' },
  ],
  // Row 3: Assembly & QC
  [
    { role: 'mounting_assembler', label: 'Mounting Assembler' },
    { role: 'face_assembler', label: 'Face Assembler' },
    { role: 'backer_raceway_fabricator', label: 'Backer / Raceway Fabricator' },
    { role: 'backer_raceway_assembler', label: 'Backer / Raceway Assembler' },
    { role: 'qc_packer', label: 'QC/Packer' },
  ],
];

export const ProgressRoleView: React.FC = () => {
  const [tasksByRole, setTasksByRole] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [hoursBack, setHoursBack] = useState<number>(24);
  const [stagedUpdates, setStagedUpdates] = useState<Map<number, TaskUpdate>>(new Map());
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('production_staff');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [showCompleted, hoursBack]);

  const fetchInitialData = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      if (userData.user?.role) {
        setUserRole(userData.user.role as UserRole);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await ordersApi.getTasksByRole(showCompleted, hoursBack);
      setTasksByRole(data);
    } catch (error) {
      console.error('Error fetching tasks by role:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = (
    taskId: number,
    field: 'started' | 'completed',
    value: boolean,
    originalStarted: boolean,
    originalCompleted: boolean
  ) => {
    setStagedUpdates(prev => {
      const newUpdates = new Map(prev);
      const existing = newUpdates.get(taskId) || { task_id: taskId };
      const updated = { ...existing, [field]: value };

      // Determine what the new staged state would be
      const newStarted = updated.started !== undefined ? updated.started : originalStarted;
      const newCompleted = updated.completed !== undefined ? updated.completed : originalCompleted;

      // If both values match original, remove from staged updates (unstage)
      if (newStarted === originalStarted && newCompleted === originalCompleted) {
        newUpdates.delete(taskId);
      } else {
        newUpdates.set(taskId, updated);
      }

      return newUpdates;
    });
  };

  const handleRecordProgress = async () => {
    if (stagedUpdates.size === 0) return;

    try {
      setSaving(true);
      const updates = Array.from(stagedUpdates.values());
      await ordersApi.batchUpdateTasks(updates);

      // Clear staged updates and refresh
      setStagedUpdates(new Map());
      await fetchTasks();

      alert(`Successfully recorded ${updates.length} task updates`);
    } catch (error) {
      console.error('Error recording progress:', error);
      alert('Failed to record progress. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (stagedUpdates.size === 0) return;
    if (confirm(`Reset ${stagedUpdates.size} staged changes?`)) {
      setStagedUpdates(new Map());
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className={PAGE_STYLES.panel.textMuted}>Loading production tasks...</div>
      </div>
    );
  }

  const hasUpdates = stagedUpdates.size > 0;

  return (
    <div className={`h-full flex flex-col ${PAGE_STYLES.page.background} relative`}>
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto p-3">
        {/* Role cards - organized by workflow rows */}
        <div
          className="space-y-2"
          style={{
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)'
          }}
        >
          {ROLE_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
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
    </div>
  );
};

export default ProgressRoleView;
