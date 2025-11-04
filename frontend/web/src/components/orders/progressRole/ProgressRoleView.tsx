import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { ordersApi } from '../../../services/api';
import RoleCard from './RoleCard';

interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
}

const ROLE_LABELS = {
  designer: 'Designer',
  vinyl_cnc: 'Vinyl CNC',
  painting: 'Painting',
  cut_bend: 'Cut/Bend',
  leds: 'LEDs',
  packing: 'Packing/QC'
};

export const ProgressRoleView: React.FC = () => {
  const [tasksByRole, setTasksByRole] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [stagedUpdates, setStagedUpdates] = useState<Map<number, TaskUpdate>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [showCompleted]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await ordersApi.getTasksByRole(showCompleted, 24);
      setTasksByRole(data);
    } catch (error) {
      console.error('Error fetching tasks by role:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = (taskId: number, field: 'started' | 'completed', value: boolean) => {
    setStagedUpdates(prev => {
      const newUpdates = new Map(prev);
      const existing = newUpdates.get(taskId) || { task_id: taskId };
      newUpdates.set(taskId, { ...existing, [field]: value });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading production tasks...</div>
      </div>
    );
  }

  const hasUpdates = stagedUpdates.size > 0;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with actions */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Production Progress</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track task progress across all production roles
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showCompleted
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              {showCompleted ? 'Hide' : 'Show'} Recently Completed
            </button>
            <button
              onClick={handleRecordProgress}
              disabled={!hasUpdates || saving}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                hasUpdates && !saving
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-4 h-4 inline mr-2" />
              {saving ? 'Recording...' : `Record Progress${hasUpdates ? ` (${stagedUpdates.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* Role cards grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <RoleCard
              key={role}
              role={role}
              label={label}
              tasks={tasksByRole[role] || []}
              stagedUpdates={stagedUpdates}
              onTaskUpdate={handleTaskUpdate}
              showCompleted={showCompleted}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressRoleView;
