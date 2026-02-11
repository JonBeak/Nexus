/**
 * Slack GitHub Polling Job
 * Safety-net cron job that polls GitHub API for missed webhook events
 *
 * Created: 2026-02-09
 * Purpose: Every 2 minutes, check active tickets for new Claude comments and PR activity.
 * Deduplicates with webhook-delivered events via last_github_comment_id.
 *
 * Rate budget: ~150 GitHub API calls/hour at 5 active tickets. Well under 5000/hour limit.
 */

import cron from 'node-cron';
import { slackIntegrationRepository } from '../repositories/slackIntegrationRepository';
import { slackNotificationService } from '../services/slackNotificationService';
import { githubIntegrationRepository } from '../repositories/githubIntegrationRepository';

interface GitHubComment {
  id: number;
  body: string;
  html_url: string;
  user: { login: string };
  created_at: string;
}

interface GitHubTimelineEvent {
  event: string;
  source?: {
    issue?: {
      number: number;
      html_url: string;
      pull_request?: { url: string };
    };
  };
}

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  if (!token || !owner || !repo) return null;
  return { token, owner, repo };
}

async function pollTicket(
  config: { token: string; owner: string; repo: string },
  ticket: {
    feedback_id: number;
    github_issue_number: number;
    slack_last_polled_at: Date | null;
    last_github_comment_id: number | null;
    title: string;
    pipeline_status: string;
    github_pr_number: number | null;
  }
): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${config.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Poll comments since last poll
  const since = ticket.slack_last_polled_at
    ? new Date(ticket.slack_last_polled_at).toISOString()
    : new Date(Date.now() - 10 * 60 * 1000).toISOString(); // default: last 10 min

  try {
    const commentsRes = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${ticket.github_issue_number}/comments?since=${since}`,
      { headers }
    );

    if (!commentsRes.ok) {
      console.error(`[Poll] GitHub API error for issue #${ticket.github_issue_number}: ${commentsRes.status}`);
      return;
    }

    const comments = await commentsRes.json() as GitHubComment[];

    // Filter to Claude comments not yet seen
    let maxCommentId = ticket.last_github_comment_id || 0;
    for (const comment of comments) {
      if (comment.user.login !== 'github-actions[bot]') continue;
      if (ticket.last_github_comment_id && comment.id <= ticket.last_github_comment_id) continue;

      await slackNotificationService.notifyClaudeComment(
        ticket.feedback_id,
        comment.body,
        comment.html_url
      );

      if (comment.id > maxCommentId) {
        maxCommentId = comment.id;
      }
    }

    // Check for linked PRs that webhooks may have missed (only for claude_working tickets without a PR)
    if (ticket.pipeline_status === 'claude_working' && !ticket.github_pr_number) {
      try {
        const timelineRes = await fetch(
          `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${ticket.github_issue_number}/timeline`,
          { headers: { ...headers, 'Accept': 'application/vnd.github.mockingbird-preview+json' } }
        );

        if (timelineRes.ok) {
          const events = await timelineRes.json() as GitHubTimelineEvent[];
          for (const event of events) {
            if (event.event === 'cross-referenced' && event.source?.issue?.pull_request) {
              const prNumber = event.source.issue.number;
              const prUrl = event.source.issue.html_url;

              // Re-check DB — webhook may have already handled this PR
              const fresh = await githubIntegrationRepository.getGitHubStatus(ticket.feedback_id);
              if (fresh?.github_pr_number) {
                console.log(`[Poll] PR #${prNumber} already recorded for feedback #${ticket.feedback_id} — skipping`);
                break;
              }

              // Update DB and notify (updateGitHubPR sets pipeline_status=pr_ready)
              await githubIntegrationRepository.updateGitHubPR(
                ticket.feedback_id, prNumber, prUrl, ''
              );
              await slackNotificationService.notifyPRReady(ticket.feedback_id, prNumber, prUrl, {
                title: ticket.title,
              });
              console.log(`[Poll] Discovered PR #${prNumber} for feedback #${ticket.feedback_id}`);
              break; // Only care about the first linked PR
            }
          }
        }
      } catch (err) {
        // Timeline API failure is non-critical
        console.error(`[Poll] Timeline check failed for issue #${ticket.github_issue_number}:`, err);
      }
    }

    // Update polling state
    await slackIntegrationRepository.updateLastPolled(
      ticket.feedback_id,
      maxCommentId > (ticket.last_github_comment_id || 0) ? maxCommentId : null
    );
  } catch (error) {
    console.error(`[Poll] Error polling issue #${ticket.github_issue_number}:`, error);
  }
}

async function runPoll(): Promise<void> {
  if (!slackNotificationService.isReady()) return;

  const config = getGitHubConfig();
  if (!config) return;

  try {
    const tickets = await slackIntegrationRepository.getActiveFeedbackForPolling();
    if (tickets.length === 0) return;

    for (const ticket of tickets) {
      await pollTicket(config, ticket);
    }
  } catch (error) {
    console.error('[Poll] Slack/GitHub polling job error:', error);
  }
}

/**
 * Start the polling job — runs every 2 minutes
 */
export function startSlackGitHubPollingJob(): void {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.log('[Poll] Slack not configured — polling job disabled');
    return;
  }

  // Run every 2 minutes
  cron.schedule('*/2 * * * *', () => {
    runPoll();
  });

  console.log('[Poll] Slack/GitHub polling job started (every 2 min)');
}
