/**
 * Feedback Detail Modal
 * Shows full feedback details with responses and management options
 *
 * Created: 2026-01-16
 */

import React, { useState, useEffect } from 'react';
import {
  X, Send, Loader2, Clock, User, AlertCircle, CheckCircle,
  MessageSquare, Eye, EyeOff, ExternalLink
} from 'lucide-react';
import {
  feedbackApi,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackStatus,
  FeedbackPriority
} from '../../services/api';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTimeWithYear } from '../../utils/dateUtils';

interface Props {
  feedbackId: number;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const STATUS_OPTIONS: { value: FeedbackStatus; label: string; color: string }[] = [
  { value: 'open', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-800' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' }
];

const PRIORITY_OPTIONS: { value: FeedbackPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' }
];

export const FeedbackDetailModal: React.FC<Props> = ({
  feedbackId,
  isOpen,
  onClose,
  onUpdate
}) => {
  const { isManager } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackRequest | null>(null);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Screenshot state
  const [screenshot, setScreenshot] = useState<{ data: string; mimeType: string } | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);

  // Response form state
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Status/Priority update state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  useEffect(() => {
    if (isOpen && feedbackId) {
      loadFeedback();
    }
  }, [isOpen, feedbackId]);

  const loadFeedback = async () => {
    setLoading(true);
    setError(null);
    setScreenshot(null);
    try {
      const data = await feedbackApi.getById(feedbackId);
      setFeedback(data.feedback);
      setResponses(data.responses);

      // Load screenshot if available
      if (data.feedback.screenshot_drive_id) {
        loadScreenshot();
      }
    } catch (err) {
      setError('Failed to load feedback details');
      console.error('Error loading feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadScreenshot = async () => {
    setLoadingScreenshot(true);
    try {
      const screenshotData = await feedbackApi.getScreenshot(feedbackId);
      setScreenshot(screenshotData);
    } catch (err) {
      console.error('Error loading screenshot:', err);
      // Don't show error - screenshot is optional
    } finally {
      setLoadingScreenshot(false);
    }
  };

  const handleStatusChange = async (status: FeedbackStatus) => {
    if (!feedback) return;
    setUpdatingStatus(true);
    try {
      await feedbackApi.updateStatus(feedbackId, status);
      setFeedback({ ...feedback, status });
      onUpdate?.();
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (priority: FeedbackPriority) => {
    if (!feedback) return;
    setUpdatingPriority(true);
    try {
      await feedbackApi.updatePriority(feedbackId, priority);
      setFeedback({ ...feedback, priority });
      onUpdate?.();
    } catch (err) {
      console.error('Error updating priority:', err);
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!newMessage.trim()) return;
    setSubmitting(true);
    try {
      await feedbackApi.addResponse(feedbackId, newMessage.trim(), isInternal);
      setNewMessage('');
      setIsInternal(false);
      await loadFeedback();
      onUpdate?.();
    } catch (err) {
      console.error('Error submitting response:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option ? (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${option.color}`}>
        {option.label}
      </span>
    ) : null;
  };

  const getPriorityBadge = (priority: FeedbackPriority) => {
    const option = PRIORITY_OPTIONS.find(o => o.value === priority);
    return option ? (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${option.color}`}>
        {option.label}
      </span>
    ) : null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-start justify-center min-h-screen px-4 pt-8 pb-20">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className={`relative ${PAGE_STYLES.panel.background} rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${PAGE_STYLES.panel.border}`}>
            <h3 className={`text-lg font-semibold ${PAGE_STYLES.panel.text}`}>
              Feedback Details
            </h3>
            <button
              onClick={onClose}
              className={`${PAGE_STYLES.panel.textMuted} hover:text-gray-700 transition-colors`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-red-600 py-8 justify-center">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            ) : feedback ? (
              <>
                {/* Title and Meta */}
                <div>
                  <h4 className={`text-xl font-semibold ${PAGE_STYLES.panel.text} mb-2`}>
                    {feedback.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className={PAGE_STYLES.panel.textSecondary}>
                        {feedback.submitter_first_name} {feedback.submitter_last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className={PAGE_STYLES.panel.textSecondary}>
                        {formatDateTimeWithYear(feedback.created_at)}
                      </span>
                    </div>
                    {getStatusBadge(feedback.status)}
                    {getPriorityBadge(feedback.priority)}
                  </div>
                </div>

                {/* Status/Priority Controls (Manager only) */}
                {isManager && (
                  <div className={`flex gap-4 p-3 ${PAGE_STYLES.input.background} rounded-lg border ${PAGE_STYLES.panel.border}`}>
                    <div className="flex-1">
                      <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textMuted} mb-1`}>
                        Status
                      </label>
                      <select
                        value={feedback.status}
                        onChange={(e) => handleStatusChange(e.target.value as FeedbackStatus)}
                        disabled={updatingStatus}
                        className={`w-full px-2 py-1 text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.text} border rounded focus:ring-1 focus:ring-blue-500`}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textMuted} mb-1`}>
                        Priority
                      </label>
                      <select
                        value={feedback.priority}
                        onChange={(e) => handlePriorityChange(e.target.value as FeedbackPriority)}
                        disabled={updatingPriority}
                        className={`w-full px-2 py-1 text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.text} border rounded focus:ring-1 focus:ring-blue-500`}
                      >
                        {PRIORITY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <h5 className={`text-sm font-medium ${PAGE_STYLES.panel.text} mb-2`}>Description</h5>
                  <p className={`${PAGE_STYLES.panel.textSecondary} whitespace-pre-wrap`}>
                    {feedback.description}
                  </p>
                </div>

                {/* Page URL */}
                {feedback.page_url && (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>Submitted from:</span>
                    <a
                      href={feedback.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {new URL(feedback.page_url).pathname}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Screenshot Preview */}
                {(feedback.screenshot_drive_id || loadingScreenshot) && (
                  <div>
                    <h5 className={`text-sm font-medium ${PAGE_STYLES.panel.text} mb-2`}>Screenshot</h5>
                    {loadingScreenshot ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading screenshot...</span>
                      </div>
                    ) : screenshot ? (
                      <img
                        src={`data:${screenshot.mimeType};base64,${screenshot.data}`}
                        alt="Screenshot"
                        className="max-w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-90"
                        onClick={() => {
                          // Open in new tab for full view
                          const win = window.open();
                          if (win) {
                            win.document.write(`<img src="data:${screenshot.mimeType};base64,${screenshot.data}" />`);
                          }
                        }}
                      />
                    ) : (
                      <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>Screenshot unavailable</p>
                    )}
                  </div>
                )}

                {/* Responses */}
                <div>
                  <h5 className={`text-sm font-medium ${PAGE_STYLES.panel.text} mb-3 flex items-center gap-2`}>
                    <MessageSquare className="w-4 h-4" />
                    Responses ({responses.length})
                  </h5>
                  {responses.length === 0 ? (
                    <p className={`text-sm ${PAGE_STYLES.panel.textMuted} italic`}>No responses yet</p>
                  ) : (
                    <div className="space-y-3">
                      {responses.map((response) => (
                        <div
                          key={response.response_id}
                          className={`p-3 rounded-lg border ${
                            !!response.is_internal
                              ? 'bg-yellow-50 border-yellow-200'
                              : `${PAGE_STYLES.input.background} ${PAGE_STYLES.panel.border}`
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                              {response.responder_first_name} {response.responder_last_name}
                            </span>
                            <span className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
                              {formatDateTimeWithYear(response.created_at)}
                            </span>
                            {!!response.is_internal && (
                              <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded-full flex items-center gap-1">
                                <EyeOff className="w-3 h-3" />
                                Internal
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${PAGE_STYLES.panel.textSecondary} whitespace-pre-wrap`}>
                            {response.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Response Form */}
                <div className={`p-3 rounded-lg border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.input.background}`}>
                  <h5 className={`text-sm font-medium ${PAGE_STYLES.panel.text} mb-2`}>Add Response</h5>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your response..."
                    className={`w-full px-3 py-2 ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.text} border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px] resize-y`}
                  />
                  <div className="flex items-center justify-between mt-2">
                    {isManager && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className={PAGE_STYLES.panel.textSecondary}>Internal note (not visible to submitter)</span>
                      </label>
                    )}
                    <button
                      onClick={handleSubmitResponse}
                      disabled={submitting || !newMessage.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Send
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
