/**
 * Slack Notification Service
 * Outbound Slack messaging — all messages flow through this service
 *
 * Created: 2026-02-09
 * Purpose: Post notifications to Slack channel with thread-per-ticket model.
 * Socket Mode (WebSocket outward) — no public endpoint needed.
 * Graceful degradation — if Slack env vars missing, all methods are no-ops.
 */

import { App } from '@slack/bolt';
import { slackIntegrationRepository } from '../repositories/slackIntegrationRepository';
import { SlackConfig } from '../types/slack';

// Retry config
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

class SlackNotificationService {
  private app: App | null = null;
  private config: SlackConfig | null = null;
  private initialized = false;

  /**
   * Initialize Slack Bolt app in Socket Mode
   * Call once during server startup — if env vars missing, logs warning and becomes no-op
   */
  async initialize(): Promise<void> {
    const botToken = process.env.SLACK_BOT_TOKEN;
    const appToken = process.env.SLACK_APP_TOKEN;
    const channelId = process.env.SLACK_CHANNEL_ID;

    if (!botToken || !appToken || !channelId) {
      console.log('[Slack] Missing SLACK_BOT_TOKEN, SLACK_APP_TOKEN, or SLACK_CHANNEL_ID — Slack integration disabled');
      return;
    }

    this.config = { botToken, appToken, channelId };

    try {
      this.app = new App({
        token: botToken,
        appToken: appToken,
        socketMode: true,
      });

      await this.app.start();
      this.initialized = true;
      console.log('[Slack] Bot connected via Socket Mode');
    } catch (error) {
      console.error('[Slack] Failed to initialize:', error);
      this.app = null;
    }
  }

  /** Expose the Bolt app for dispatch service to register event handlers */
  getApp(): App | null {
    return this.app;
  }

  isReady(): boolean {
    return this.initialized && this.app !== null;
  }

  // ==========================================================================
  // Notification Methods (fire-and-forget, never block callers)
  // ==========================================================================

  /**
   * Notify when a feedback ticket is assigned to Claude (GitHub Issue created)
   * Posts parent message to channel, stores thread_ts
   */
  async notifyAssigned(feedbackId: number, feedback: {
    title: string;
    github_issue_number?: number | null;
    priority?: string;
    submitter_first_name?: string;
  }): Promise<void> {
    if (!this.isReady()) return;

    const ghOwner = process.env.GITHUB_REPO_OWNER;
    const ghRepo = process.env.GITHUB_REPO_NAME;
    const issueUrl = feedback.github_issue_number && ghOwner && ghRepo
      ? `https://github.com/${ghOwner}/${ghRepo}/issues/${feedback.github_issue_number}`
      : null;

    const blocks = [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `*#${feedbackId} — ${this.escapeSlack(feedback.title)}*\nAssigned to Claude${feedback.submitter_first_name ? ` (from ${feedback.submitter_first_name})` : ''}`,
        },
      },
      {
        type: 'context' as const,
        elements: [
          {
            type: 'mrkdwn' as const,
            text: [
              feedback.priority && feedback.priority !== 'medium' ? `Priority: *${feedback.priority}*` : null,
              issueUrl ? `<${issueUrl}|GitHub Issue #${feedback.github_issue_number}>` : null,
            ].filter(Boolean).join(' · ') || `Feedback #${feedbackId}`,
          },
        ],
      },
    ];

    const text = `#${feedbackId} — ${feedback.title} — assigned to Claude`;

    await this.postOrReply(feedbackId, text, blocks);
  }

  /**
   * Notify when Claude creates a PR
   */
  async notifyPRReady(feedbackId: number, prNumber: number, prUrl: string, feedback: {
    title: string;
  }): Promise<void> {
    if (!this.isReady()) return;

    const text = `PR ready for review: <${prUrl}|#${prNumber}>`;
    const blocks = [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `:mag: *PR Ready* — <${prUrl}|#${prNumber}>\nReady for review on _${this.escapeSlack(feedback.title)}_`,
        },
      },
    ];

    await this.postOrReply(feedbackId, text, blocks);
  }

  /**
   * Notify when Claude posts a comment on the GitHub Issue
   */
  async notifyClaudeComment(feedbackId: number, commentBody: string, commentUrl: string): Promise<void> {
    if (!this.isReady()) return;

    // Truncate long comments for Slack
    const truncated = commentBody.length > 500
      ? commentBody.substring(0, 497) + '...'
      : commentBody;

    const text = `Claude commented: ${truncated}`;
    const blocks = [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `:speech_balloon: *Claude commented* (<${commentUrl}|view>)\n>>> ${this.escapeSlack(truncated)}`,
        },
      },
    ];

    await this.postOrReply(feedbackId, text, blocks);
  }

  /**
   * Notify when a PR is merged
   */
  async notifyMerged(feedbackId: number, feedback: {
    title: string;
    github_pr_url?: string | null;
    github_pr_number?: number | null;
  }): Promise<void> {
    if (!this.isReady()) return;

    const prLink = feedback.github_pr_url && feedback.github_pr_number
      ? `<${feedback.github_pr_url}|PR #${feedback.github_pr_number}>`
      : 'PR';

    const text = `Merged! ${feedback.title}`;
    const blocks = [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `:white_check_mark: *Merged* — ${prLink}\n_${this.escapeSlack(feedback.title)}_ is now live`,
        },
      },
    ];

    await this.postOrReply(feedbackId, text, blocks);
  }

  // ==========================================================================
  // Thread Management
  // ==========================================================================

  /**
   * Post a new message or reply in existing thread for a feedback ticket
   * - First message for a ticket → post to channel, save thread_ts
   * - Subsequent messages → reply in thread
   */
  private async postOrReply(
    feedbackId: number,
    text: string,
    blocks: any[]
  ): Promise<void> {
    if (!this.app || !this.config) return;

    try {
      const existingTs = await slackIntegrationRepository.getSlackThreadTs(feedbackId);

      if (existingTs) {
        // Reply in existing thread
        await this.withRetry(() =>
          this.app!.client.chat.postMessage({
            channel: this.config!.channelId,
            text,
            blocks,
            thread_ts: existingTs,
          })
        );
      } else {
        // New parent message
        const result = await this.withRetry(() =>
          this.app!.client.chat.postMessage({
            channel: this.config!.channelId,
            text,
            blocks,
          })
        );

        // Store thread_ts for future replies
        if (result?.ts) {
          await slackIntegrationRepository.updateSlackThreadTs(feedbackId, result.ts);
        }
      }
    } catch (error) {
      console.error(`[Slack] Failed to post message for feedback #${feedbackId}:`, error);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Retry with exponential backoff
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Escape special Slack mrkdwn characters
   */
  private escapeSlack(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const slackNotificationService = new SlackNotificationService();
