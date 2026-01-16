/**
 * Dashboard Panel Types
 * TypeScript interfaces for customizable Orders Dashboard panels
 *
 * Created: 2025-12-17
 */

import { OrderStatus } from './orders';

// =============================================================================
// Filter Types
// =============================================================================

/**
 * Invoice status filter options
 */
export type InvoiceStatusFilter =
  | 'no_invoice'
  | 'open_balance'
  | 'fully_paid'
  | 'deposit_required_not_paid';

/**
 * Shipping type filter options
 */
export type ShippingTypeFilter = 'shipping' | 'pick_up' | 'both';

/**
 * Due date range filter options
 */
export type DueDateRangeFilter =
  | 'overdue'
  | 'today'
  | 'this_week'
  | 'next_7_days'
  | 'next_30_days';

/**
 * Panel action types for interactive buttons
 */
export type PanelActionType =
  | 'send_reminder'
  | 'mark_approved'
  | 'approve_files';

/**
 * Panel filter criteria
 */
export interface PanelFilters {
  statuses?: OrderStatus[];
  excludeStatuses?: OrderStatus[];
  excludeStatusesWhenSent?: OrderStatus[]; // Exclude these statuses only when invoice_sent_at IS NOT NULL
  invoiceStatus?: InvoiceStatusFilter;
  shippingType?: ShippingTypeFilter;
  dueDateRange?: DueDateRangeFilter;
  hasHardDueTime?: boolean;
  sortByDaysInStatus?: boolean;
  showDaysInStatus?: boolean;
  hideStatus?: boolean;
  actions?: PanelActionType[];
}

// =============================================================================
// Entity Types
// =============================================================================

/**
 * Panel definition from database
 */
export interface DashboardPanelDefinition {
  panel_id: number;
  panel_name: string;
  panel_key: string;
  description: string | null;
  icon_name: string;
  color_class: string;
  display_order: number;
  max_rows: number;
  filters: PanelFilters;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
}

/**
 * User's panel preference
 */
export interface UserDashboardPanel {
  id: number;
  user_id: number;
  panel_id: number;
  display_order: number;
  is_collapsed: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User panel with joined definition data
 */
export interface UserPanelWithDefinition extends UserDashboardPanel {
  panel_name: string;
  panel_key: string;
  description: string | null;
  icon_name: string;
  color_class: string;
  max_rows: number;
  filters: PanelFilters;
  is_system: boolean;
}

// =============================================================================
// Order Display Types
// =============================================================================

/**
 * Compact order data for panel display
 */
export interface PanelOrderRow {
  order_id: number;
  order_number: number;
  order_name: string;
  customer_name: string;
  due_date: string | null;
  hard_due_date_time: string | null;
  status: string;
  has_invoice: boolean;
  invoice_status: InvoiceStatusFilter | null;
  shipping_required: boolean;
  days_in_status?: number;
  days_overdue?: number;
}

/**
 * Panel with loaded order data
 */
export interface PanelWithData {
  panel_id: number;
  panel_key: string;
  panel_name: string;
  description: string | null;
  icon_name: string;
  color_class: string;
  is_collapsed: boolean;
  max_rows: number;
  filters: PanelFilters;
  orders: PanelOrderRow[];
  total_count: number;
}

// =============================================================================
// Request Types
// =============================================================================

/**
 * Create new panel definition
 */
export interface CreatePanelRequest {
  panel_name: string;
  panel_key?: string;
  description?: string;
  icon_name?: string;
  color_class?: string;
  max_rows?: number;
  filters: PanelFilters;
}

/**
 * Update panel definition
 */
export interface UpdatePanelRequest {
  panel_name?: string;
  description?: string;
  icon_name?: string;
  color_class?: string;
  display_order?: number;
  max_rows?: number;
  filters?: PanelFilters;
  is_active?: boolean;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Dashboard data response
 */
export interface DashboardDataResponse {
  panels: PanelWithData[];
  available_panels: DashboardPanelDefinition[];
}
