/**
 * GitHub Webhook Controller
 * Handles incoming GitHub webhook HTTP requests
 *
 * Created: 2026-02-08
 * Purpose: Route webhook events to the appropriate service handler
 */

import { Request, Response } from 'express';
import { githubWebhookService } from '../services/githubWebhookService';

export class GitHubWebhookController {
  /**
   * POST /api/github-webhook
   * Responds 200 immediately, then processes the event asynchronously
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const event = req.headers['x-github-event'] as string;

    // Respond immediately — GitHub expects a fast response
    res.status(200).json({ received: true });

    try {
      if (event === 'pull_request') {
        await githubWebhookService.handlePullRequest(req.body);
      } else if (event === 'issues') {
        await githubWebhookService.handleIssueEvent(req.body);
      } else if (event === 'issue_comment') {
        await githubWebhookService.handleIssueComment(req.body);
      } else {
        console.log(`[Webhook] Ignored event type: ${event}`);
      }
    } catch (error) {
      console.error(`[Webhook] Error processing ${event} event:`, error);
    }
  }
}

export const githubWebhookController = new GitHubWebhookController();
