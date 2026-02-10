/**
 * Slack Dispatch Service
 * Inbound Slack messages → GitHub Issue creation and reply forwarding
 *
 * Created: 2026-02-09
 * Purpose: Register Socket Mode event handlers to create tasks from Slack
 * and forward thread replies as GitHub Issue comments.
 */

import { App } from '@slack/bolt';
import { feedbackRepository } from '../repositories/feedbackRepository';
import { githubIntegrationService } from './githubIntegrationService';
import { slackIntegrationRepository } from '../repositories/slackIntegrationRepository';
import { slackNotificationService } from './slackNotificationService';

// System user ID for Slack-dispatched tasks (user_id 1 = admin/system)
const SLACK_SYSTEM_USER_ID = 1;

class SlackDispatchService {
  /**
   * Register event handlers on the Bolt app
   * Call after slackNotificationService.initialize()
   */
  register(app: App): void {
    // Handle app mentions: @bot <task description>
    app.event('app_mention', async ({ event, say }) => {
      try {
        await this.handleNewTask(event.text, event.ts, event.channel, say);
      } catch (error) {
        console.error('[Slack Dispatch] Error handling app_mention:', error);
        await say({ text: 'Something went wrong creating that task.', thread_ts: event.ts });
      }
    });

    // Handle messages in channel (for thread replies to existing tickets)
    app.event('message', async ({ event }) => {
      try {
        // Only care about thread replies (messages with thread_ts that aren't the parent)
        const msg = event as any;
        if (!msg.thread_ts || msg.thread_ts === msg.ts) return;
        // Ignore bot messages to prevent loops
        if (msg.bot_id || msg.subtype === 'bot_message') return;

        await this.handleThreadReply(msg.text, msg.thread_ts, msg.user);
      } catch (error) {
        console.error('[Slack Dispatch] Error handling thread reply:', error);
      }
    });

    console.log('[Slack Dispatch] Event handlers registered');
  }

  /**
   * Handle a new task from Slack
   * Creates feedback_request + GitHub Issue with @claude
   */
  private async handleNewTask(
    rawText: string,
    messageTs: string,
    channel: string,
    say: (msg: any) => Promise<any>
  ): Promise<void> {
    // Strip the bot mention from the text
    const text = rawText.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (!text) {
      await say({ text: 'Please include a task description after mentioning me.', thread_ts: messageTs });
      return;
    }

    // Use first line as title, full text as description
    const lines = text.split('\n');
    const title = lines[0].substring(0, 200); // Cap title length
    const description = text;

    // Create feedback request in DB
    const feedbackId = await feedbackRepository.createFeedback(
      { title, description },
      SLACK_SYSTEM_USER_ID,
      'Slack Bot'
    );

    // Store the Slack thread_ts for this feedback
    await slackIntegrationRepository.updateSlackThreadTs(feedbackId, messageTs);

    // Assign to Claude (creates GitHub Issue)
    const result = await githubIntegrationService.assignToClaude(
      feedbackId,
      SLACK_SYSTEM_USER_ID
    );

    if (result.success) {
      await say({
        text: `Created Feedback #${feedbackId} — Claude is on it (Issue #${result.data!.issueNumber})`,
        thread_ts: messageTs,
      });
    } else {
      await say({
        text: `Created Feedback #${feedbackId} but couldn't assign to Claude: ${result.error}`,
        thread_ts: messageTs,
      });
    }
  }

  /**
   * Handle a thread reply — forward as GitHub Issue comment
   */
  private async handleThreadReply(
    text: string,
    threadTs: string,
    slackUserId: string
  ): Promise<void> {
    if (!text) return;

    // Look up which feedback ticket this thread belongs to
    const feedback = await slackIntegrationRepository.findBySlackThreadTs(threadTs);
    if (!feedback) return; // Not a ticket thread, ignore

    if (!feedback.github_issue_number) {
      console.log(`[Slack Dispatch] Thread reply for feedback #${feedback.feedback_id} but no GitHub issue linked`);
      return;
    }

    // Forward the message as a GitHub Issue comment (with @claude to trigger)
    const comment = `[From Slack user <@${slackUserId}>]\n\n${text}`;
    const result = await githubIntegrationService.postComment(
      feedback.feedback_id,
      SLACK_SYSTEM_USER_ID,
      comment,
      true // trigger Claude
    );

    if (result.success) {
      // React with checkmark to confirm forwarded
      const app = slackNotificationService.getApp();
      if (app) {
        try {
          await app.client.reactions.add({
            channel: process.env.SLACK_CHANNEL_ID!,
            name: 'white_check_mark',
            timestamp: threadTs,
          });
        } catch {
          // Reaction failure is non-critical
        }
      }
    } else {
      console.error(`[Slack Dispatch] Failed to forward reply to GitHub: ${result.error}`);
    }
  }
}

export const slackDispatchService = new SlackDispatchService();
