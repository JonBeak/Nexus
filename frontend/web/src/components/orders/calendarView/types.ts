/**
 * Calendar View Types
 * Phase 2.b - Calendar View for Orders page
 */

import { Order, OrderStatus } from '../../../types/orders';

/**
 * Order with calculated fields for calendar display
 */
export interface CalendarOrder extends Order {
  work_days_left: number | null;
  progress_percent: number;
}

/**
 * Represents a single date column in the calendar
 */
export interface DateColumn {
  date: Date;
  dateKey: string;        // 'YYYY-MM-DD' format
  displayLabel: string;   // 'Today', 'Tomorrow', 'Dec 15'
  dayOfWeek: string;      // 'Mon', 'Tue', etc.
  isWeekend: boolean;
  isHoliday: boolean;
  isToday: boolean;
  orders: CalendarOrder[];
}

/**
 * Progress indicator color based on urgency
 */
export type ProgressColor = 'red' | 'yellow' | 'green';

/**
 * Default statuses to show in Calendar View
 */
export const CALENDAR_DEFAULT_STATUSES: OrderStatus[] = [
  'job_details_setup',
  'pending_confirmation',
  'pending_production_files_creation',
  'pending_production_files_approval',
  'production_queue',
  'in_production',
  'overdue',
  'qc_packing'
];
