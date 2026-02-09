/**
 * Claude Code Integration Panel
 * Shows Claude assignment, pipeline status, comment sending, and activity log
 *
 * Created: 2026-02-08
 * Updated: 2026-02-09 - Added activity log, use is_claude_message flag
 */

import React, { useState } from 'react';
import {
  Send, Loader2, ExternalLink, Bot, Github, GitBranch, Clock
} from 'lucide-react';
import {
  FeedbackRequest,
  FeedbackResponse,
  githubIntegrationApi,
  feedbackApi
} from '../../services/api';
import { formatDateTimeWithYear } from '../../utils/dateUtils';

interface Props {
  feedback: FeedbackRequest;
  feedbackId: number;
  claudeMessages: FeedbackResponse[];
  onUpdate: () => void;
  onError: (msg: string) => void;
}

const PIPELINE_CONFIG: Record<string, { label: string; color: string }> = {
  claude_working: { label: 'Claude Working', color: 'bg-violet-100 text-violet-800' },
  pr_ready: { label: 'PR Ready', color: 'bg-cyan-100 text-cyan-800' },
  merged: { label: 'Merged', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800' }
};

export const getPipelineBadge = (status: string | null | undefined) => {
  if (!status) return null;
  const cfg = PIPELINE_CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color} flex items-center gap-1`}>
      <Bot className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

export const ClaudeIntegrationPanel: React.FC<Props> = ({
  feedback,
  feedbackId,
  claudeMessages,
  onUpdate,
  onError
}) => {
  const [assigningToClaude, setAssigningToClaude] = useState(false);
  const [claudeContext, setClaudeContext] = useState('');
  const [showContextInput, setShowContextInput] = useState(false);
  const [claudeComment, setClaudeComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const handleAssignToClaude = async () => {
    setAssigningToClaude(true);
    try {
      await githubIntegrationApi.assignToClaude(feedbackId, claudeContext || undefined);
      setShowContextInput(false);
      setClaudeContext('');
      onUpdate();
    } catch (err: any) {
      onError(err?.response?.data?.error || 'Failed to assign to Claude');
    } finally {
      setAssigningToClaude(false);
    }
  };

  const handleSendClaudeComment = async () => {
    if (!claudeComment.trim()) return;
    setSendingComment(true);
    try {
      await githubIntegrationApi.postComment(feedbackId, claudeComment.trim(), true);
      await feedbackApi.addResponse(feedbackId, claudeComment.trim(), true, true);
      setClaudeComment('');
      onUpdate();
    } catch (err: any) {
      onError(err?.response?.data?.error || 'Failed to send comment');
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 rounded-lg border border-violet-200 bg-violet-50">
        <h5 className="text-sm font-medium text-violet-900 mb-2 flex items-center gap-2">
          <Github className="w-4 h-4" />
          Claude Code Integration
        </h5>

        {!feedback.github_issue_number ? (
          <div className="space-y-2">
            {showContextInput ? (
              <>
                <textarea
                  value={claudeContext}
                  onChange={(e) => setClaudeContext(e.target.value)}
                  placeholder="Optional: Add context or instructions for Claude..."
                  className="w-full px-3 py-2 bg-white border border-violet-200 text-gray-900 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 min-h-[60px] resize-y text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAssignToClaude}
                    disabled={assigningToClaude}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {assigningToClaude ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    Assign to Claude
                  </button>
                  <button
                    onClick={() => { setShowContextInput(false); setClaudeContext(''); }}
                    className="px-3 py-1.5 text-violet-700 hover:bg-violet-100 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowContextInput(true)}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                <Bot className="w-4 h-4" />
                Assign to Claude
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {getPipelineBadge(feedback.pipeline_status)}
              <span className="text-violet-700 flex items-center gap-1">
                Issue #{feedback.github_issue_number}
              </span>
              {feedback.github_pr_url && (
                <a
                  href={feedback.github_pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-700 hover:text-violet-900 flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GitBranch className="w-3 h-3" />
                  PR #{feedback.github_pr_number}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {(feedback.pipeline_status === 'claude_working' || feedback.pipeline_status === 'pr_ready') && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={claudeComment}
                  onChange={(e) => setClaudeComment(e.target.value)}
                  placeholder="Send instructions to Claude..."
                  className="flex-1 px-3 py-1.5 bg-white border border-violet-200 text-gray-900 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendClaudeComment();
                    }
                  }}
                />
                <button
                  onClick={handleSendClaudeComment}
                  disabled={sendingComment || !claudeComment.trim()}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="mt-3 flex-1 min-h-0 flex flex-col">
        <h5 className="text-sm font-medium text-violet-900 mb-2 flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Claude Activity ({claudeMessages.length})
        </h5>
        <div className="flex-1 overflow-y-auto space-y-2">
          {claudeMessages.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No messages sent to Claude yet</p>
          ) : (
            claudeMessages.map((msg) => (
              <div
                key={msg.response_id}
                className="p-2 rounded border border-violet-200 bg-white text-sm"
              >
                <div className="flex items-center gap-1 mb-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {formatDateTimeWithYear(msg.created_at)}
                </div>
                <p className="text-gray-800 whitespace-pre-wrap text-xs">{msg.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
