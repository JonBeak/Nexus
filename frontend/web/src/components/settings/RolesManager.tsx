/**
 * RolesManager - Manage production roles with color customization
 * Includes drag-and-drop reordering and color picker
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
import { settingsApi, ProductionRole } from '../../services/api/settings';
import { Notification } from '../inventory/Notification';

// Predefined color palette
const COLOR_PRESETS = [
  { hex: '#3B82F6', bg: 'bg-blue-500', text: 'text-white', name: 'Blue' },
  { hex: '#10B981', bg: 'bg-emerald-500', text: 'text-white', name: 'Green' },
  { hex: '#F59E0B', bg: 'bg-amber-500', text: 'text-white', name: 'Amber' },
  { hex: '#EF4444', bg: 'bg-red-500', text: 'text-white', name: 'Red' },
  { hex: '#8B5CF6', bg: 'bg-violet-500', text: 'text-white', name: 'Violet' },
  { hex: '#EC4899', bg: 'bg-pink-500', text: 'text-white', name: 'Pink' },
  { hex: '#14B8A6', bg: 'bg-teal-500', text: 'text-white', name: 'Teal' },
  { hex: '#F97316', bg: 'bg-orange-500', text: 'text-white', name: 'Orange' },
  { hex: '#6366F1', bg: 'bg-indigo-500', text: 'text-white', name: 'Indigo' },
  { hex: '#64748B', bg: 'bg-slate-500', text: 'text-white', name: 'Slate' },
];

// =============================================================================
// Sortable Role Row Component
// =============================================================================

interface SortableRoleRowProps {
  role: ProductionRole;
  onEdit: (role: ProductionRole) => void;
  onDeactivate: (roleId: number) => void;
  disabled?: boolean;
}

const SortableRoleRow: React.FC<SortableRoleRowProps> = ({
  role,
  onEdit,
  onDeactivate,
  disabled
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: role.role_id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: isDragging ? '3px solid #3b82f6' : 'none'
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 w-12">
        <div {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-100 rounded transition-colors">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: role.color_hex, color: '#fff' }}
          >
            {role.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-gray-900 font-medium">{role.display_name}</span>
            {role.is_system && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                <Lock className="w-3 h-3" />
                System
              </span>
            )}
            {role.description && <p className="text-sm text-gray-500">{role.description}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 w-32">
        <span
          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: role.color_hex, color: '#fff' }}
        >
          {role.role_key}
        </span>
      </td>
      <td className="px-4 py-3 w-24">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: role.color_hex }} />
          <span className="text-xs text-gray-500 font-mono">{role.color_hex}</span>
        </div>
      </td>
      <td className="px-4 py-3 w-16 text-center">
        <span className="text-sm text-gray-500">{role.display_order}</span>
      </td>
      <td className="px-4 py-3 w-24">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(role)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          {!role.is_system && (
            <button onClick={() => {
              if (window.confirm(`Deactivate "${role.display_name}"? Tasks assigned to this role will need reassignment.`)) {
                onDeactivate(role.role_id);
              }
            }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// =============================================================================
// Edit Role Modal
// =============================================================================

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: ProductionRole | null;
  onSave: (roleId: number, updates: { display_name: string; description: string; color_hex: string }) => Promise<boolean>;
  saving?: boolean;
}

const EditRoleModal: React.FC<EditRoleModalProps> = ({ isOpen, onClose, role, onSave, saving = false }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [colorHex, setColorHex] = useState('#3B82F6');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role) {
      setName(role.display_name);
      setDescription(role.description || '');
      setColorHex(role.color_hex);
      setError(null);
    }
  }, [role]);

  if (!isOpen || !role) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Role name cannot be empty'); return; }
    const success = await onSave(role.role_id, { display_name: trimmedName, description: description.trim(), color_hex: colorHex });
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Edit Role
              {role.is_system && <Lock className="h-4 w-4 text-gray-400" />}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role Name</label>
              <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(null); }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
                disabled={saving} autoFocus />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" rows={2} disabled={saving} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {COLOR_PRESETS.map(preset => (
                  <button key={preset.hex} type="button" onClick={() => setColorHex(preset.hex)}
                    className={`w-8 h-8 rounded-lg transition-all ${colorHex === preset.hex ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: preset.hex }} title={preset.name} />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer" disabled={saving} />
                <input type="text" value={colorHex} onChange={(e) => setColorHex(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm" disabled={saving} placeholder="#RRGGBB" />
                <div className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: colorHex, color: '#fff' }}>
                  Preview
                </div>
              </div>
            </div>
            {role.is_system && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">System role - you can edit display settings but cannot delete it.</p>
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
// Main RolesManager Component
// =============================================================================

export const RolesManager: React.FC = () => {
  const [roles, setRoles] = useState<ProductionRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<ProductionRole | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#3B82F6');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; show: boolean }>({
    message: '', type: 'success', show: false
  });

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type, show: true });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getRoles(true);
      setRoles(data);
    } catch (err) {
      console.error('Failed to load roles:', err);
      setError('Failed to load production roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = roles.findIndex(r => r.role_id === active.id);
    const newIndex = roles.findIndex(r => r.role_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newRoles = arrayMove(roles, oldIndex, newIndex).map((r, idx) => ({ ...r, display_order: idx + 1 }));
    setRoles(newRoles);

    try {
      await settingsApi.reorderRoles(newRoles.map(r => ({ role_id: r.role_id, display_order: r.display_order })));
    } catch {
      showNotification('Failed to save new order', 'error');
      loadRoles();
    }
  };

  const handleAddRole = async () => {
    const trimmedName = newRoleName.trim();
    if (!trimmedName) return;
    const roleKey = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setSaving(true);
    try {
      await settingsApi.createRole({ role_key: roleKey, display_name: trimmedName, color_hex: newRoleColor });
      setNewRoleName('');
      showNotification('Role added successfully', 'success');
      loadRoles();
    } catch {
      showNotification('Failed to add role', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (roleId: number, updates: { display_name: string; description: string; color_hex: string }): Promise<boolean> => {
    setSaving(true);
    try {
      await settingsApi.updateRole(roleId, updates);
      setRoles(prev => prev.map(r => r.role_id === roleId ? { ...r, ...updates } : r));
      showNotification('Role updated successfully', 'success');
      return true;
    } catch {
      showNotification('Failed to update role', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (roleId: number) => {
    setSaving(true);
    try {
      await settingsApi.updateRole(roleId, { is_active: false });
      setRoles(prev => prev.filter(r => r.role_id !== roleId));
      showNotification('Role deactivated', 'success');
    } catch {
      showNotification('Failed to deactivate role', 'error');
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

  const activeRoles = roles.filter(r => r.is_active);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Production Roles</h2>
              <p className="text-sm text-gray-500 mt-1">Define roles and their colors for task assignment</p>
            </div>
            <button onClick={loadRoles} disabled={loading} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
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
          {activeRoles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No roles defined yet.</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={activeRoles.map(r => r.role_id)} strategy={verticalListSortingStrategy} disabled={saving}>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 w-12"></th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Key</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Color</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">Order</th>
                        <th className="px-4 py-3 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {activeRoles.map(role => (
                        <SortableRoleRow key={role.role_id} role={role} onEdit={setEditingRole} onDeactivate={handleDeactivate} disabled={saving} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex gap-3">
              <input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="New role name..." className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter' && newRoleName.trim()) { e.preventDefault(); handleAddRole(); } }} disabled={saving} />
              <div className="flex items-center gap-2">
                {COLOR_PRESETS.slice(0, 5).map(preset => (
                  <button key={preset.hex} type="button" onClick={() => setNewRoleColor(preset.hex)}
                    className={`w-8 h-8 rounded-lg transition-all ${newRoleColor === preset.hex ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                    style={{ backgroundColor: preset.hex }} />
                ))}
                <input type="color" value={newRoleColor} onChange={(e) => setNewRoleColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
              </div>
              <button onClick={handleAddRole} disabled={!newRoleName.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Role
              </button>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Drag rows to reorder. System roles cannot be deleted.</p>
        </div>
      </div>

      <EditRoleModal isOpen={!!editingRole} onClose={() => setEditingRole(null)} role={editingRole} onSave={handleUpdateRole} saving={saving} />
      <Notification message={notification.message} type={notification.type} show={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))} />
    </div>
  );
};

export default RolesManager;
