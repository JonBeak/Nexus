/**
 * Feedback Manager
 * Settings page component for viewing and managing feedback requests
 *
 * Created: 2026-01-16
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, ChevronLeft, ChevronRight, AlertCircle, Loader2,
  MessageSquare, Clock, User, Image
} from 'lucide-react';
import {
  feedbackApi,
  FeedbackRequest,
  FeedbackStatus,
  FeedbackPriority,
  FeedbackListResponse
} from '../../services/api';
import { FeedbackDetailModal } from '../feedback/FeedbackDetailModal';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_OPTIONS: { value: FeedbackStatus; label: string; color: string }[] = [
  { value: 'open', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-800' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' }
];

// Default: show all except closed
const DEFAULT_STATUSES = new Set<FeedbackStatus>(['open', 'in_progress', 'resolved']);

const PRIORITY_OPTIONS: { value: FeedbackPriority | ''; label: string; color: string }[] = [
  { value: '', label: 'All Priorities', color: '' },
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' }
];

const ITEMS_PER_PAGE = 10;

export const FeedbackManager: React.FC = () => {
  const { isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState<Set<FeedbackStatus>>(new Set(DEFAULT_STATUSES));
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | ''>('');
  const [page, setPage] = useState(1);

  // Detail modal
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<number | null>(null);

  // Store all fetched items for client-side status filtering
  const [allItems, setAllItems] = useState<FeedbackRequest[]>([]);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all items (no status filter - we filter client-side for multi-select)
      const data = await feedbackApi.getList({
        priority: priorityFilter || undefined,
        limit: 1000 // Get all for client-side filtering
      });
      setAllItems(data.items);
    } catch (err) {
      setError('Failed to load feedback');
      console.error('Error loading feedback:', err);
    } finally {
      setLoading(false);
    }
  }, [priorityFilter]);

  // Filter and paginate client-side based on selected statuses
  const filteredItems = allItems.filter(item => selectedStatuses.has(item.status));
  const paginatedItems = filteredItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const filteredTotal = filteredItems.length;

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedStatuses, priorityFilter]);

  const totalPages = Math.ceil(filteredTotal / ITEMS_PER_PAGE);

  // Toggle status in selection
  const toggleStatus = (status: FeedbackStatus) => {
    setSelectedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text}`}>
            Feedback Manager
          </h2>
          <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            {isManager ? 'View and manage all feedback submissions' : 'View your feedback submissions'}
          </p>
        </div>
        <button
          onClick={loadFeedback}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-2 ${PAGE_STYLES.panel.text} hover:bg-gray-100 rounded-lg transition-colors`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className={`flex flex-wrap gap-4 p-3 rounded-lg border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.input.background}`}>
        <div>
          <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textMuted} mb-2`}>
            Status
          </label>
          <div className="flex flex-wrap gap-3">
            {STATUS_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedStatuses.has(opt.value)}
                  onChange={() => toggleStatus(opt.value)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="border-l border-gray-300 pl-4">
          <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textMuted} mb-1`}>
            Priority
          </label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as FeedbackPriority | '')}
            className={`px-3 py-1.5 text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.input.text} border rounded-lg focus:ring-1 focus:ring-blue-500`}
          >
            {PRIORITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end ml-auto">
          <span className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            {filteredTotal} {filteredTotal === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* Content */}
      {loading && allItems.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 py-8 justify-center">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{allItems.length === 0 ? 'No feedback found' : 'No feedback matches the selected filters'}</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className={`rounded-lg border ${PAGE_STYLES.panel.border} overflow-hidden`}>
            <table className="w-full">
              <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.header.text}`}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Title</th>
                  {isManager && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Submitter</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider w-16"></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${PAGE_STYLES.panel.divider} ${PAGE_STYLES.panel.background}`}>
                {paginatedItems.map((feedback) => (
                  <tr
                    key={feedback.feedback_id}
                    className={`${PAGE_STYLES.interactive.hover} cursor-pointer`}
                    onClick={() => setSelectedFeedbackId(feedback.feedback_id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${PAGE_STYLES.panel.text}`}>
                          {feedback.title}
                        </span>
                        {feedback.screenshot_filename && (
                          <Image className="w-4 h-4 text-gray-400" title="Has screenshot" />
                        )}
                      </div>
                      <p className={`text-sm ${PAGE_STYLES.panel.textMuted} truncate max-w-md`}>
                        {feedback.description}
                      </p>
                    </td>
                    {isManager && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                            {feedback.submitter_first_name} {feedback.submitter_last_name}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {getStatusBadge(feedback.status)}
                    </td>
                    <td className="px-4 py-3">
                      {getPriorityBadge(feedback.priority)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                          {formatDate(feedback.created_at)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ChevronRight className="w-5 h-5 text-gray-400 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
                Showing {((page - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(page * ITEMS_PER_PAGE, filteredTotal)} of {filteredTotal}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`p-2 rounded-lg ${PAGE_STYLES.panel.text} hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className={`text-sm ${PAGE_STYLES.panel.text}`}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`p-2 rounded-lg ${PAGE_STYLES.panel.text} hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedFeedbackId && (
        <FeedbackDetailModal
          feedbackId={selectedFeedbackId}
          isOpen={true}
          onClose={() => setSelectedFeedbackId(null)}
          onUpdate={loadFeedback}
        />
      )}
    </div>
  );
};
