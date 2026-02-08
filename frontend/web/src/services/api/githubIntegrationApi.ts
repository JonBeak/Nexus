/**
 * GitHub Integration API Module
 * Client for GitHub/Claude Code integration endpoints
 *
 * Created: 2026-02-08
 */

import { api } from '../apiClient';

// =============================================================================
// Types
// =============================================================================

export type PipelineStatus = 'claude_working' | 'pr_ready' | 'merged' | 'closed' | null;

export interface GitHubPipelineInfo {
  github_issue_number: number | null;
  github_pr_number: number | null;
  github_pr_url: string | null;
  github_branch: string | null;
  pipeline_status: PipelineStatus;
}

export interface AssignToClaudeResult {
  issueNumber: number;
  issueUrl: string;
}

export interface RateLimitInfo {
  perMinute: { used: number; limit: number };
  perHour: { used: number; limit: number };
}

// =============================================================================
// API Functions
// =============================================================================

export const githubIntegrationApi = {
  /**
   * Assign a feedback ticket to Claude (creates GitHub Issue with @claude)
   */
  assignToClaude: async (feedbackId: number, additionalContext?: string): Promise<AssignToClaudeResult> => {
    const response = await api.post(`/github-integration/${feedbackId}/assign`, {
      additional_context: additionalContext
    });
    return response.data;
  },

  /**
   * Post a comment on the linked GitHub Issue/PR
   * @param triggerClaude - If true, prefixes with @claude to trigger Claude Code Action
   */
  postComment: async (feedbackId: number, comment: string, triggerClaude: boolean = true): Promise<void> => {
    await api.post(`/github-integration/${feedbackId}/comment`, {
      comment,
      trigger_claude: triggerClaude
    });
  },

  /**
   * Get pipeline status for a feedback ticket
   */
  getPipelineStatus: async (feedbackId: number): Promise<GitHubPipelineInfo> => {
    const response = await api.get(`/github-integration/${feedbackId}/status`);
    return response.data;
  },

  /**
   * Get current rate limit usage
   */
  getRateLimitStatus: async (): Promise<RateLimitInfo> => {
    const response = await api.get('/github-integration/rate-limit');
    return response.data;
  }
};
