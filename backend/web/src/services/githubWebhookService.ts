/**
 * GitHub Webhook Service
 * Handles incoming GitHub webhook events for PR and Issue lifecycle tracking
 *
 * Created: 2026-02-08
 * Purpose: Process GitHub webhook payloads and update feedback pipeline status
 */

import { githubIntegrationRepository } from '../repositories/githubIntegrationRepository';
import { feedbackRepository } from '../repositories/feedbackRepository';
import { slackNotificationService } from './slackNotificationService';
import { slackIntegrationRepository } from '../repositories/slackIntegrationRepository';

interface PullRequestPayload {
  action: string;
  pull_request: {
    number: number;
    html_url: string;
    head: { ref: string };
    body: string | null;
    merged: boolean;
  };
}

interface IssuePayload {
  action: string;
  issue: {
    number: number;
  };
}

interface IssueCommentPayload {
  action: string;
  comment: {
    id: number;
    body: string;
    html_url: string;
    user: {
      login: string;
    };
  };
  issue: {
    number: number;
  };
}

export class GitHubWebhookService {
  /**
   * Handle pull_request webhook events
   * Maps PR to feedback via linked issue number, updates pipeline status
   */
  async handlePullRequest(payload: PullRequestPayload): Promise<void> {
    const { action, pull_request: pr } = payload;
    const issueNumber = this.extractLinkedIssueNumber(pr);

    if (!issueNumber) {
      console.log(`[Webhook] PR #${pr.number} — no linked issue found, skipping`);
      return;
    }

    const feedback = await githubIntegrationRepository.findByGitHubIssue(issueNumber);
    if (!feedback) {
      console.log(`[Webhook] PR #${pr.number} — no feedback linked to issue #${issueNumber}`);
      return;
    }

    const feedbackId = feedback.feedback_id;

    if (action === 'opened' || action === 'reopened') {
      await githubIntegrationRepository.updateGitHubPR(
        feedbackId,
        pr.number,
        pr.html_url,
        pr.head.ref
      );
      console.log(`[Webhook] PR #${pr.number} ${action} → feedback #${feedbackId} pipeline_status=pr_ready`);

      // Notify Slack
      slackNotificationService.notifyPRReady(feedbackId, pr.number, pr.html_url, {
        title: feedback.title,
      }).catch(err => console.error('[Slack] PR notification failed:', err));
    } else if (action === 'closed') {
      if (pr.merged) {
        await githubIntegrationRepository.updatePipelineStatus(feedbackId, 'merged');
        await feedbackRepository.updateStatus(feedbackId, 'resolved');
        console.log(`[Webhook] PR #${pr.number} merged → feedback #${feedbackId} resolved`);

        // Notify Slack
        slackNotificationService.notifyMerged(feedbackId, {
          title: feedback.title,
          github_pr_url: pr.html_url,
          github_pr_number: pr.number,
        }).catch(err => console.error('[Slack] Merged notification failed:', err));
      } else {
        // PR closed without merge — Claude can retry
        await githubIntegrationRepository.updatePipelineStatus(feedbackId, 'claude_working');
        console.log(`[Webhook] PR #${pr.number} closed (not merged) → feedback #${feedbackId} back to claude_working`);
      }
    }
  }

  /**
   * Handle issues webhook events
   * When issue is closed, update pipeline status
   */
  async handleIssueEvent(payload: IssuePayload): Promise<void> {
    const { action, issue } = payload;

    if (action !== 'closed') return;

    const feedback = await githubIntegrationRepository.findByGitHubIssue(issue.number);
    if (!feedback) {
      console.log(`[Webhook] Issue #${issue.number} closed — no linked feedback`);
      return;
    }

    // Only update to 'closed' if not already merged (merged is a terminal success state)
    if (feedback.pipeline_status !== 'merged') {
      await githubIntegrationRepository.updatePipelineStatus(feedback.feedback_id, 'closed');
      console.log(`[Webhook] Issue #${issue.number} closed → feedback #${feedback.feedback_id} pipeline=closed`);
    }
  }

  /**
   * Handle issue_comment webhook events
   * Forwards Claude (github-actions[bot]) comments to Slack
   */
  async handleIssueComment(payload: IssueCommentPayload): Promise<void> {
    const { action, comment, issue } = payload;

    // Only care about new comments from Claude (github-actions bot)
    if (action !== 'created') return;
    if (comment.user.login !== 'github-actions[bot]') return;

    const feedback = await githubIntegrationRepository.findByGitHubIssue(issue.number);
    if (!feedback) {
      console.log(`[Webhook] Comment on issue #${issue.number} — no linked feedback`);
      return;
    }

    console.log(`[Webhook] Claude comment on issue #${issue.number} → feedback #${feedback.feedback_id}`);

    // Update dedup marker BEFORE sending to Slack so the polling job won't re-send
    await slackIntegrationRepository.updateLastCommentId(feedback.feedback_id, comment.id);

    slackNotificationService.notifyClaudeComment(
      feedback.feedback_id,
      comment.body,
      comment.html_url
    ).catch(err => console.error('[Slack] Claude comment notification failed:', err));
  }

  /**
   * Extract linked issue number from PR body or branch name
   * Looks for "Fixes #N" / "Closes #N" patterns, then falls back to branch name pattern
   */
  private extractLinkedIssueNumber(pr: { body: string | null; head: { ref: string } }): number | null {
    // Check PR body for "Fixes #N", "Closes #N", "Resolves #N"
    if (pr.body) {
      const bodyMatch = pr.body.match(/(?:fixes|closes|resolves)\s+#(\d+)/i);
      if (bodyMatch) {
        return parseInt(bodyMatch[1], 10);
      }
    }

    // Fall back to branch name pattern: claude/issue-{N}-* (Claude Code Action pattern)
    const branchMatch = pr.head.ref.match(/issue-(\d+)/);
    if (branchMatch) {
      return parseInt(branchMatch[1], 10);
    }

    return null;
  }
}

export const githubWebhookService = new GitHubWebhookService();
