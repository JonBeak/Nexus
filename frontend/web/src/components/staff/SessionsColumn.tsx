/**
 * SessionsColumn Component
 * Column showing completed sessions for today with edit/delete request functionality
 *
 * Created: 2025-01-15
 */

import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';
import type { CompletedSessionDisplay } from '../../services/api/staff/types';
import { CompactSessionCard } from './CompactSessionCard';
import { SessionEditRequestForm } from './SessionEditRequestForm';
import { formatDuration } from '../../utils/dateUtils';

interface Props {
  sessions: CompletedSessionDisplay[];
  totalMinutes: number;
  onRequestSubmitted?: () => void;
}

export const SessionsColumn: React.FC<Props> = ({ sessions, totalMinutes, onRequestSubmitted }) => {
  const [selectedSession, setSelectedSession] = useState<CompletedSessionDisplay | null>(null);
  const [requestMode, setRequestMode] = useState<'edit' | 'delete'>('edit');
  const [showRequestForm, setShowRequestForm] = useState(false);

  const handleEditRequest = (session: CompletedSessionDisplay) => {
    setSelectedSession(session);
    setRequestMode('edit');
    setShowRequestForm(true);
  };

  const handleDeleteRequest = (session: CompletedSessionDisplay) => {
    setSelectedSession(session);
    setRequestMode('delete');
    setShowRequestForm(true);
  };

  const handleFormClose = () => {
    setShowRequestForm(false);
    setSelectedSession(null);
  };

  const handleFormSuccess = () => {
    setShowRequestForm(false);
    setSelectedSession(null);
    onRequestSubmitted?.();
  };

  return (
    <>
      <div className={`flex-shrink-0 w-72 flex flex-col rounded-lg border ${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.background}`}>
        {/* Column Header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 rounded-t-lg bg-purple-50">
          <Clock className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-800">
            Sessions
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-700">
            {sessions.length}
          </span>
          {totalMinutes > 0 && (
            <span className="text-xs text-purple-600 ml-auto">
              Total: {formatDuration(totalMinutes)}
            </span>
          )}
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
          {sessions.length === 0 ? (
            <div className={`text-center py-8 ${PAGE_STYLES.panel.textMuted} text-xs`}>
              No sessions completed today
            </div>
          ) : (
            sessions.map(session => (
              <CompactSessionCard
                key={session.session_id}
                session={session}
                onEditRequest={handleEditRequest}
                onDeleteRequest={handleDeleteRequest}
              />
            ))
          )}
        </div>
      </div>

      {/* Session Edit Request Form Modal */}
      <SessionEditRequestForm
        session={selectedSession}
        isOpen={showRequestForm}
        mode={requestMode}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    </>
  );
};

export default SessionsColumn;
