/**
 * GitHub Webhook Authentication Middleware
 * Verifies x-hub-signature-256 header using HMAC-SHA256
 *
 * Created: 2026-02-08
 * Purpose: Authenticate incoming GitHub webhook requests
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const verifyGitHubWebhook = (req: Request, res: Response, next: NextFunction): void => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Webhook] GITHUB_WEBHOOK_SECRET not configured');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    console.warn('[Webhook] Missing x-hub-signature-256 header');
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  const rawBody = (req as any).rawBody as Buffer;
  if (!rawBody) {
    console.error('[Webhook] rawBody not available — ensure express.json verify callback is configured');
    res.status(500).json({ error: 'Request body not available for verification' });
    return;
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = `sha256=${hmac.digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    console.warn('[Webhook] Invalid signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
};
