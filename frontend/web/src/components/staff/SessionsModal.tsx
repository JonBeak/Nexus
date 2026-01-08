/**
 * SessionsModal Component
 * Modal for viewing/editing task session history
 *
 * Created: 2025-01-07
 * Staff can view and edit their own session notes
 * Managers can edit times and delete sessions
 */

import React, { useState, useEffect } from 'react';
import { X, Clock, User, Edit2, Trash2, Save, XCircle } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { staffTasksApi } from '../../services/api/staff/staffTasksApi';
import type { TaskSessionHistory, TaskSession, SessionUpdate } from '../../services/api/staff/types';

interface Props {
  taskId: number;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number;
  isManager: boolean;
}

/**
 * Format minutes as human-readable duration
 */
const formatDuration = (minutes: number | null): string => {
  if (minutes === null || minutes === 0) return '0m';
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/**
 * Format datetime for display
 */
const formatDateTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString();
};

/**
 * Format datetime for input
 */
const formatDateTimeForInput = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toISOString().slice(0, 16);
};

export const SessionsModal: React.FC<Props> = ({
  taskId,
  isOpen,
  onClose,
  currentUserId,
  isManager
}) => {
  const [sessionHistory, setSessionHistory] = useState<TaskSessionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SessionUpdate>({});
  const [saving, setSaving] = useState(false);

  // Load session history
  useEffect(() => {
    if (isOpen && taskId) {
      loadSessions();
    }
  }, [isOpen, taskId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await staffTasksApi.getTaskSessions(taskId);
      setSessionHistory(data);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Failed to load session history');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (session: TaskSession) => {
    setEditingSessionId(session.session_id);
    setEditForm({
      started_at: session.started_at,
      ended_at: session.ended_at || undefined,
      notes: session.notes || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditForm({});
  };

  const handleSave = async (sessionId: number) => {
    try {
      setSaving(true);
      await staffTasksApi.updateSession(sessionId, editForm);
      setEditingSessionId(null);
      setEditForm({});
      await loadSessions();  // Refresh data
    } catch (err) {
      console.error('Error saving session:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sessionId: number) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      setSaving(true);
      await staffTasksApi.deleteSession(sessionId);
      await loadSessions();  // Refresh data
    } catch (err) {
      console.error('Error deleting session:', err);
      setError('Failed to delete session');
    } finally {
      setSaving(false);
    }
  };

  const canEditSession = (session: TaskSession): boolean => {
    // Staff can edit their own notes, managers can edit everything
    return isManager || session.user_id === currentUserId;
  };

  const canDeleteSession = (): boolean => {
    return isManager;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-2xl max-h-[80vh] ${PAGE_STYLES.panel.background} rounded-lg shadow-xl overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${PAGE_STYLES.panel.border}`}>
          <div>
            <h2 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
              Session History
            </h2>
            {sessionHistory && (
              <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
                {sessionHistory.task_name} - Order #{sessionHistory.order_number}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full hover:bg-gray-100 ${PAGE_STYLES.panel.textMuted}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-140px)]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className={PAGE_STYLES.panel.textMuted}>Loading sessions...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              {error}
            </div>
          ) : sessionHistory?.sessions.length === 0 ? (
            <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted}`}>
              No sessions recorded for this task
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className={`flex items-center gap-6 mb-4 p-3 rounded-lg ${PAGE_STYLES.header.background}`}>
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
                  <span className={`text-sm ${PAGE_STYLES.panel.text}`}>
                    Total: <strong>{formatDuration(sessionHistory?.total_time_minutes || 0)}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
                  <span className={`text-sm ${PAGE_STYLES.panel.text}`}>
                    Active: <strong>{sessionHistory?.active_sessions_count || 0}</strong>
                  </span>
                </div>
              </div>

              {/* Sessions list */}
              <div className="space-y-3">
                {sessionHistory?.sessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={`border rounded-lg p-4 ${PAGE_STYLES.panel.border} ${
                      !session.ended_at ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    {editingSessionId === session.session_id ? (
                      // Edit mode
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4" />
                          <span className="font-medium">{session.user_name || 'Unknown'}</span>
                        </div>

                        {/* Time fields (managers only) */}
                        {isManager && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Started At</label>
                              <input
                                type="datetime-local"
                                value={formatDateTimeForInput(editForm.started_at || session.started_at)}
                                onChange={(e) => setEditForm({ ...editForm, started_at: new Date(e.target.value).toISOString() })}
                                className="w-full px-2 py-1 text-sm border rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Ended At</label>
                              <input
                                type="datetime-local"
                                value={editForm.ended_at ? formatDateTimeForInput(editForm.ended_at) : ''}
                                onChange={(e) => setEditForm({
                                  ...editForm,
                                  ended_at: e.target.value ? new Date(e.target.value).toISOString() : null
                                })}
                                className="w-full px-2 py-1 text-sm border rounded"
                              />
                            </div>
                          </div>
                        )}

                        {/* Notes field (staff can edit their own) */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Notes</label>
                          <input
                            type="text"
                            value={editForm.notes || ''}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            placeholder="Add notes..."
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </div>

                        {/* Save/Cancel buttons */}
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <XCircle className="w-4 h-4" />
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(session.session_id)}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span className="font-medium">{session.user_name || 'Unknown'}</span>
                            {!session.ended_at && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full animate-pulse">
                                Active
                              </span>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1">
                            {canEditSession(session) && (
                              <button
                                onClick={() => handleEdit(session)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit session"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteSession() && (
                              <button
                                onClick={() => handleDelete(session.session_id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete session"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Times */}
                        <div className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>
                          <div>Started: {formatDateTime(session.started_at)}</div>
                          {session.ended_at ? (
                            <div>Ended: {formatDateTime(session.ended_at)}</div>
                          ) : (
                            <div className="text-blue-600">In progress...</div>
                          )}
                        </div>

                        {/* Duration */}
                        <div className="mt-2 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                            {session.duration_minutes !== null
                              ? formatDuration(session.duration_minutes)
                              : 'Active'
                            }
                          </span>
                        </div>

                        {/* Notes */}
                        {session.notes && (
                          <div className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted} italic`}>
                            "{session.notes}"
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${PAGE_STYLES.panel.border} flex justify-end`}>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionsModal;
