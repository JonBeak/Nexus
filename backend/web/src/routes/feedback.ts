/**
 * Feedback Routes
 * RESTful API endpoints for feedback/error reporting system
 *
 * Created: 2026-01-16
 * Purpose: Handle feedback submissions, viewing, and management
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { feedbackController } from '../controllers/feedbackController';

const router = Router();

// All feedback routes require authentication
router.use(authenticateToken);

// =============================================================================
// Feedback CRUD (All authenticated users)
// =============================================================================

// Create new feedback - all authenticated users
// POST /api/feedback
router.post('/', (req, res) => feedbackController.createFeedback(req, res));

// List feedback - returns filtered by role (staff sees own, managers see all)
// GET /api/feedback
router.get('/', (req, res) => feedbackController.getFeedbackList(req, res));

// Get statistics - open count based on role
// GET /api/feedback/stats/open-count
// Note: Must be before /:feedbackId route to avoid conflict
router.get('/stats/open-count', (req, res) => feedbackController.getOpenCount(req, res));

// Get single feedback with responses
// GET /api/feedback/:feedbackId
router.get('/:feedbackId', (req, res) => feedbackController.getFeedbackById(req, res));

// Add response to feedback - ownership check in service
// POST /api/feedback/:feedbackId/responses
router.post('/:feedbackId/responses', (req, res) => feedbackController.addResponse(req, res));

// Get screenshot from Google Drive - ownership check in service
// GET /api/feedback/:feedbackId/screenshot
router.get('/:feedbackId/screenshot', (req, res) => feedbackController.getScreenshot(req, res));

// =============================================================================
// Manager-Only Operations
// =============================================================================

// Update feedback status - manager+ only
// PATCH /api/feedback/:feedbackId/status
router.patch(
  '/:feedbackId/status',
  requireRole('manager', 'owner'),
  (req, res) => feedbackController.updateStatus(req, res)
);

// Update feedback priority - manager+ only
// PATCH /api/feedback/:feedbackId/priority
router.patch(
  '/:feedbackId/priority',
  requireRole('manager', 'owner'),
  (req, res) => feedbackController.updatePriority(req, res)
);

export default router;
