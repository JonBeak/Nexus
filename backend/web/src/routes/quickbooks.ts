// File Clean up Finished: 2025-11-15
// Changes:
// - Extracted inline authenticateTokenFromQuery middleware to /middleware/auth.ts
// - Removed 26 lines of duplicate auth logic (dynamic require, JWT verification)
// - Improved imports: now imports both auth middlewares from proper location
// - Better separation of concerns: routes file only contains routing logic
// - Reduced from 126 → 100 lines (20.6% reduction)
/**
 * QuickBooks OAuth and API Routes
 * Clean 3-layer architecture: Route → Controller → Service → Repository
 */

import { Router } from 'express';
import { authenticateToken, authenticateTokenFromQuery } from '../middleware/auth';
import { quickbooksController } from '../controllers/quickbooksController';

const router = Router();

// =============================================
// OAUTH FLOW ROUTES
// =============================================

/**
 * GET /api/quickbooks/config-status
 * Check if QuickBooks credentials are configured
 */
router.get('/config-status', authenticateToken, (req, res) =>
  quickbooksController.checkConfigStatus(req, res)
);

/**
 * GET /api/quickbooks/start-auth
 * Initiate OAuth flow - redirects to QuickBooks authorization page
 */
router.get('/start-auth', authenticateTokenFromQuery, (req, res) =>
  quickbooksController.startAuth(req, res)
);

/**
 * GET /api/quickbooks/callback
 * OAuth callback - exchanges code for tokens
 */
router.get('/callback', (req, res) =>
  quickbooksController.handleCallback(req, res)
);

/**
 * POST /api/quickbooks/disconnect
 * Disconnect from QuickBooks (delete tokens)
 */
router.post('/disconnect', authenticateToken, (req, res) =>
  quickbooksController.disconnect(req, res)
);

// =============================================
// CONNECTION & DATA ROUTES
// =============================================

/**
 * GET /api/quickbooks/status
 * Check connection status
 */
router.get('/status', authenticateToken, (req, res) =>
  quickbooksController.getStatus(req, res)
);

/**
 * GET /api/quickbooks/items
 * Fetch all QuickBooks items from database
 * Used for dropdown population in Custom product forms
 */
router.get('/items', authenticateToken, (req, res) =>
  quickbooksController.getItems(req, res)
);

/**
 * POST /api/quickbooks/create-estimate
 * Create estimate in QuickBooks from Nexus estimate data
 * IMPORTANT: Only works with DRAFT estimates - finalizes them after successful creation
 * Debug mode is owner-only (403 for Manager and below)
 */
router.post('/create-estimate', authenticateToken, (req, res) =>
  quickbooksController.createEstimate(req, res)
);

// =============================================
// DEBUG/TEST ROUTES
// =============================================

/**
 * GET /api/quickbooks/test-logging
 * Test endpoint to verify logging is working
 */
router.get('/test-logging', authenticateToken, (req, res) =>
  quickbooksController.testLogging(req, res)
);

/**
 * GET /api/quickbooks/estimate/:id
 * Fetch an estimate from QuickBooks to analyze its structure
 */
router.get('/estimate/:id', authenticateToken, (req, res) =>
  quickbooksController.getEstimate(req, res)
);

export default router;
