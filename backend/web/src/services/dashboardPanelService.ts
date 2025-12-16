/**
 * Dashboard Panel Service
 * Business logic layer for customizable Orders Dashboard panels
 *
 * Created: 2025-12-17
 */

import * as dashboardPanelRepository from '../repositories/dashboardPanelRepository';
import { ServiceResult } from '../types/serviceResults';
import {
  DashboardPanelDefinition,
  UserPanelWithDefinition,
  PanelWithData,
  PanelFilters,
  CreatePanelRequest,
  UpdatePanelRequest,
  DashboardDataResponse
} from '../types/dashboardPanel';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate panel key from name
 */
function generatePanelKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Log audit entry (non-blocking)
 */
async function logAudit(
  tableName: string,
  recordId: number,
  action: 'create' | 'update' | 'delete' | 'restore',
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  summary: string,
  userId: number
): Promise<void> {
  try {
    await dashboardPanelRepository.logPanelAudit(
      tableName,
      recordId,
      action,
      oldValues,
      newValues,
      summary,
      userId
    );
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Don't throw - audit logging should not fail the main operation
  }
}

// =============================================================================
// Panel Definition Management (Manager+)
// =============================================================================

/**
 * Get all panel definitions
 */
export async function getPanelDefinitions(
  includeInactive = false
): Promise<ServiceResult<DashboardPanelDefinition[]>> {
  try {
    const panels = await dashboardPanelRepository.getAllPanelDefinitions(includeInactive);
    return { success: true, data: panels };
  } catch (error) {
    console.error('Error fetching panel definitions:', error);
    return { success: false, error: 'Failed to fetch panel definitions', code: 'FETCH_ERROR' };
  }
}

/**
 * Get single panel definition by ID
 */
export async function getPanelDefinitionById(
  panelId: number
): Promise<ServiceResult<DashboardPanelDefinition>> {
  try {
    const panel = await dashboardPanelRepository.getPanelDefinitionById(panelId);
    if (!panel) {
      return { success: false, error: 'Panel not found', code: 'NOT_FOUND' };
    }
    return { success: true, data: panel };
  } catch (error) {
    console.error('Error fetching panel definition:', error);
    return { success: false, error: 'Failed to fetch panel definition', code: 'FETCH_ERROR' };
  }
}

/**
 * Create new panel definition
 */
export async function createPanelDefinition(
  data: CreatePanelRequest,
  userId: number
): Promise<ServiceResult<number>> {
  try {
    // Validate required fields
    if (!data.panel_name?.trim()) {
      return { success: false, error: 'Panel name is required', code: 'VALIDATION_ERROR' };
    }
    if (!data.filters || Object.keys(data.filters).length === 0) {
      return { success: false, error: 'At least one filter is required', code: 'VALIDATION_ERROR' };
    }

    // Generate key if not provided
    const panelKey = data.panel_key || generatePanelKey(data.panel_name);

    // Check for duplicate key
    const existingPanel = await dashboardPanelRepository.getPanelDefinitionByKey(panelKey);
    if (existingPanel) {
      return { success: false, error: 'A panel with this key already exists', code: 'DUPLICATE_KEY' };
    }

    const panelId = await dashboardPanelRepository.createPanelDefinition(
      { ...data, panel_key: panelKey },
      userId
    );

    await logAudit(
      'dashboard_panel_definitions',
      panelId,
      'create',
      null,
      { panel_name: data.panel_name, panel_key: panelKey, filters: data.filters },
      `Created panel "${data.panel_name}"`,
      userId
    );

    return { success: true, data: panelId };
  } catch (error) {
    console.error('Error creating panel definition:', error);
    return { success: false, error: 'Failed to create panel definition', code: 'CREATE_ERROR' };
  }
}

/**
 * Update panel definition
 */
export async function updatePanelDefinition(
  panelId: number,
  updates: UpdatePanelRequest,
  userId: number
): Promise<ServiceResult<void>> {
  try {
    const existing = await dashboardPanelRepository.getPanelDefinitionById(panelId);
    if (!existing) {
      return { success: false, error: 'Panel not found', code: 'NOT_FOUND' };
    }

    // Don't allow deactivating system panels
    if (existing.is_system && updates.is_active === false) {
      return { success: false, error: 'Cannot deactivate system panels', code: 'PROTECTED_PANEL' };
    }

    await dashboardPanelRepository.updatePanelDefinition(panelId, updates);

    await logAudit(
      'dashboard_panel_definitions',
      panelId,
      'update',
      { panel_name: existing.panel_name, filters: existing.filters },
      updates as Record<string, unknown>,
      `Updated panel "${existing.panel_name}"`,
      userId
    );

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error updating panel definition:', error);
    return { success: false, error: 'Failed to update panel definition', code: 'UPDATE_ERROR' };
  }
}

/**
 * Deactivate panel definition (soft delete)
 */
export async function deactivatePanelDefinition(
  panelId: number,
  userId: number
): Promise<ServiceResult<void>> {
  try {
    const existing = await dashboardPanelRepository.getPanelDefinitionById(panelId);
    if (!existing) {
      return { success: false, error: 'Panel not found', code: 'NOT_FOUND' };
    }

    if (existing.is_system) {
      return { success: false, error: 'Cannot delete system panels', code: 'PROTECTED_PANEL' };
    }

    await dashboardPanelRepository.deactivatePanelDefinition(panelId);

    await logAudit(
      'dashboard_panel_definitions',
      panelId,
      'delete',
      { panel_name: existing.panel_name, is_active: true },
      { is_active: false },
      `Deactivated panel "${existing.panel_name}"`,
      userId
    );

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deactivating panel definition:', error);
    return { success: false, error: 'Failed to delete panel definition', code: 'DELETE_ERROR' };
  }
}

/**
 * Reorder panel definitions
 */
export async function reorderPanelDefinitions(
  orders: Array<{ panel_id: number; display_order: number }>,
  userId: number
): Promise<ServiceResult<void>> {
  try {
    await dashboardPanelRepository.reorderPanelDefinitions(orders);

    await logAudit(
      'dashboard_panel_definitions',
      0,
      'update',
      null,
      { orders },
      'Reordered panel definitions',
      userId
    );

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error reordering panel definitions:', error);
    return { success: false, error: 'Failed to reorder panels', code: 'REORDER_ERROR' };
  }
}

// =============================================================================
// User Panel Preferences
// =============================================================================

/**
 * Get user's selected panels (just the preferences, no order data)
 */
export async function getUserPanels(
  userId: number
): Promise<ServiceResult<UserPanelWithDefinition[]>> {
  try {
    const panels = await dashboardPanelRepository.getUserPanels(userId);
    return { success: true, data: panels };
  } catch (error) {
    console.error('Error fetching user panels:', error);
    return { success: false, error: 'Failed to fetch user panels', code: 'FETCH_ERROR' };
  }
}

/**
 * Set user's panel selection (replaces existing)
 */
export async function setUserPanels(
  userId: number,
  panelIds: number[]
): Promise<ServiceResult<void>> {
  try {
    // Validate that all panel IDs exist and are active
    const allPanels = await dashboardPanelRepository.getAllPanelDefinitions(false);
    const validIds = new Set(allPanels.map(p => p.panel_id));

    const invalidIds = panelIds.filter(id => !validIds.has(id));
    if (invalidIds.length > 0) {
      return {
        success: false,
        error: `Invalid panel IDs: ${invalidIds.join(', ')}`,
        code: 'INVALID_PANEL_IDS'
      };
    }

    await dashboardPanelRepository.setUserPanels(userId, panelIds);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error setting user panels:', error);
    return { success: false, error: 'Failed to set user panels', code: 'UPDATE_ERROR' };
  }
}

/**
 * Reorder user's panels
 */
export async function reorderUserPanels(
  userId: number,
  orders: Array<{ panel_id: number; display_order: number }>
): Promise<ServiceResult<void>> {
  try {
    await dashboardPanelRepository.reorderUserPanels(userId, orders);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error reordering user panels:', error);
    return { success: false, error: 'Failed to reorder panels', code: 'REORDER_ERROR' };
  }
}

/**
 * Toggle panel collapsed state
 */
export async function togglePanelCollapsed(
  userId: number,
  panelId: number,
  collapsed: boolean
): Promise<ServiceResult<void>> {
  try {
    await dashboardPanelRepository.togglePanelCollapsed(userId, panelId, collapsed);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error toggling panel collapsed:', error);
    return { success: false, error: 'Failed to toggle panel', code: 'UPDATE_ERROR' };
  }
}

// =============================================================================
// Dashboard Data Fetching
// =============================================================================

/**
 * Get user's complete dashboard data with orders for each panel
 */
export async function getUserDashboardData(
  userId: number
): Promise<ServiceResult<DashboardDataResponse>> {
  try {
    // Get user's selected panels
    const userPanels = await dashboardPanelRepository.getUserPanels(userId);

    // Get all available panels for the selection modal
    const availablePanels = await dashboardPanelRepository.getAllPanelDefinitions(false);

    // If user has no panels configured, return defaults (first 4)
    let panelsToLoad = userPanels;
    if (panelsToLoad.length === 0) {
      // Auto-select first 4 panels as defaults for new users
      const defaultPanelIds = availablePanels.slice(0, 4).map(p => p.panel_id);
      await dashboardPanelRepository.setUserPanels(userId, defaultPanelIds);
      panelsToLoad = await dashboardPanelRepository.getUserPanels(userId);
    }

    // Load orders for each panel in parallel
    const panelDataPromises = panelsToLoad.map(async (panel): Promise<PanelWithData> => {
      const { orders, total } = await dashboardPanelRepository.getOrdersForPanel(
        panel.filters,
        panel.max_rows
      );

      return {
        panel_id: panel.panel_id,
        panel_key: panel.panel_key,
        panel_name: panel.panel_name,
        description: panel.description,
        icon_name: panel.icon_name,
        color_class: panel.color_class,
        is_collapsed: panel.is_collapsed,
        max_rows: panel.max_rows,
        filters: panel.filters,
        orders,
        total_count: total
      };
    });

    const panels = await Promise.all(panelDataPromises);

    return {
      success: true,
      data: {
        panels,
        available_panels: availablePanels
      }
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return { success: false, error: 'Failed to fetch dashboard data', code: 'FETCH_ERROR' };
  }
}

/**
 * Get orders for a specific panel (for "View All" or refresh)
 */
export async function getPanelOrders(
  panelId: number,
  limit?: number
): Promise<ServiceResult<{ orders: any[]; total: number }>> {
  try {
    const panel = await dashboardPanelRepository.getPanelDefinitionById(panelId);
    if (!panel) {
      return { success: false, error: 'Panel not found', code: 'NOT_FOUND' };
    }

    const result = await dashboardPanelRepository.getOrdersForPanel(
      panel.filters,
      limit || panel.max_rows
    );

    return { success: true, data: result };
  } catch (error) {
    console.error('Error fetching panel orders:', error);
    return { success: false, error: 'Failed to fetch panel orders', code: 'FETCH_ERROR' };
  }
}

/**
 * Preview orders for custom filters (used by filter builder)
 */
export async function previewPanelFilters(
  filters: PanelFilters,
  limit: number = 10
): Promise<ServiceResult<{ orders: any[]; total: number }>> {
  try {
    const result = await dashboardPanelRepository.getOrdersForPanel(filters, limit);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error previewing panel filters:', error);
    return { success: false, error: 'Failed to preview filters', code: 'PREVIEW_ERROR' };
  }
}
