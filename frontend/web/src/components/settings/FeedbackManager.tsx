/**
 * Feedback Manager
 * Settings page component for viewing and managing feedback requests
 *
 * Created: 2026-01-16
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, ChevronLeft, ChevronRight, AlertCircle, Loader2,
  MessageSquare, Clock, User, Image, Bot, X
} from 'lucide-react';
import {
  feedbackApi,
  FeedbackRequest,
  FeedbackStatus,
  FeedbackPriority
} from '../../services/api';
import { FeedbackDetailModal } from '../feedback/FeedbackDetailModal';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime } from '../../utils/dateUtils';

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

  // Multi-select (manager only)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkClosing, setBulkClosing] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

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

  // Reset page and clear selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [selectedStatuses, priorityFilter]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  // Manage indeterminate state on the select-all checkbox
  const closableOnPage = paginatedItems.filter(i => i.status !== 'closed');
  const selectedOnPage = closableOnPage.filter(i => selectedIds.has(i.feedback_id));
  const allOnPageSelected = closableOnPage.length > 0 && selectedOnPage.length === closableOnPage.length;
  const someOnPageSelected = selectedOnPage.length > 0 && !allOnPageSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected;
    }
  }, [someOnPageSelected]);

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

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(closableOnPage.map(i => i.feedback_id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleQuickClose = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setClosingId(id);
    try {
      await feedbackApi.updateStatus(id, 'closed');
      await loadFeedback();
    } catch (err) {
      console.error('Failed to close feedback:', err);
    } finally {
      setClosingId(null);
    }
  };

  const handleBulkClose = async () => {
    const toClose = [...selectedIds].filter(id => {
      const item = allItems.find(i => i.feedback_id === id);
      return item && item.status !== 'closed';
    });
    if (toClose.length === 0) return;

    setBulkClosing(true);
    setBulkMessage(null);
    try {
      await Promise.all(toClose.map(id => feedbackApi.updateStatus(id, 'closed')));
      setBulkMessage(`Closed ${toClose.length} ${toClose.length === 1 ? 'ticket' : 'tickets'}`);
      setSelectedIds(new Set());
      await loadFeedback();
      setTimeout(() => setBulkMessage(null), 3000);
    } catch (err) {
      console.error('Bulk close failed:', err);
      setBulkMessage('Some tickets failed to close');
      await loadFeedback();
      setTimeout(() => setBulkMessage(null), 3000);
    } finally {
      setBulkClosing(false);
    }
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
          {/* Bulk Action Bar */}
          {isManager && selectedIds.size > 0 && (
            <div className={`flex items-center gap-4 px-4 py-2 rounded-lg border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.input.background}`}>
              <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleBulkClose}
                disabled={bulkClosing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {bulkClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Close Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className={`text-sm ${PAGE_STYLES.panel.textMuted} hover:underline`}
              >
                Deselect All
              </button>
              {bulkMessage && (
                <span className="text-sm text-green-600 font-medium ml-auto">{bulkMessage}</span>
              )}
            </div>
          )}

          {/* Bulk message when no selection */}
          {isManager && selectedIds.size === 0 && bulkMessage && (
            <div className="text-sm text-green-600 font-medium">{bulkMessage}</div>
          )}

          {/* Table */}
          <div className={`rounded-lg border ${PAGE_STYLES.panel.border} overflow-hidden`}>
            <table className="w-full">
              <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.header.text}`}>
                <tr>
                  {isManager && (
                    <th className="px-3 py-3 w-10">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title={allOnPageSelected ? 'Deselect all' : 'Select all'}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Title</th>
                  {isManager && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Submitter</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-28">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Priority</th>
                  {isManager && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Pipeline</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${PAGE_STYLES.panel.divider} ${PAGE_STYLES.panel.background}`}>
                {paginatedItems.map((feedback) => (
                  <tr
                    key={feedback.feedback_id}
                    className={`${PAGE_STYLES.interactive.hover} cursor-pointer ${
                      selectedIds.has(feedback.feedback_id) ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => setSelectedFeedbackId(feedback.feedback_id)}
                  >
                    {isManager && (
                      <td className="px-3 py-3 w-10">
                        {feedback.status !== 'closed' ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(feedback.feedback_id)}
                            onChange={() => toggleSelect(feedback.feedback_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        ) : <div className="w-4" />}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${PAGE_STYLES.panel.text} break-words`}>
                          {feedback.title}
                        </span>
                        {feedback.screenshot_filename && (
                          <Image className="w-4 h-4 text-gray-400" title="Has screenshot" />
                        )}
                      </div>
                      <p className={`text-sm ${PAGE_STYLES.panel.textMuted} break-words`}>
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
                    {isManager && (
                      <td className="px-4 py-3">
                        {feedback.pipeline_status ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                            feedback.pipeline_status === 'claude_working' ? 'bg-violet-100 text-violet-800' :
                            feedback.pipeline_status === 'pr_ready' ? 'bg-cyan-100 text-cyan-800' :
                            feedback.pipeline_status === 'merged' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            <Bot className="w-3 h-3" />
                            {feedback.pipeline_status === 'claude_working' ? 'Working' :
                             feedback.pipeline_status === 'pr_ready' ? 'PR' :
                             feedback.pipeline_status === 'merged' ? 'Merged' : 'Closed'}
                          </span>
                        ) : null}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>
                          {formatDateTime(feedback.created_at)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isManager && feedback.status !== 'closed' ? (
                        <button
                          onClick={(e) => handleQuickClose(feedback.feedback_id, e)}
                          disabled={closingId === feedback.feedback_id}
                          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Close ticket"
                        >
                          {closingId === feedback.feedback_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400 inline" />
                      )}
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
