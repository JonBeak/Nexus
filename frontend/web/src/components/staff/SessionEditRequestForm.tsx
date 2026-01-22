/**
 * SessionEditRequestForm Component
 * Modal form for staff to request edits or deletion of their task sessions
 * Supports both creating new requests and updating existing pending requests
 * Features: Edit/Delete toggle, Cancel request button
 *
 * Created: 2025-01-15
 * Updated: 2025-01-15 - Added request type toggle and cancel functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { useAlert } from '../../contexts/AlertContext';
import { sessionEditRequestsApi, SessionPendingRequest } from '../../services/api/staff/sessionEditRequestsApi';
import type { CompletedSessionDisplay } from '../../services/api/staff/types';
import { formatTime, formatDuration, toDateTimeLocal } from '../../utils/dateUtils';

interface Props {
  session: CompletedSessionDisplay | null;
  isOpen: boolean;
  mode: 'edit' | 'delete';
  onClose: () => void;
  onSuccess: () => void;
}

export const SessionEditRequestForm: React.FC<Props> = ({
  session,
  isOpen,
  mode,
  onClose,
  onSuccess
}) => {
  const { showConfirmation } = useAlert();

  // Request type can toggle between edit and delete
  const [requestType, setRequestType] = useState<'edit' | 'delete'>(mode);
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<SessionPendingRequest | null>(null);

  // Click outside to close - track mousedown started outside
  const modalRef = useRef<HTMLDivElement>(null);
  const mouseDownOutside = useRef(false);

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownOutside.current = e.target === e.currentTarget;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (mouseDownOutside.current && e.target === e.currentTarget) {
      onClose();
    }
    mouseDownOutside.current = false;
  };


  // Initialize form when session/modal opens
  useEffect(() => {
    if (session && isOpen) {
      // Reset requestType to mode prop when modal opens
      setRequestType(mode);
      setError(null);

      // Always check for pending request when modal opens
      setLoading(true);
      sessionEditRequestsApi.getPendingRequestForSession(session.session_id)
        .then((request) => {
          if (request) {
            setPendingRequest(request);
            // If pending request exists, start with its type
            setRequestType(request.request_type);
            // Populate form with pending request values
            if (request.request_type === 'edit') {
              setStartedAt(request.requested_started_at ? toDateTimeLocal(request.requested_started_at) : toDateTimeLocal(session.started_at));
              setEndedAt(request.requested_ended_at ? toDateTimeLocal(request.requested_ended_at) : (session.ended_at ? toDateTimeLocal(session.ended_at) : ''));
              setNotes(request.requested_notes || session.notes || '');
            } else {
              // Delete request - still populate edit fields for if they switch
              setStartedAt(toDateTimeLocal(session.started_at));
              setEndedAt(session.ended_at ? toDateTimeLocal(session.ended_at) : '');
              setNotes(session.notes || '');
            }
            setReason(request.reason || '');
          } else {
            // No pending request
            setPendingRequest(null);
            setStartedAt(toDateTimeLocal(session.started_at));
            setEndedAt(session.ended_at ? toDateTimeLocal(session.ended_at) : '');
            setNotes(session.notes || '');
            setReason('');
          }
        })
        .catch(() => {
          setPendingRequest(null);
          setStartedAt(toDateTimeLocal(session.started_at));
          setEndedAt(session.ended_at ? toDateTimeLocal(session.ended_at) : '');
          setNotes(session.notes || '');
          setReason('');
        })
        .finally(() => setLoading(false));
    }
  }, [session, isOpen, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setSubmitting(true);
    setError(null);

    try {
      if (requestType === 'edit') {
        await sessionEditRequestsApi.submitEditRequest({
          session_id: session.session_id,
          requested_started_at: startedAt,
          requested_ended_at: endedAt || null,
          requested_notes: notes || null,
          reason
        });
      } else {
        await sessionEditRequestsApi.submitDeleteRequest({
          session_id: session.session_id,
          reason
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting request:', err);
      setError(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!pendingRequest) return;

    const confirmed = await showConfirmation({
      title: 'Cancel Request',
      message: 'Are you sure you want to cancel this request?',
      variant: 'warning',
      confirmText: 'Cancel Request'
    });
    if (!confirmed) return;

    setCancelling(true);
    setError(null);

    try {
      await sessionEditRequestsApi.cancelRequest(pendingRequest.request_id);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error cancelling request:', err);
      setError(err.response?.data?.message || 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  if (!isOpen || !session) return null;

  // Determine header text
  const getHeaderText = () => {
    if (pendingRequest) {
      return 'Pending Request';
    }
    return requestType === 'edit' ? 'Request Session Edit' : 'Request Session Deletion';
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={modalRef}
        className={`${PAGE_STYLES.panel.background} rounded-xl shadow-2xl max-w-lg w-full border ${PAGE_STYLES.panel.border}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${PAGE_STYLES.panel.border}`}>
          <div>
            <h3 className={`text-lg font-bold ${PAGE_STYLES.panel.text}`}>
              {getHeaderText()}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Request Type Toggle - only show when creating new request */}
        {!pendingRequest && !loading && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex rounded-lg bg-gray-200 p-1">
              <button
                type="button"
                onClick={() => setRequestType('edit')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  requestType === 'edit'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Pencil className="w-4 h-4" />
                Edit Times
              </button>
              <button
                type="button"
                onClick={() => setRequestType('delete')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  requestType === 'delete'
                    ? 'bg-white text-red-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Delete Session
              </button>
            </div>
          </div>
        )}

        {/* Session Info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <p className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>{session.task_name}</p>
          <p className="text-xs text-gray-500">
            #{session.order_number} - {session.order_name}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {formatTime(session.started_at)} - {formatTime(session.ended_at)}
            {session.effective_duration_minutes !== null &&
             Math.round(session.effective_duration_minutes) !== session.duration_minutes ? (
              <span> ({formatDuration(Math.round(session.effective_duration_minutes))} effective, {formatDuration(session.duration_minutes)} raw)</span>
            ) : (
              <span> ({formatDuration(session.duration_minutes)})</span>
            )}
          </p>
        </div>

        {/* Pending Request Details - Show what was requested */}
        {pendingRequest && !loading && (
          <div className={`px-6 py-4 border-b ${
            pendingRequest.request_type === 'delete'
              ? 'bg-red-50 border-red-200'
              : 'bg-purple-50 border-purple-200'
          }`}>
            <h4 className={`text-sm font-semibold mb-2 ${
              pendingRequest.request_type === 'delete' ? 'text-red-700' : 'text-purple-700'
            }`}>
              Your Pending {pendingRequest.request_type === 'delete' ? 'Delete' : 'Edit'} Request
            </h4>

            {pendingRequest.request_type === 'edit' ? (
              <div className="space-y-1 text-sm">
                <p className="text-gray-700">
                  <span className="font-medium">Requested Start:</span>{' '}
                  {pendingRequest.requested_started_at ? formatTime(pendingRequest.requested_started_at) : '-'}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Requested End:</span>{' '}
                  {pendingRequest.requested_ended_at ? formatTime(pendingRequest.requested_ended_at) : '-'}
                </p>
                {pendingRequest.requested_notes && (
                  <p className="text-gray-700">
                    <span className="font-medium">Notes:</span> {pendingRequest.requested_notes}
                  </p>
                )}
                <p className="text-gray-700">
                  <span className="font-medium">Reason:</span> {pendingRequest.reason}
                </p>
              </div>
            ) : (
              <div className="text-sm">
                <p className="text-red-700">
                  <span className="font-medium">Reason:</span> {pendingRequest.reason}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Loading request...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {requestType === 'edit' && !pendingRequest && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Started At</label>
                <input
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ended At</label>
                <input
                  type="datetime-local"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  rows={2}
                  placeholder="Optional notes about the session..."
                />
              </div>
            </>
          )}

          {requestType === 'delete' && !pendingRequest && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium">This will request permanent deletion of this session.</p>
              <p className="text-xs text-red-600 mt-1">A manager must approve this request before the session is deleted.</p>
            </div>
          )}

          {!pendingRequest && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for {requestType === 'edit' ? 'Edit' : 'Deletion'} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${
                  requestType === 'delete'
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-purple-500 focus:border-purple-500'
                }`}
              rows={3}
              placeholder={requestType === 'edit'
                ? 'Please explain why this session needs to be edited...'
                : 'Please explain why this session should be deleted...'
              }
              required
            />
          </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            {/* Cancel Request button - only show if there's a pending request */}
            <div>
              {pendingRequest && (
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  disabled={cancelling}
                  className="px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 text-sm font-medium"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Request'}
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting || cancelling}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Close
              </button>
              {!pendingRequest && (
                <button
                  type="submit"
                  disabled={submitting || loading || !reason.trim()}
                  className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                    requestType === 'delete'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {submitting ? 'Submitting...' : requestType === 'edit' ? 'Submit Edit Request' : 'Submit Delete Request'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionEditRequestForm;
