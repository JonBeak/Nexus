/**
 * TasksManager - Manage production task definitions
 * Includes drag-and-drop reordering, role assignment, and CRUD operations
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Pencil, Trash2, Lock, RefreshCw, AlertCircle, X } from 'lucide-react';
import { settingsApi, TaskDefinition, ProductionRole } from '../../services/api/settings';
import { Notification } from '../inventory/Notification';

// =============================================================================
// Sortable Task Row Component
// =============================================================================

interface SortableTaskRowProps {
  task: TaskDefinition;
  roles: ProductionRole[];
  onEdit: (task: TaskDefinition) => void;
  onDeactivate: (taskId: number) => void;
  onRoleChange: (taskId: number, roleKey: string) => void;
  disabled?: boolean;
}

const SortableTaskRow: React.FC<SortableTaskRowProps> = ({
  task,
  roles,
  onEdit,
  onDeactivate,
  onRoleChange,
  disabled
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.task_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: isDragging ? '3px solid #3b82f6' : 'none'
  };

  const currentRole = roles.find(r => r.role_key === task.assigned_role);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      {/* Drag Handle */}
      <td className="px-4 py-3 w-12">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-100 rounded transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
      </td>

      {/* Task Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-900 font-medium">{task.task_name}</span>
          {task.is_system && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
              title="System task - cannot be deleted"
            >
              <Lock className="w-3 h-3" />
              System
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>
        )}
      </td>

      {/* Role Assignment */}
      <td className="px-4 py-3 w-48">
        <select
          value={task.assigned_role}
          onChange={(e) => onRoleChange(task.task_id, e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          style={{
            borderLeftColor: currentRole?.color_hex || '#d1d5db',
            borderLeftWidth: '3px'
          }}
        >
          {roles.map(role => (
            <option key={role.role_key} value={role.role_key}>
              {role.display_name}
            </option>
          ))}
        </select>
      </td>

      {/* Display Order */}
      <td className="px-4 py-3 w-16 text-center">
        <span className="text-sm text-gray-500">{task.display_order}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-24">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit task"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {!task.is_system && (
            <button
              onClick={() => {
                if (window.confirm(`Deactivate "${task.task_name}"? It will no longer appear in production.`)) {
                  onDeactivate(task.task_id);
                }
              }}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Deactivate task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// =============================================================================
// Edit Task Modal
// =============================================================================

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDefinition | null;
  roles: ProductionRole[];
  onSave: (taskId: number, updates: { task_name: string; description: string; assigned_role: string }) => Promise<boolean>;
  saving?: boolean;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  roles,
  onSave,
  saving = false
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignedRole, setAssignedRole] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setName(task.task_name);
      setDescription(task.description || '');
      setAssignedRole(task.assigned_role);
      setError(null);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Task name cannot be empty');
      return;
    }
    const success = await onSave(task.task_id, {
      task_name: trimmedName,
      description: description.trim(),
      assigned_role: assignedRole
    });
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Edit Task
              {task.is_system && <Lock className="h-4 w-4 text-gray-400" />}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Task Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
                disabled={saving}
                autoFocus
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Role</label>
              <select
                value={assignedRole}
                onChange={(e) => setAssignedRole(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              >
                {roles.map(role => (
                  <option key={role.role_key} value={role.role_key}>{role.display_name}</option>
                ))}
              </select>
            </div>
            {task.is_system && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">System task - you can edit details but cannot delete it.</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={onClose} disabled={saving}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button type="submit" disabled={saving || !name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main TasksManager Component
// =============================================================================

export const TasksManager: React.FC = () => {
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [roles, setRoles] = useState<ProductionRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskDefinition | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskRole, setNewTaskRole] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; show: boolean }>({
    message: '', type: 'success', show: false
  });

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type, show: true });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksData, rolesData] = await Promise.all([
        settingsApi.getTasks(true),
        settingsApi.getRoles()
      ]);
      setTasks(tasksData);
      setRoles(rolesData);
      if (rolesData.length > 0 && !newTaskRole) {
        setNewTaskRole(rolesData[0].role_key);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load task configuration');
    } finally {
      setLoading(false);
    }
  }, [newTaskRole]);

  useEffect(() => { loadData(); }, [loadData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex(t => t.task_id === active.id);
    const newIndex = tasks.findIndex(t => t.task_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newTasks = arrayMove(tasks, oldIndex, newIndex).map((t, idx) => ({
      ...t, display_order: idx + 1
    }));
    setTasks(newTasks);

    try {
      await settingsApi.reorderTasks(newTasks.map(t => ({ task_id: t.task_id, display_order: t.display_order })));
    } catch {
      showNotification('Failed to save new order', 'error');
      loadData();
    }
  };

  const handleRoleChange = async (taskId: number, roleKey: string) => {
    setSaving(true);
    try {
      await settingsApi.updateTaskRole(taskId, roleKey);
      setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, assigned_role: roleKey } : t));
      showNotification('Role updated', 'success');
    } catch {
      showNotification('Failed to update role', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async () => {
    const trimmedName = newTaskName.trim();
    if (!trimmedName || !newTaskRole) return;
    setSaving(true);
    try {
      await settingsApi.createTask({ task_name: trimmedName, assigned_role: newTaskRole });
      setNewTaskName('');
      showNotification('Task added successfully', 'success');
      loadData();
    } catch {
      showNotification('Failed to add task', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTask = async (taskId: number, updates: { task_name: string; description: string; assigned_role: string }): Promise<boolean> => {
    setSaving(true);
    try {
      await settingsApi.updateTask(taskId, updates);
      setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, ...updates } : t));
      showNotification('Task updated successfully', 'success');
      return true;
    } catch {
      showNotification('Failed to update task', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (taskId: number) => {
    setSaving(true);
    try {
      await settingsApi.updateTask(taskId, { is_active: false });
      setTasks(prev => prev.filter(t => t.task_id !== taskId));
      showNotification('Task deactivated', 'success');
    } catch {
      showNotification('Failed to deactivate task', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeTasks = tasks.filter(t => t.is_active);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Task Definitions</h2>
              <p className="text-sm text-gray-500 mt-1">Define production tasks and assign them to roles</p>
            </div>
            <button onClick={loadData} disabled={loading} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="p-6">
          {activeTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No tasks defined yet.</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={activeTasks.map(t => t.task_id)} strategy={verticalListSortingStrategy} disabled={saving}>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 w-12"></th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">Role</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">Order</th>
                        <th className="px-4 py-3 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {activeTasks.map(task => (
                        <SortableTaskRow
                          key={task.task_id}
                          task={task}
                          roles={roles}
                          onEdit={setEditingTask}
                          onDeactivate={handleDeactivate}
                          onRoleChange={handleRoleChange}
                          disabled={saving}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add New Task */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex gap-3">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="New task name..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter' && newTaskName.trim()) { e.preventDefault(); handleAddTask(); } }}
                disabled={saving}
              />
              <select
                value={newTaskRole}
                onChange={(e) => setNewTaskRole(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                disabled={saving}
              >
                {roles.map(role => (
                  <option key={role.role_key} value={role.role_key}>{role.display_name}</option>
                ))}
              </select>
              <button
                onClick={handleAddTask}
                disabled={!newTaskName.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Drag rows to reorder. System tasks (marked with lock) cannot be deleted.</p>
        </div>
      </div>

      <EditTaskModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        roles={roles}
        onSave={handleUpdateTask}
        saving={saving}
      />

      <Notification
        message={notification.message}
        type={notification.type}
        show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default TasksManager;
