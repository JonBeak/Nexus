/**
 * Dashboard Panels API
 * API client for customizable Orders Dashboard panels
 *
 * Created: 2025-12-17
 */

import { api } from '../apiClient';
import {
  DashboardPanelDefinition,
  UserPanelWithDefinition,
  PanelWithData,
  PanelFilters,
  PanelOrderRow,
  CreatePanelRequest,
  UpdatePanelRequest,
  DashboardDataResponse
} from '../../types/dashboardPanel';

const BASE_URL = '/dashboard-panels';

// =============================================================================
// Panel Definition Management (Manager+)
// =============================================================================

/**
 * Get all panel definitions
 */
export async function getPanelDefinitions(includeInactive = false): Promise<DashboardPanelDefinition[]> {
  const params = includeInactive ? '?includeInactive=true' : '';
  const response = await api.get<DashboardPanelDefinition[]>(`${BASE_URL}/definitions${params}`);
  return response.data;
}

/**
 * Get single panel definition
 */
export async function getPanelDefinition(panelId: number): Promise<DashboardPanelDefinition> {
  const response = await api.get<DashboardPanelDefinition>(`${BASE_URL}/definitions/${panelId}`);
  return response.data;
}

/**
 * Create new panel definition
 */
export async function createPanelDefinition(data: CreatePanelRequest): Promise<number> {
  const response = await api.post<number>(`${BASE_URL}/definitions`, data);
  return response.data;
}

/**
 * Update panel definition
 */
export async function updatePanelDefinition(panelId: number, updates: UpdatePanelRequest): Promise<void> {
  await api.put(`${BASE_URL}/definitions/${panelId}`, updates);
}

/**
 * Delete (deactivate) panel definition
 */
export async function deletePanelDefinition(panelId: number): Promise<void> {
  await api.delete(`${BASE_URL}/definitions/${panelId}`);
}

/**
 * Reorder panel definitions
 */
export async function reorderPanelDefinitions(
  orders: Array<{ panel_id: number; display_order: number }>
): Promise<void> {
  await api.put(`${BASE_URL}/definitions/order`, { orders });
}

// =============================================================================
// User Panel Preferences
// =============================================================================

/**
 * Get user's selected panels
 */
export async function getUserPanels(): Promise<UserPanelWithDefinition[]> {
  const response = await api.get<UserPanelWithDefinition[]>(`${BASE_URL}/user/panels`);
  return response.data;
}

/**
 * Set user's panel selection
 */
export async function setUserPanels(panelIds: number[]): Promise<void> {
  await api.put(`${BASE_URL}/user/panels`, { panel_ids: panelIds });
}

/**
 * Reorder user's panels
 */
export async function reorderUserPanels(
  orders: Array<{ panel_id: number; display_order: number }>
): Promise<void> {
  await api.put(`${BASE_URL}/user/panels/order`, { orders });
}

/**
 * Toggle panel collapsed state
 */
export async function togglePanelCollapsed(panelId: number, collapsed: boolean): Promise<void> {
  await api.put(`${BASE_URL}/user/panels/${panelId}/collapse`, { collapsed });
}

// =============================================================================
// Dashboard Data
// =============================================================================

/**
 * Get user's complete dashboard data with orders
 */
export async function getDashboardData(): Promise<DashboardDataResponse> {
  const response = await api.get<DashboardDataResponse>(`${BASE_URL}/user/dashboard`);
  return response.data;
}

/**
 * Get orders for a specific panel
 */
export async function getPanelOrders(panelId: number, limit?: number): Promise<{ orders: PanelOrderRow[]; total: number }> {
  const params = limit ? `?limit=${limit}` : '';
  const response = await api.get<{ orders: PanelOrderRow[]; total: number }>(`${BASE_URL}/panels/${panelId}/orders${params}`);
  return response.data;
}

/**
 * Preview orders for custom filters (for filter builder)
 */
export async function previewPanelFilters(
  filters: PanelFilters,
  limit: number = 10
): Promise<{ orders: PanelOrderRow[]; total: number }> {
  const response = await api.post<{ orders: PanelOrderRow[]; total: number }>(`${BASE_URL}/preview`, { filters, limit });
  return response.data;
}

// =============================================================================
// Export as namespace
// =============================================================================

export const dashboardPanelsApi = {
  // Panel Definitions
  getPanelDefinitions,
  getPanelDefinition,
  createPanelDefinition,
  updatePanelDefinition,
  deletePanelDefinition,
  reorderPanelDefinitions,
  // User Preferences
  getUserPanels,
  setUserPanels,
  reorderUserPanels,
  togglePanelCollapsed,
  // Dashboard Data
  getDashboardData,
  getPanelOrders,
  previewPanelFilters
};
