/**
 * Claude Code Integration Panel
 * Shows Claude assignment, pipeline status, and comment sending for feedback tickets
 *
 * Created: 2026-02-08
 */

import React, { useState } from 'react';
import {
  Send, Loader2, ExternalLink, Bot, Github, GitBranch
} from 'lucide-react';
import {
  FeedbackRequest,
  githubIntegrationApi,
  feedbackApi
} from '../../services/api';

interface Props {
  feedback: FeedbackRequest;
  feedbackId: number;
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
      await feedbackApi.addResponse(feedbackId, `[Sent to Claude] ${claudeComment.trim()}`, true);
      setClaudeComment('');
      onUpdate();
    } catch (err: any) {
      onError(err?.response?.data?.error || 'Failed to send comment');
    } finally {
      setSendingComment(false);
    }
  };

  return (
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
  );
};
