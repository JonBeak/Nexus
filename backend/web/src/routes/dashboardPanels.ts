/**
 * Dashboard Panel Routes
 * RESTful API endpoints for customizable Orders Dashboard panels
 *
 * Created: 2025-12-17
 */

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import * as dashboardPanelController from '../controllers/dashboardPanelController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// =============================================================================
// Panel Definition Management (Manager+)
// =============================================================================

// Get all panel definitions
router.get('/definitions',
  requireRole('manager', 'owner'),
  (req, res) => dashboardPanelController.getAllPanelDefinitions(req, res)
);

// Create new panel definition
router.post('/definitions',
  requireRole('manager', 'owner'),
  (req, res) => dashboardPanelController.createPanelDefinition(req, res)
);

// Reorder panel definitions
router.put('/definitions/order',
  requireRole('manager', 'owner'),
  (req, res) => dashboardPanelController.reorderPanelDefinitions(req, res)
);

// Get single panel definition
router.get('/definitions/:panelId',
  requireRole('manager', 'owner'),
  (req, res) => dashboardPanelController.getPanelDefinition(req, res)
);

// Update panel definition
router.put('/definitions/:panelId',
  requireRole('manager', 'owner'),
  (req, res) => dashboardPanelController.updatePanelDefinition(req, res)
);

// Delete (deactivate) panel definition
router.delete('/definitions/:panelId',
  requireRole('manager', 'owner'),
  (req, res) => dashboardPanelController.deletePanelDefinition(req, res)
);

// =============================================================================
// User Panel Preferences (Any Authenticated User)
// =============================================================================

// Get user's selected panels
router.get('/user/panels',
  (req, res) => dashboardPanelController.getUserPanels(req, res)
);

// Set user's panel selection
router.put('/user/panels',
  (req, res) => dashboardPanelController.setUserPanels(req, res)
);

// Reorder user's panels
router.put('/user/panels/order',
  (req, res) => dashboardPanelController.reorderUserPanels(req, res)
);

// Toggle panel collapsed state
router.put('/user/panels/:panelId/collapse',
  (req, res) => dashboardPanelController.togglePanelCollapsed(req, res)
);

// =============================================================================
// Dashboard Data (Any Authenticated User)
// =============================================================================

// Get user's complete dashboard data with orders
router.get('/user/dashboard',
  (req, res) => dashboardPanelController.getUserDashboardData(req, res)
);

// Get orders for a specific panel
router.get('/panels/:panelId/orders',
  (req, res) => dashboardPanelController.getPanelOrders(req, res)
);

// Preview orders for custom filters (for filter builder)
router.post('/preview',
  requireRole('manager', 'owner'),
  (req, res) => dashboardPanelController.previewPanelFilters(req, res)
);

export default router;
