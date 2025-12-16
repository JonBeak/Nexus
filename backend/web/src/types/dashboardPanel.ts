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
  | 'no_invoice'                  // qb_invoice_id IS NULL
  | 'needs_invoice'               // No invoice AND should have one based on deposit_required and status
  | 'open_balance'                // qb_invoice_id IS NOT NULL AND cached_balance > 0
  | 'fully_paid'                  // cached_balance = 0
  | 'deposit_required_not_paid';  // deposit_required = 1 AND cached_balance >= cached_invoice_total

/**
 * Shipping type filter options
 */
export type ShippingTypeFilter = 'shipping' | 'pick_up' | 'both';

/**
 * Due date range filter options
 */
export type DueDateRangeFilter =
  | 'overdue'       // due_date < CURDATE()
  | 'today'         // due_date = CURDATE()
  | 'this_week'     // due_date between now and end of week
  | 'next_7_days'   // due_date between now and +7 days
  | 'next_30_days'; // due_date between now and +30 days

/**
 * Panel action types for interactive buttons
 */
export type PanelActionType =
  | 'send_reminder'           // Send reminder email
  | 'mark_approved'           // Mark as approved by customer
  | 'approve_files';          // Approve production files

/**
 * Panel filter criteria (stored as JSON in database)
 */
export interface PanelFilters {
  statuses?: OrderStatus[];           // Include these statuses
  excludeStatuses?: OrderStatus[];    // Exclude these statuses
  invoiceStatus?: InvoiceStatusFilter;
  shippingType?: ShippingTypeFilter;
  dueDateRange?: DueDateRangeFilter;
  hasHardDueTime?: boolean;           // Orders with hard_due_date_time set
  sortByDaysInStatus?: boolean;       // Sort by days in current status (highest first)
  showDaysInStatus?: boolean;         // Display days in status column
  hideStatus?: boolean;               // Hide status column (for single-status panels)
  actions?: PanelActionType[];        // Action buttons to show
}

// =============================================================================
// Entity Types (Database Table Representations)
// =============================================================================

/**
 * Panel definition from dashboard_panel_definitions table
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
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
}

/**
 * User's panel preference from user_dashboard_panels table
 */
export interface UserDashboardPanel {
  id: number;
  user_id: number;
  panel_id: number;
  display_order: number;
  is_collapsed: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * User panel with joined panel definition data
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
  days_in_status?: number;           // Days since status last changed
  days_overdue?: number;             // Days past due date (for overdue orders)
}

/**
 * Panel with loaded order data for frontend
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
// Request Types (API Input DTOs)
// =============================================================================

/**
 * Create new panel definition
 */
export interface CreatePanelRequest {
  panel_name: string;
  panel_key: string;
  description?: string;
  icon_name?: string;
  color_class?: string;
  max_rows?: number;
  filters: PanelFilters;
}

/**
 * Update existing panel definition
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

/**
 * Reorder panel definitions
 */
export interface ReorderPanelsRequest {
  orders: Array<{ panel_id: number; display_order: number }>;
}

/**
 * Set user's panel selection
 */
export interface SetUserPanelsRequest {
  panel_ids: number[];
}

/**
 * Reorder user's panels
 */
export interface ReorderUserPanelsRequest {
  orders: Array<{ panel_id: number; display_order: number }>;
}

/**
 * Toggle panel collapsed state
 */
export interface TogglePanelCollapsedRequest {
  collapsed: boolean;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Dashboard data response with all user panels and orders
 */
export interface DashboardDataResponse {
  panels: PanelWithData[];
  available_panels: DashboardPanelDefinition[];
}
