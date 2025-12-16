/**
 * Dashboard Panel Controller
 * HTTP request handling for customizable Orders Dashboard panels
 *
 * Created: 2025-12-17
 */

import { Request, Response } from 'express';
import * as dashboardPanelService from '../services/dashboardPanelService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../utils/controllerHelpers';

// Extended request type with user
interface AuthenticatedRequest extends Request {
  user?: {
    user_id: number;
    role: string;
  };
}

// =============================================================================
// Panel Definition Management (Manager+)
// =============================================================================

/**
 * Get all panel definitions
 * GET /definitions
 */
export async function getAllPanelDefinitions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const includeInactive = req.query.includeInactive === 'true';
  const result = await dashboardPanelService.getPanelDefinitions(includeInactive);
  handleServiceResult(res, result);
}

/**
 * Get single panel definition
 * GET /definitions/:panelId
 */
export async function getPanelDefinition(req: AuthenticatedRequest, res: Response): Promise<void> {
  const panelId = parseIntParam(req.params.panelId, 'Panel ID');
  if (panelId === null) {
    return sendErrorResponse(res, 'Invalid panel ID', 'VALIDATION_ERROR');
  }

  const result = await dashboardPanelService.getPanelDefinitionById(panelId);
  handleServiceResult(res, result);
}

/**
 * Create new panel definition
 * POST /definitions
 */
export async function createPanelDefinition(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
  }

  const { panel_name, panel_key, description, icon_name, color_class, max_rows, filters } = req.body;

  if (!panel_name) {
    return sendErrorResponse(res, 'panel_name is required', 'VALIDATION_ERROR');
  }
  if (!filters || typeof filters !== 'object') {
    return sendErrorResponse(res, 'filters object is required', 'VALIDATION_ERROR');
  }

  const result = await dashboardPanelService.createPanelDefinition(
    { panel_name, panel_key, description, icon_name, color_class, max_rows, filters },
    userId
  );
  handleServiceResult(res, result, { successStatus: 201 });
}

/**
 * Update panel definition
 * PUT /definitions/:panelId
 */
export async function updatePanelDefinition(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
  }

  const panelId = parseIntParam(req.params.panelId, 'Panel ID');
  if (panelId === null) {
    return sendErrorResponse(res, 'Invalid panel ID', 'VALIDATION_ERROR');
  }

  const result = await dashboardPanelService.updatePanelDefinition(panelId, req.body, userId);
  handleServiceResult(res, result);
}

/**
 * Delete (deactivate) panel definition
 * DELETE /definitions/:panelId
 */
export async function deletePanelDefinition(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
  }

  const panelId = parseIntParam(req.params.panelId, 'Panel ID');
  if (panelId === null) {
    return sendErrorResponse(res, 'Invalid panel ID', 'VALIDATION_ERROR');
  }

  const result = await dashboardPanelService.deactivatePanelDefinition(panelId, userId);
  handleServiceResult(res, result);
}

/**
 * Reorder panel definitions
 * PUT /definitions/order
 */
export async function reorderPanelDefinitions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
  }

  const { orders } = req.body;
  if (!Array.isArray(orders)) {
    return sendErrorResponse(res, 'orders array is required', 'VALIDATION_ERROR');
  }

  const result = await dashboardPanelService.reorderPanelDefinitions(orders, userId);
  handleServiceResult(res, result);
}

// =============================================================================
// User Panel Preferences (Any Authenticated User)
// =============================================================================

/**
 * Get user's selected panels
 * GET /user/panels
 */
export async function getUserPanels(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
  }

  const result = await dashboardPanelService.getUserPanels(userId);
  handleServiceResult(res, result);
}

/**
 * Set user's panel selection
 * PUT /user/panels
 */
export async function setUserPanels(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
  }

  const { panel_ids } = req.body;
  if (!Array.isArray(panel_ids)) {
    return sendErrorResponse(res, 'panel_ids array is required', 'VALIDATION_ERROR');
  }

  const result = await dashboardPanelService.setUserPanels(userId, panel_ids);
  handleServiceResult(res, result);
}

/**
 * Reorder user's panels
 * PUT /user/panels/order
 */
export async function reorderUserPanels(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
  }

  const { orders } = req.body;
  if (!Array.isArray(orders)) {
    return sendErrorResponse(res, 'orders array is required', 'VALIDATION_ERROR');
  }

  const result = await dashboardPanelService.reorderUserPanels(userId, orders);
  handleServiceResult(res, result);
}

/**
 * Toggle panel collapsed state
 * PUT /user/panels/:panelId/collapse
 */
export async function togglePanelCollapsed(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
  }

  const panelId = parseIntParam(req.params.panelId, 'Panel ID');
  if (panelId === null) {
    return sendErrorResponse(res, 'Invalid panel ID', 'VALIDATION_ERROR');
  }

  const { collapsed } = req.body;
  if (typeof collapsed !== 'boolean') {
    return sendErrorResponse(res, 'collapsed boolean is required', 'VALIDATION_ERROR');
  }

  const result = await dashboardPanelService.togglePanelCollapsed(userId, panelId, collapsed);
  handleServiceResult(res, result);
}

// =============================================================================
// Dashboard Data (Any Authenticated User)
// =============================================================================

/**
 * Get user's complete dashboard data with orders
 * GET /user/dashboard
 */
export async function getUserDashboardData(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendErrorResponse(res, 'Unauthorized', 'UNAUTHORIZED');
  }

  const result = await dashboardPanelService.getUserDashboardData(userId);
  handleServiceResult(res, result);
}

/**
 * Get orders for a specific panel
 * GET /panels/:panelId/orders
 */
export async function getPanelOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const panelId = parseIntParam(req.params.panelId, 'Panel ID');
  if (panelId === null) {
    return sendErrorResponse(res, 'Invalid panel ID', 'VALIDATION_ERROR');
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const result = await dashboardPanelService.getPanelOrders(panelId, limit);
  handleServiceResult(res, result);
}

/**
 * Preview orders for custom filters
 * POST /preview
 */
export async function previewPanelFilters(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { filters, limit } = req.body;

  if (!filters || typeof filters !== 'object') {
    return sendErrorResponse(res, 'filters object is required', 'VALIDATION_ERROR');
  }

  const result = await dashboardPanelService.previewPanelFilters(filters, limit || 10);
  handleServiceResult(res, result);
}
