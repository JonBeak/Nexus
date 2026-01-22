/**
 * SessionsModal Component
 * Modal for viewing/editing task session history
 *
 * Created: 2025-01-07
 * Updated: 2025-01-15 - Added manager features (user selector, start/stop sessions)
 *
 * Staff can view and edit their own session notes
 * Managers can:
 *   - Start sessions for any user
 *   - Stop any active session
 *   - Edit times and delete sessions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Clock, User, Edit2, Trash2, Save, XCircle, Play, Square, ChevronDown, ChevronRight, Plus, MessageSquare, CheckCircle } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { useAlert } from '../../contexts/AlertContext';
import { staffTasksApi } from '../../services/api/staff/staffTasksApi';
import { orderTasksApi } from '../../services/api/orders/orderTasksApi';
import { accountsApi } from '../../services/api/accountsApi';
import type { TaskSessionHistory, TaskSession, SessionUpdate, SessionNote } from '../../services/api/staff/types';
import { formatDuration, formatDateTime, toDateTimeLocal } from '../../utils/dateUtils';
import { useTasksSocket } from '../../hooks/useTasksSocket';

interface UserWithRoles {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  production_roles?: string[] | null;
}

interface Props {
  taskId: number;
  taskRole?: string | null;  // The assigned_role of the task (for prioritizing users)
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number;
  isManager: boolean;
  onSessionChange?: () => void;  // Callback when sessions change (for refreshing parent)
  taskCompleted?: boolean;  // Whether task is already completed
  onComplete?: (taskId: number) => void;  // Callback to complete task
}

export const SessionsModal: React.FC<Props> = ({
  taskId,
  taskRole,
  isOpen,
  onClose,
  currentUserId,
  isManager,
  onSessionChange,
  taskCompleted,
  onComplete
}) => {
  const { showConfirmation } = useAlert();
  const [sessionHistory, setSessionHistory] = useState<TaskSessionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SessionUpdate>({});
  const [saving, setSaving] = useState(false);

  // Manager features state
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showOtherUsers, setShowOtherUsers] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [stoppingSessionId, setStoppingSessionId] = useState<number | null>(null);

  // Session notes state
  const [notesBySession, setNotesBySession] = useState<Map<number, SessionNote[]>>(new Map());
  const [addingNoteToSession, setAddingNoteToSession] = useState<number | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadSessions = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const data = await staffTasksApi.getTaskSessions(taskId);
      setSessionHistory(data);

      // Load notes for each session
      const notesMap = new Map<number, SessionNote[]>();
      for (const session of data.sessions) {
        try {
          const notes = await staffTasksApi.getSessionNotes(session.session_id);
          notesMap.set(session.session_id, notes);
        } catch (err) {
          console.error(`Error loading notes for session ${session.session_id}:`, err);
          notesMap.set(session.session_id, []);
        }
      }
      setNotesBySession(notesMap);
    } catch (err) {
      console.error('Error loading sessions:', err);
      if (showLoading) {
        setError('Failed to load session history');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [taskId]);

  // Silent reload for WebSocket updates (no spinner)
  const silentReload = useCallback(() => {
    loadSessions(false);
  }, [loadSessions]);

  // Load session history and users
  useEffect(() => {
    if (isOpen && taskId) {
      loadSessions(true);
      if (isManager) {
        loadUsers();
      }
    }
  }, [isOpen, taskId, isManager, loadSessions]);

  // WebSocket for real-time note updates (silent reload)
  useTasksSocket({
    userId: currentUserId,
    onSessionNoteCreated: useCallback((payload) => {
      // Only reload if the note is for our task
      if (payload.taskId === taskId && isOpen) {
        silentReload();
      }
    }, [taskId, isOpen, silentReload]),
    onSessionNoteUpdated: useCallback((payload) => {
      if (payload.taskId === taskId && isOpen) {
        silentReload();
      }
    }, [taskId, isOpen, silentReload]),
    onSessionNoteDeleted: useCallback((payload) => {
      if (payload.taskId === taskId && isOpen) {
        silentReload();
      }
    }, [taskId, isOpen, silentReload]),
    enabled: isOpen
  });

  const loadUsers = async () => {
    try {
      const data = await accountsApi.getUsers();
      // Filter to active users only
      const activeUsers = data.filter((u: UserWithRoles) => u.is_active);
      setUsers(activeUsers);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  // Split users into matching roles and others
  const { matchingRoleUsers, otherUsers } = React.useMemo(() => {
    if (!taskRole) {
      return { matchingRoleUsers: users, otherUsers: [] };
    }

    const matching: UserWithRoles[] = [];
    const others: UserWithRoles[] = [];

    users.forEach(user => {
      const userRoles = user.production_roles || [];
      if (userRoles.includes(taskRole)) {
        matching.push(user);
      } else {
        others.push(user);
      }
    });

    return { matchingRoleUsers: matching, otherUsers: others };
  }, [users, taskRole]);

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
      await loadSessions();
      onSessionChange?.();
    } catch (err) {
      console.error('Error saving session:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sessionId: number) => {
    const confirmed = await showConfirmation({
      title: 'Delete Session',
      message: 'Are you sure you want to delete this session?',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
      setSaving(true);
      await staffTasksApi.deleteSession(sessionId);
      await loadSessions();
      onSessionChange?.();
    } catch (err) {
      console.error('Error deleting session:', err);
      setError('Failed to delete session');
    } finally {
      setSaving(false);
    }
  };

  const handleStartSession = async () => {
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    try {
      setStartingSession(true);
      setError(null);
      await orderTasksApi.startTaskSession(taskId, selectedUserId);
      setSelectedUserId(null);
      await loadSessions();
      onSessionChange?.();
    } catch (err: any) {
      console.error('Error starting session:', err);
      const message = err?.response?.data?.message || err?.message || 'Failed to start session';
      setError(message);
    } finally {
      setStartingSession(false);
    }
  };

  const handleStopSession = async (sessionId: number) => {
    try {
      setStoppingSessionId(sessionId);
      setError(null);
      await orderTasksApi.stopSessionById(sessionId);
      await loadSessions();
      onSessionChange?.();
    } catch (err: any) {
      console.error('Error stopping session:', err);
      const message = err?.response?.data?.message || err?.message || 'Failed to stop session';
      setError(message);
    } finally {
      setStoppingSessionId(null);
    }
  };

  const canEditSession = (session: TaskSession): boolean => {
    return isManager || session.user_id === currentUserId;
  };

  const canDeleteSession = (): boolean => {
    return isManager;
  };

  // Note permission helpers
  const canEditNote = (note: SessionNote): boolean => {
    return isManager || note.user_id === currentUserId;
  };

  const canDeleteNote = (note: SessionNote): boolean => {
    return isManager || note.user_id === currentUserId;
  };

  // Note handlers
  const handleAddNote = async (sessionId: number) => {
    if (!newNoteText.trim()) return;

    try {
      setSavingNote(true);
      await staffTasksApi.createSessionNote(sessionId, newNoteText.trim());
      setNewNoteText('');
      setAddingNoteToSession(null);

      // Reload notes for this session
      const notes = await staffTasksApi.getSessionNotes(sessionId);
      setNotesBySession(prev => new Map(prev).set(sessionId, notes));
    } catch (err) {
      console.error('Error adding note:', err);
      setError('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdateNote = async (noteId: number) => {
    if (!editNoteText.trim()) return;

    try {
      setSavingNote(true);
      await staffTasksApi.updateSessionNote(noteId, editNoteText.trim());
      setEditingNoteId(null);
      setEditNoteText('');

      // Reload notes for all sessions (simple approach)
      await loadSessions();
    } catch (err) {
      console.error('Error updating note:', err);
      setError('Failed to update note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    const confirmed = await showConfirmation({
      title: 'Delete Note',
      message: 'Are you sure you want to delete this note?',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
      setSavingNote(true);
      await staffTasksApi.deleteSessionNote(noteId);

      // Reload notes for all sessions (simple approach)
      await loadSessions();
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Failed to delete note');
    } finally {
      setSavingNote(false);
    }
  };

  const startEditingNote = (note: SessionNote) => {
    setEditingNoteId(note.note_id);
    setEditNoteText(note.note_text);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditNoteText('');
  };

  // Check if user already has an active session on this task
  const userHasActiveSession = (userId: number): boolean => {
    return sessionHistory?.sessions.some(s => s.user_id === userId && !s.ended_at) || false;
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
      <div className={`relative w-full max-w-2xl max-h-[85vh] ${PAGE_STYLES.panel.background} rounded-lg shadow-xl overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${PAGE_STYLES.panel.border}`}>
          <div>
            <h2 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
              Task Sessions
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
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-180px)]">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Manager: Start Session Section */}
          {isManager && (
            <div className={`mb-6 p-4 rounded-lg border-2 border-dashed ${PAGE_STYLES.panel.border}`}>
              <h3 className={`text-sm font-semibold mb-3 ${PAGE_STYLES.panel.text}`}>
                Start New Session
              </h3>

              <div className="flex items-end gap-3">
                {/* User selector */}
                <div className="flex-1">
                  <label className={`block text-xs mb-1 ${PAGE_STYLES.panel.textMuted}`}>
                    Select User {taskRole && <span className="text-blue-600">(matching role: {taskRole})</span>}
                  </label>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    disabled={startingSession}
                  >
                    <option value="">-- Select user --</option>

                    {/* Matching role users (shown first) */}
                    {matchingRoleUsers.length > 0 && (
                      <optgroup label={taskRole ? `${taskRole} role` : 'All Users'}>
                        {matchingRoleUsers.map(user => (
                          <option
                            key={user.user_id}
                            value={user.user_id}
                            disabled={userHasActiveSession(user.user_id)}
                          >
                            {user.first_name} {user.last_name}
                            {userHasActiveSession(user.user_id) ? ' (active session)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* Other users (collapsed) */}
                    {taskRole && otherUsers.length > 0 && (
                      <optgroup label="Other Users">
                        {otherUsers.map(user => (
                          <option
                            key={user.user_id}
                            value={user.user_id}
                            disabled={userHasActiveSession(user.user_id)}
                          >
                            {user.first_name} {user.last_name}
                            {userHasActiveSession(user.user_id) ? ' (active session)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Start button */}
                <button
                  onClick={handleStartSession}
                  disabled={!selectedUserId || startingSession || (selectedUserId !== null && userHasActiveSession(selectedUserId))}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  {startingSession ? 'Starting...' : 'Start Session'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className={PAGE_STYLES.panel.textMuted}>Loading sessions...</p>
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
              {sessionHistory?.sessions.length === 0 ? (
                <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted}`}>
                  No sessions recorded for this task
                </div>
              ) : (
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
                                  value={toDateTimeLocal(editForm.started_at || session.started_at)}
                                  onChange={(e) => setEditForm({ ...editForm, started_at: new Date(e.target.value).toISOString() })}
                                  className="w-full px-2 py-1 text-sm border rounded"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Ended At</label>
                                <input
                                  type="datetime-local"
                                  value={editForm.ended_at ? toDateTimeLocal(editForm.ended_at) : ''}
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
                              {/* Stop button for active sessions (managers only) */}
                              {isManager && !session.ended_at && (
                                <button
                                  onClick={() => handleStopSession(session.session_id)}
                                  disabled={stoppingSessionId === session.session_id}
                                  className="flex items-center gap-1 px-2 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
                                  title="Stop session"
                                >
                                  <Square className="w-3 h-3" />
                                  {stoppingSessionId === session.session_id ? 'Stopping...' : 'Stop'}
                                </button>
                              )}
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
                              {session.duration_minutes !== null ? (
                                <>
                                  {session.effective_duration_minutes !== null &&
                                   Math.round(session.effective_duration_minutes) !== session.duration_minutes ? (
                                    <>
                                      {formatDuration(Math.round(session.effective_duration_minutes))}
                                      <span className="text-xs text-gray-400 ml-1">
                                        (raw: {formatDuration(session.duration_minutes)})
                                      </span>
                                    </>
                                  ) : (
                                    formatDuration(session.duration_minutes)
                                  )}
                                </>
                              ) : (
                                'Active'
                              )}
                            </span>
                          </div>

                          {/* Notes Section */}
                          <div className="mt-3 pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <MessageSquare className="w-3 h-3" />
                                <span>Notes ({notesBySession.get(session.session_id)?.length || 0})</span>
                              </div>
                              {addingNoteToSession !== session.session_id && (
                                <button
                                  onClick={() => {
                                    setAddingNoteToSession(session.session_id);
                                    setNewNoteText('');
                                  }}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add Note
                                </button>
                              )}
                            </div>

                            {/* Add new note form */}
                            {addingNoteToSession === session.session_id && (
                              <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-100">
                                <textarea
                                  value={newNoteText}
                                  onChange={(e) => setNewNoteText(e.target.value)}
                                  placeholder="Add your note..."
                                  className="w-full px-2 py-1 text-sm border rounded resize-none"
                                  rows={2}
                                  autoFocus
                                />
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => handleAddNote(session.session_id)}
                                    disabled={savingNote || !newNoteText.trim()}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                  >
                                    <Save className="w-3 h-3" />
                                    {savingNote ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAddingNoteToSession(null);
                                      setNewNoteText('');
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Display existing notes */}
                            {(notesBySession.get(session.session_id) || []).map((note) => (
                              <div
                                key={note.note_id}
                                className="mb-2 p-2 bg-gray-50 rounded border border-gray-100"
                              >
                                {editingNoteId === note.note_id ? (
                                  // Edit mode
                                  <div>
                                    <textarea
                                      value={editNoteText}
                                      onChange={(e) => setEditNoteText(e.target.value)}
                                      className="w-full px-2 py-1 text-sm border rounded resize-none"
                                      rows={2}
                                      autoFocus
                                    />
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={() => handleUpdateNote(note.note_id)}
                                        disabled={savingNote || !editNoteText.trim()}
                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                      >
                                        <Save className="w-3 h-3" />
                                        {savingNote ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        onClick={cancelEditingNote}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                                      >
                                        <XCircle className="w-3 h-3" />
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // View mode
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <p className="text-sm text-gray-700">{note.note_text}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                          — {note.user_name || 'Unknown'}, {new Date(note.created_at).toLocaleString()}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {canEditNote(note) && (
                                          <button
                                            onClick={() => startEditingNote(note)}
                                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            title="Edit note"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                          </button>
                                        )}
                                        {canDeleteNote(note) && (
                                          <button
                                            onClick={() => handleDeleteNote(note.note_id)}
                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            title="Delete note"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${PAGE_STYLES.panel.border} flex justify-between items-center`}>
          {/* Mark Complete button - left side */}
          {!taskCompleted && onComplete ? (
            <button
              onClick={() => {
                onComplete(taskId);
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Complete
            </button>
          ) : (
            <div />
          )}
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
