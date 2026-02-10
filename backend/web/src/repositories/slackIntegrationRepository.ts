/**
 * Slack Integration Repository
 * Data access layer for Slack thread mapping and polling state
 *
 * Created: 2026-02-09
 * Purpose: Track Slack thread_ts per feedback ticket, manage polling state for GitHub comments
 */

import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { ActivePollingTicket } from '../types/slack';

export class SlackIntegrationRepository {
  /**
   * Store Slack thread_ts for a feedback ticket
   */
  async updateSlackThreadTs(feedbackId: number, threadTs: string): Promise<void> {
    await query(
      'UPDATE feedback_requests SET slack_thread_ts = ? WHERE feedback_id = ?',
      [threadTs, feedbackId]
    );
  }

  /**
   * Get Slack thread_ts for a feedback ticket
   */
  async getSlackThreadTs(feedbackId: number): Promise<string | null> {
    const rows = await query(
      'SELECT slack_thread_ts FROM feedback_requests WHERE feedback_id = ?',
      [feedbackId]
    ) as RowDataPacket[];
    return rows[0]?.slack_thread_ts || null;
  }

  /**
   * Find feedback by Slack thread_ts (for mapping Slack replies back to tickets)
   */
  async findBySlackThreadTs(threadTs: string): Promise<RowDataPacket | null> {
    const rows = await query(
      'SELECT * FROM feedback_requests WHERE slack_thread_ts = ?',
      [threadTs]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get active tickets that need GitHub polling
   * Tickets with claude_working or pr_ready status that have a GitHub issue
   */
  async getActiveFeedbackForPolling(): Promise<ActivePollingTicket[]> {
    return await query(
      `SELECT feedback_id, github_issue_number, pipeline_status,
              slack_thread_ts, slack_last_polled_at, last_github_comment_id, title
       FROM feedback_requests
       WHERE pipeline_status IN ('claude_working', 'pr_ready')
         AND github_issue_number IS NOT NULL`,
      []
    ) as ActivePollingTicket[];
  }

  /**
   * Update polling state after checking GitHub for new comments
   */
  async updateLastPolled(feedbackId: number, lastCommentId: number | null): Promise<void> {
    await query(
      `UPDATE feedback_requests
       SET slack_last_polled_at = NOW(), last_github_comment_id = COALESCE(?, last_github_comment_id)
       WHERE feedback_id = ?`,
      [lastCommentId, feedbackId]
    );
  }
}

export const slackIntegrationRepository = new SlackIntegrationRepository();
