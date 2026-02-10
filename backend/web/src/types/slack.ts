/**
 * Slack Integration Type Definitions
 * Created: 2026-02-09
 * Purpose: Types for Slack bot integration with feedback/GitHub pipeline
 */

export interface SlackConfig {
  botToken: string;
  appToken: string;
  channelId: string;
}

export interface SlackNotification {
  feedbackId: number;
  title: string;
  description?: string;
  issueNumber?: number;
  prNumber?: number;
  prUrl?: string;
  commentBody?: string;
  commentUrl?: string;
}

export interface SlackThreadMapping {
  feedbackId: number;
  slackThreadTs: string;
  lastPolledAt: Date | null;
  lastGithubCommentId: number | null;
}

export interface ActivePollingTicket {
  feedback_id: number;
  github_issue_number: number;
  pipeline_status: string;
  slack_thread_ts: string | null;
  slack_last_polled_at: Date | null;
  last_github_comment_id: number | null;
  title: string;
  github_pr_number: number | null;
}
