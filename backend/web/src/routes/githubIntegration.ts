/**
 * GitHub Integration Routes
 * API endpoints for GitHub/Claude Code integration
 *
 * Created: 2026-02-08
 * Purpose: Handle feedback-to-GitHub bridging, Claude assignment, and status tracking
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { githubIntegrationController } from '../controllers/githubIntegrationController';

const router = Router();

// All routes require authentication + manager role
router.use(authenticateToken);
router.use(requireRole('manager', 'owner'));

// Rate limit status - must be before :feedbackId routes
// GET /api/github-integration/rate-limit
router.get('/rate-limit', (req, res) => githubIntegrationController.getRateLimitStatus(req, res));

// Assign feedback to Claude (creates GitHub Issue with @claude)
// POST /api/github-integration/:feedbackId/assign
router.post('/:feedbackId/assign', (req, res) => githubIntegrationController.assignToClaude(req, res));

// Post comment on linked GitHub Issue
// POST /api/github-integration/:feedbackId/comment
router.post('/:feedbackId/comment', (req, res) => githubIntegrationController.postComment(req, res));

// Get pipeline status for a feedback ticket
// GET /api/github-integration/:feedbackId/status
router.get('/:feedbackId/status', (req, res) => githubIntegrationController.getPipelineStatus(req, res));

export default router;
