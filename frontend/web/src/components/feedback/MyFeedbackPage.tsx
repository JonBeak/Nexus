/**
 * My Feedback Page
 * Shows the current user's own feedback submissions
 * Accessible to all authenticated users
 *
 * Created: 2026-01-16
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, Clock, MessageSquare,
  ChevronRight, Plus
} from 'lucide-react';
import {
  feedbackApi,
  FeedbackRequest,
  FeedbackStatus,
  FeedbackPriority
} from '../../services/api';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { FeedbackDetailModal } from './FeedbackDetailModal';
import { FeedbackSubmitModal } from './FeedbackSubmitModal';
import '../jobEstimation/JobEstimation.css';

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

export const MyFeedbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<number | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Filter
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('');

  useEffect(() => {
    loadFeedback();
  }, [statusFilter]);

  const loadFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await feedbackApi.getList({
        status: statusFilter || undefined,
        limit: 100
      });
      setFeedback(result.items);
    } catch (err) {
      setError('Failed to load your feedback submissions');
      console.error('Error loading feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  return (
    <div className={PAGE_STYLES.fullPage}>
      {/* Header */}
      <header className={`${PAGE_STYLES.panel.background} shadow-lg border-b-4 border-indigo-500`}>
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className={`p-2 rounded-lg ${PAGE_STYLES.interactive.hover} ${PAGE_STYLES.panel.text}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${MODULE_COLORS.feedback.base} rounded-lg flex items-center justify-center`}>
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>My Feedback</h1>
                  <p className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>View and track your submissions</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 ${MODULE_COLORS.feedback.base} ${MODULE_COLORS.feedback.hover} text-white rounded-lg transition-colors`}
            >
              <Plus className="w-4 h-4" />
              New Feedback
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        <div className={`${PAGE_STYLES.composites.panelContainer}`}>
          {/* Filter Bar */}
          <div className={`flex items-center gap-4 p-4 border-b ${PAGE_STYLES.panel.border}`}>
            <label className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>Filter:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | '')}
              className={`px-3 py-1.5 text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.text} border rounded-lg focus:ring-2 focus:ring-indigo-500`}
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 py-16 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : feedback.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className={`w-12 h-12 mx-auto mb-4 ${PAGE_STYLES.panel.textMuted}`} />
              <p className={PAGE_STYLES.panel.textSecondary}>
                {statusFilter ? 'No feedback with this status' : "You haven't submitted any feedback yet"}
              </p>
              <button
                onClick={() => setIsSubmitModalOpen(true)}
                className={`mt-4 px-4 py-2 ${MODULE_COLORS.feedback.base} ${MODULE_COLORS.feedback.hover} text-white rounded-lg transition-colors inline-flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" />
                Submit Feedback
              </button>
            </div>
          ) : (
            <div className={`divide-y ${PAGE_STYLES.panel.divider}`}>
              {feedback.map((item) => (
                <button
                  key={item.feedback_id}
                  onClick={() => setSelectedFeedbackId(item.feedback_id)}
                  className={`w-full p-4 text-left ${PAGE_STYLES.interactive.hover} transition-colors flex items-center gap-4`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-medium ${PAGE_STYLES.panel.text} truncate`}>
                        {item.title}
                      </h3>
                    </div>
                    <p className={`text-sm ${PAGE_STYLES.panel.textSecondary} line-clamp-2 mb-2`}>
                      {item.description}
                    </p>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className={PAGE_STYLES.panel.textMuted}>{formatDate(item.created_at)}</span>
                      </div>
                      {getStatusBadge(item.status)}
                      {getPriorityBadge(item.priority)}
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 ${PAGE_STYLES.panel.textMuted} flex-shrink-0`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedFeedbackId && (
        <FeedbackDetailModal
          feedbackId={selectedFeedbackId}
          isOpen={true}
          onClose={() => setSelectedFeedbackId(null)}
          onUpdate={loadFeedback}
        />
      )}

      {/* Submit Modal */}
      <FeedbackSubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={loadFeedback}
      />
    </div>
  );
};

export default MyFeedbackPage;
