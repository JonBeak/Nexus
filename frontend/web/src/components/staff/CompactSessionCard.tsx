/**
 * CompactSessionCard Component
 * Mini card for displaying a completed session with edit/delete request buttons
 *
 * Created: 2025-01-15
 */

import React from 'react';
import { Clock, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import type { CompletedSessionDisplay } from '../../services/api/staff/types';
import { formatTime, formatDuration } from '../../utils/dateUtils';

interface Props {
  session: CompletedSessionDisplay;
  onEditRequest?: (session: CompletedSessionDisplay) => void;
  onDeleteRequest?: (session: CompletedSessionDisplay) => void;
}

export const CompactSessionCard: React.FC<Props> = ({ session, onEditRequest, onDeleteRequest }) => {
  const hasPending = !!session.has_pending_request;
  const pendingType = session.pending_request_type;
  const isDeleteRequest = pendingType === 'delete';

  // Allow clicking the card to edit/update request
  const handleCardClick = () => {
    if (onEditRequest) {
      onEditRequest(session);
    }
  };

  // Color scheme based on pending request type
  const getBorderColor = () => {
    if (!hasPending) return 'border-gray-200 bg-white hover:bg-gray-50';
    if (isDeleteRequest) return 'border-red-300 bg-red-50 hover:bg-red-100';
    return 'border-purple-300 bg-purple-50 hover:bg-purple-100';
  };

  const getIconColor = () => {
    if (isDeleteRequest) return 'text-red-500';
    return 'text-purple-500';
  };

  const getBadgeColors = () => {
    if (isDeleteRequest) return 'bg-red-200 text-red-700';
    return 'bg-purple-200 text-purple-700';
  };

  return (
    <div
      className={`border rounded py-2 px-3 transition-all hover:shadow-sm group cursor-pointer ${getBorderColor()}`}
      onClick={handleCardClick}
      title={hasPending ? 'Click to view or update your pending request' : 'Click to request an edit'}
    >
      {/* Row 1: Task name (left) + Duration + Actions (right) */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {hasPending && (
            <span
              className="flex-shrink-0"
              title={`Pending ${pendingType || 'edit'} request`}
            >
              <AlertCircle className={`w-4 h-4 ${getIconColor()}`} />
            </span>
          )}
          <span className={`text-sm font-medium truncate ${PAGE_STYLES.panel.text}`}>
            {session.task_name}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Edit/Delete buttons - show on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            {onEditRequest && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditRequest(session);
                }}
                className="p-1 rounded hover:bg-purple-100 text-gray-400 hover:text-purple-600 transition-colors"
                title={hasPending ? "View/update request" : "Request edit"}
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onDeleteRequest && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRequest(session);
                }}
                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                title={hasPending ? "View/update request" : "Request deletion"}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          {hasPending && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getBadgeColors()}`}>
              Pending
            </span>
          )}
          <span
            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700"
            title={session.effective_duration_minutes !== null &&
                   Math.round(session.effective_duration_minutes) !== session.duration_minutes
                   ? `Effective: ${formatDuration(Math.round(session.effective_duration_minutes))}, Raw: ${formatDuration(session.duration_minutes)}`
                   : undefined}
          >
            <Clock className="w-3 h-3" />
            {formatDuration(session.effective_duration_minutes !== null ? Math.round(session.effective_duration_minutes) : session.duration_minutes)}
          </span>
        </div>
      </div>

      {/* Row 2: Order info (left) + Time range (right) */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs truncate ${PAGE_STYLES.panel.textMuted}`}>
          #{session.order_number} - {session.order_name}
        </span>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {formatTime(session.started_at)} - {formatTime(session.ended_at)}
        </span>
      </div>
    </div>
  );
};

export default CompactSessionCard;
