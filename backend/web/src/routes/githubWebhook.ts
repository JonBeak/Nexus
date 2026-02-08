/**
 * GitHub Webhook Routes
 * Receives webhook events from GitHub (no JWT auth — uses HMAC signature verification)
 *
 * Created: 2026-02-08
 */

import { Router } from 'express';
import { verifyGitHubWebhook } from '../middleware/webhookAuth';
import { githubWebhookController } from '../controllers/githubWebhookController';

const router = Router();

// POST /api/github-webhook — verified by HMAC signature, no JWT
router.post('/', verifyGitHubWebhook, (req, res) => githubWebhookController.handleWebhook(req, res));

export default router;
