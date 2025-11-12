/**
 * QuickBooks OAuth and API Routes
 * Clean 3-layer architecture: Route → Controller → Service → Repository
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { quickbooksController } from '../controllers/quickbooksController';

const router = Router();

/**
 * Custom auth middleware that accepts token from query parameter
 * (needed for window.open() OAuth flow where headers cannot be set)
 */
const authenticateTokenFromQuery = async (req: Request, res: Response, next: Function) => {
  // Check query parameter first (for OAuth popup), then fall back to header
  const token = (req.query.token as string) ||
                (req.headers['authorization'] && (req.headers['authorization'] as string).split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    // Simple validation - just check token is valid
    (req as AuthRequest).user = { userId: decoded.userId } as any;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

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
