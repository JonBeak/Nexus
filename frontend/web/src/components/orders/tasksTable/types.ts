/**
 * Types for the Tasks Table feature
 * Phase 2.a - Part-level task management table
 */

import { ProductionRole } from './roleColors';
import { OrderStatus } from '../../../types/orders';

/**
 * Part with tasks data for the Tasks Table
 */
export interface PartWithTasks {
  partId: number;
  orderId: number;
  orderNumber: number;
  orderName: string;           // Job name (from order)
  customerName?: string | null; // Customer company name
  displayNumber: string;       // "1", "1a", "2", etc.
  productType: string;         // "Channel Letter"
  specsDisplayName?: string;   // Human-readable item name (e.g., "3\" Front Lit")
  scope?: string;              // Optional scope from part_scope
  dueDate: string | null;      // ISO date string
  hardDueTime: string | null;  // Time only (HH:MM:SS) for hard due dates - if set, highlight red
  orderStatus: OrderStatus;
  isParent: boolean;
  tasks: PartTask[];
}

/**
 * Individual task on a part
 */
export interface PartTask {
  taskId: number;
  taskName: string;
  taskKey?: string;  // Composite key: taskName or taskName|notes (for unique columns). Optional for backward compatibility.
  role: ProductionRole | string;
  completed: boolean;
  completedAt?: string;
  completedBy?: number;
  notes?: string;
}

/**
 * Filter state for Tasks Table
 */
export interface TasksTableFilters {
  status: OrderStatus | 'all';
  hideCompleted: boolean;
  search: string;
}

/**
 * Sort configuration
 */
export type TasksTableSortField = 'dueDate' | 'orderNumber' | 'displayNumber';
export type SortDirection = 'asc' | 'desc';

/**
 * API response for GET /api/orders/parts/with-tasks
 */
export interface PartsWithTasksResponse {
  success: boolean;
  data: PartWithTasks[];
  meta?: {
    total: number;
    taskColumns: string[];
  };
}

/**
 * Task column info for rendering
 */
export interface TaskColumnInfo {
  taskName: string;
  role: ProductionRole | string;
}
