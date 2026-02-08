/**
 * GitHub Integration Service
 * Business logic for creating GitHub Issues from feedback tickets and rate limiting
 *
 * Created: 2026-02-08
 * Purpose: Bridge between feedback system and GitHub/Claude Code Action
 */

import { githubIntegrationRepository } from '../repositories/githubIntegrationRepository';
import { feedbackRepository } from '../repositories/feedbackRepository';
import { ServiceResult } from '../types/serviceResults';

// Rate limits for Claude requests
const RATE_LIMIT_PER_MINUTE = 5;
const RATE_LIMIT_PER_HOUR = 30;

// GitHub API configuration from environment
function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    return null;
  }
  return { token, owner, repo };
}

interface GitHubIssueResponse {
  number: number;
  html_url: string;
}

export class GitHubIntegrationService {
  // ==========================================================================
  // Rate Limiting
  // ==========================================================================

  /**
   * Check if user is within rate limits
   * Returns { allowed: true } or { allowed: false, reason: string }
   */
  async checkRateLimit(userId: number): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const [perMinute, perHour] = await Promise.all([
        githubIntegrationRepository.countRecentRequests(userId, 60),
        githubIntegrationRepository.countRecentRequests(userId, 3600)
      ]);

      if (perMinute >= RATE_LIMIT_PER_MINUTE) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${RATE_LIMIT_PER_MINUTE} requests per minute. Try again shortly.`
        };
      }

      if (perHour >= RATE_LIMIT_PER_HOUR) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${RATE_LIMIT_PER_HOUR} requests per hour. Try again later.`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { allowed: true }; // Fail open — don't block on rate limit DB errors
    }
  }

  // ==========================================================================
  // Assign to Claude (Create GitHub Issue)
  // ==========================================================================

  /**
   * Create a GitHub Issue from a feedback ticket and trigger Claude Code Action
   * Includes @claude in the body to auto-trigger the GitHub Action workflow
   */
  async assignToClaude(
    feedbackId: number,
    userId: number,
    additionalContext?: string
  ): Promise<ServiceResult<{ issueNumber: number; issueUrl: string }>> {
    try {
      // Check GitHub config
      const config = getGitHubConfig();
      if (!config) {
        return {
          success: false,
          error: 'GitHub integration not configured. Set GITHUB_TOKEN, GITHUB_REPO_OWNER, and GITHUB_REPO_NAME in .env',
          code: 'VALIDATION_ERROR'
        };
      }

      // Verify feedback exists
      const feedback = await feedbackRepository.getFeedbackById(feedbackId);
      if (!feedback) {
        return { success: false, error: 'Feedback not found', code: 'NOT_FOUND' };
      }

      // Check if already assigned
      if (feedback.github_issue_number) {
        return {
          success: false,
          error: `Already assigned to Claude (GitHub Issue #${feedback.github_issue_number})`,
          code: 'CONFLICT'
        };
      }

      // Check rate limit
      const rateCheck = await this.checkRateLimit(userId);
      if (!rateCheck.allowed) {
        return { success: false, error: rateCheck.reason!, code: 'VALIDATION_ERROR' };
      }

      // Build issue body with @claude trigger
      const issueBody = this.buildIssueBody(feedback, additionalContext);

      // Create GitHub Issue
      const issue = await this.createGitHubIssue(
        config,
        `[Feedback #${feedbackId}] ${feedback.title}`,
        issueBody
      );

      // Record rate limit hit
      await githubIntegrationRepository.recordRequest(userId, feedbackId, 'assign');

      // Update feedback with GitHub issue number
      await githubIntegrationRepository.updateGitHubIssue(feedbackId, issue.number);

      // Also update feedback status to in_progress
      await feedbackRepository.updateStatus(feedbackId, 'in_progress');

      console.log(`[GitHub] Created Issue #${issue.number} for Feedback #${feedbackId}`);

      return {
        success: true,
        data: { issueNumber: issue.number, issueUrl: issue.html_url }
      };
    } catch (error) {
      console.error('Error assigning to Claude:', error);
      return { success: false, error: 'Failed to create GitHub issue', code: 'INTERNAL_ERROR' };
    }
  }

  // ==========================================================================
  // Post Comment to GitHub Issue
  // ==========================================================================

  /**
   * Post a comment on the linked GitHub Issue (triggers Claude if @claude included)
   */
  async postComment(
    feedbackId: number,
    userId: number,
    comment: string,
    triggerClaude: boolean = true
  ): Promise<ServiceResult<void>> {
    try {
      const config = getGitHubConfig();
      if (!config) {
        return { success: false, error: 'GitHub integration not configured', code: 'VALIDATION_ERROR' };
      }

      // Get GitHub issue number from feedback
      const ghStatus = await githubIntegrationRepository.getGitHubStatus(feedbackId);
      if (!ghStatus || !ghStatus.github_issue_number) {
        return {
          success: false,
          error: 'This feedback is not linked to a GitHub issue. Assign to Claude first.',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check rate limit if triggering Claude
      if (triggerClaude) {
        const rateCheck = await this.checkRateLimit(userId);
        if (!rateCheck.allowed) {
          return { success: false, error: rateCheck.reason!, code: 'VALIDATION_ERROR' };
        }
      }

      const body = triggerClaude ? `@claude ${comment}` : comment;

      // Post on PR if available (Claude edits PR code), otherwise on issue
      // GitHub API treats PRs as issues for comments, so /issues/{number}/comments works for both
      const targetNumber = ghStatus.github_pr_number || ghStatus.github_issue_number;

      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${targetNumber}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({ body })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GitHub] Failed to post comment: ${response.status} ${errorText}`);
        return { success: false, error: 'Failed to post comment to GitHub', code: 'INTERNAL_ERROR' };
      }

      // Record rate limit hit if triggering Claude
      if (triggerClaude) {
        await githubIntegrationRepository.recordRequest(userId, feedbackId, 'comment');
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error posting GitHub comment:', error);
      return { success: false, error: 'Failed to post comment', code: 'INTERNAL_ERROR' };
    }
  }

  // ==========================================================================
  // Get Pipeline Status
  // ==========================================================================

  /**
   * Get GitHub integration status for a feedback ticket
   */
  async getPipelineStatus(feedbackId: number): Promise<ServiceResult<{
    github_issue_number: number | null;
    github_pr_number: number | null;
    github_pr_url: string | null;
    github_branch: string | null;
    pipeline_status: string | null;
  }>> {
    try {
      const status = await githubIntegrationRepository.getGitHubStatus(feedbackId);
      if (!status) {
        return { success: false, error: 'Feedback not found', code: 'NOT_FOUND' };
      }

      return {
        success: true,
        data: {
          github_issue_number: status.github_issue_number || null,
          github_pr_number: status.github_pr_number || null,
          github_pr_url: status.github_pr_url || null,
          github_branch: status.github_branch || null,
          pipeline_status: status.pipeline_status || null
        }
      };
    } catch (error) {
      console.error('Error getting pipeline status:', error);
      return { success: false, error: 'Failed to get pipeline status', code: 'DATABASE_ERROR' };
    }
  }

  // ==========================================================================
  // Rate Limit Status
  // ==========================================================================

  /**
   * Get current rate limit usage for a user
   */
  async getRateLimitStatus(userId: number): Promise<ServiceResult<{
    perMinute: { used: number; limit: number };
    perHour: { used: number; limit: number };
  }>> {
    try {
      const [perMinute, perHour] = await Promise.all([
        githubIntegrationRepository.countRecentRequests(userId, 60),
        githubIntegrationRepository.countRecentRequests(userId, 3600)
      ]);

      return {
        success: true,
        data: {
          perMinute: { used: perMinute, limit: RATE_LIMIT_PER_MINUTE },
          perHour: { used: perHour, limit: RATE_LIMIT_PER_HOUR }
        }
      };
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return { success: false, error: 'Failed to get rate limit status', code: 'DATABASE_ERROR' };
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Build GitHub Issue body with @claude trigger and feedback context
   */
  private buildIssueBody(feedback: any, additionalContext?: string): string {
    const parts = [
      '@claude',
      '',
      '## Feedback Description',
      '',
      feedback.description,
      ''
    ];

    if (feedback.page_url) {
      parts.push(`**Page:** ${feedback.page_url}`, '');
    }

    if (feedback.priority && feedback.priority !== 'medium') {
      parts.push(`**Priority:** ${feedback.priority}`, '');
    }

    if (additionalContext) {
      parts.push('## Additional Context', '', additionalContext, '');
    }

    parts.push(
      '---',
      `Feedback Ticket ID: ${feedback.feedback_id}`,
      `Submitted by: ${feedback.submitter_first_name || 'Unknown'} ${feedback.submitter_last_name || ''}`.trim()
    );

    return parts.join('\n');
  }

  /**
   * Call GitHub API to create an issue
   */
  private async createGitHubIssue(
    config: { token: string; owner: string; repo: string },
    title: string,
    body: string
  ): Promise<GitHubIssueResponse> {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          title,
          body,
          labels: ['user-feedback']
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as GitHubIssueResponse;
    return data;
  }
}

export const githubIntegrationService = new GitHubIntegrationService();
