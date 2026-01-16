/**
 * Kanban View Types
 * Types for the Orders Kanban Board
 */

import { Order, OrderStatus } from '../../../types/orders';

/**
 * Order with calculated fields for kanban display
 */
export interface KanbanOrder extends Order {
  work_days_left: number | null;
  progress_percent: number;
}

/**
 * Status column configuration
 */
export interface StatusColumn {
  status: OrderStatus;
  label: string;
  colorClass: string;
  orders: KanbanOrder[];
}

/**
 * Progress indicator color based on urgency
 */
export type ProgressColor = 'red' | 'yellow' | 'green';

/**
 * Get progress color based on work days remaining and completion status
 * Blue (green) = completed OR no urgency
 * Orange (yellow) = late (incomplete, < 3 days left)
 * Red = overdue (incomplete, past due)
 */
export const getProgressColor = (workDaysLeft: number | null, progressPercent?: number): ProgressColor => {
  // If job is complete, always show blue (green)
  if (progressPercent === 100) return 'green';

  // Only show urgency colors for incomplete jobs
  if (workDaysLeft === null) return 'green';
  if (workDaysLeft <= 0) return 'red';
  if (workDaysLeft <= 3) return 'yellow';
  return 'green';
};

/**
 * Progress bar color classes
 */
export const PROGRESS_BAR_COLORS: Record<ProgressColor, string> = {
  red: 'bg-red-500',
  yellow: 'bg-orange-500',
  green: 'bg-blue-500'
};

/**
 * Status column order for Kanban board
 * Defines the sequence of columns from left to right
 */
export const KANBAN_STATUS_ORDER: OrderStatus[] = [
  'job_details_setup',
  'pending_confirmation',
  'pending_production_files_creation',
  'pending_production_files_approval',
  'production_queue',
  'in_production',
  'overdue',
  'qc_packing',
  'shipping',
  'pick_up',
  'awaiting_payment',
  'completed',
  'cancelled'
];

/**
 * Column stacking configuration
 * Groups of statuses that should be stacked vertically
 */
export const KANBAN_STACKED_GROUPS: OrderStatus[][] = [
  ['job_details_setup', 'pending_confirmation'],
  ['pending_production_files_creation', 'pending_production_files_approval']
];

/**
 * Statuses hidden by default (can be toggled)
 */
export const KANBAN_HIDDEN_STATUSES: OrderStatus[] = [
  'completed',
  'cancelled'
];

/**
 * Active statuses (shown by default)
 */
export const KANBAN_DEFAULT_STATUSES: OrderStatus[] = KANBAN_STATUS_ORDER.filter(
  s => !KANBAN_HIDDEN_STATUSES.includes(s)
);

/**
 * Column header colors per status
 */
export const KANBAN_COLUMN_COLORS: Record<OrderStatus, { header: string; border: string; background?: string }> = {
  job_details_setup: { header: 'bg-amber-100', border: 'border-amber-300' },
  pending_confirmation: { header: 'bg-yellow-100', border: 'border-yellow-300' },
  pending_production_files_creation: { header: 'bg-orange-100', border: 'border-orange-300' },
  pending_production_files_approval: { header: 'bg-orange-100', border: 'border-orange-300' },
  production_queue: { header: 'bg-blue-100', border: 'border-blue-300' },
  in_production: { header: 'bg-indigo-100', border: 'border-indigo-300' },
  on_hold: { header: 'bg-red-100', border: 'border-red-300' },
  overdue: { header: 'bg-red-200', border: 'border-red-400' },
  qc_packing: { header: 'bg-purple-100', border: 'border-purple-300' },
  shipping: { header: 'bg-blue-100', border: 'border-blue-300' },
  pick_up: { header: 'bg-blue-100', border: 'border-blue-300' },
  awaiting_payment: { header: 'bg-green-100', border: 'border-green-300' },
  completed: { header: 'bg-green-200', border: 'border-green-400', background: 'bg-[var(--theme-header-bg)]' },
  cancelled: { header: 'bg-gray-300', border: 'border-gray-500', background: 'bg-[var(--theme-header-bg)]' }
};

/**
 * Statuses that should be collapsed by default (cards hidden)
 */
export const KANBAN_COLLAPSED_BY_DEFAULT: OrderStatus[] = [
  'cancelled'
];

/**
 * Painting column configuration
 * Special non-status column that shows "copies" of orders with incomplete painting tasks
 */
export const PAINTING_COLUMN_ID = 'painting';

/**
 * Statuses that can appear in the Painting column
 * Only orders in active production stages show in Painting column
 */
export const PAINTING_ELIGIBLE_STATUSES: OrderStatus[] = [
  'production_queue',
  'in_production',
  'overdue',
  'qc_packing'
];

/**
 * Painting column colors (purple to match painter role)
 */
export const PAINTING_COLUMN_COLORS = {
  header: 'bg-purple-100',
  border: 'border-purple-300'
};

/**
 * Props for KanbanColumn component
 */
export interface KanbanColumnProps {
  status: OrderStatus;
  orders: KanbanOrder[];
  onCardClick: (order: KanbanOrder) => void;
  onOrderUpdated: () => void;
  expanded?: boolean;
  onToggleExpanded: () => void;
  isHiddenStatus?: boolean;
  showingAll?: boolean;
  totalCount?: number;
  onToggleShowAll?: () => void;
  // Collapse functionality (hides all cards)
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  // Custom column support (for special columns like Painting)
  columnId?: string;
  columnLabel?: string;
  columnColors?: { header: string; border: string; background?: string };
  disableDrop?: boolean;
  cardsDisableDrag?: boolean;
  cardsShowPaintingBadge?: boolean;
}

/**
 * Props for KanbanCard component
 */
export interface KanbanCardProps {
  order: KanbanOrder;
  onClick: () => void;
  onOrderUpdated: () => void;
  onToggleExpanded: () => void;
  // Support for special columns
  disableDrag?: boolean;
  showPaintingBadge?: boolean;
}

