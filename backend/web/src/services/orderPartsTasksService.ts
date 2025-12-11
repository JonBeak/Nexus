/**
 * Order Parts Tasks Service
 * Business logic for aggregating parts with tasks for the Tasks Table
 * Phase 2.a - Tasks Table Feature
 */

import {
  orderPartsTasksRepository,
  PartWithTaskRow,
  PartsWithTasksQueryParams
} from '../repositories/orderPartsTasksRepository';
import { OrderStatus, ProductionRole } from '../types/orders';
import { TASK_ORDER } from './taskGeneration/taskRules';

/**
 * Aggregated part with tasks for API response
 */
export interface PartWithTasksResponse {
  partId: number;
  orderId: number;
  orderNumber: number;
  orderName: string;
  customerName: string | null;
  displayNumber: string;
  productType: string;
  specsDisplayName: string | null;
  scope: string | null;
  dueDate: string | null;
  hardDueTime: string | null;  // Time only (HH:MM:SS) for hard due dates
  orderStatus: OrderStatus;
  isParent: boolean;
  tasks: {
    taskId: number;
    taskName: string;
    taskKey: string;  // Composite key: taskName or taskName|notes (for unique columns)
    role: ProductionRole | string;
    completed: boolean;
    completedAt: string | null;
    completedBy: number | null;
    notes: string | null;
  }[];
}

/**
 * API response structure
 */
export interface PartsWithTasksAPIResponse {
  data: PartWithTasksResponse[];
  meta: {
    total: number;
    taskColumns: string[];
  };
}

class OrderPartsTasksService {
  /**
   * Get parts with tasks, aggregated and ready for the Tasks Table
   */
  async getPartsWithTasks(params: PartsWithTasksQueryParams = {}): Promise<PartsWithTasksAPIResponse> {
    // Get flat rows from repository
    const rows = await orderPartsTasksRepository.getPartsWithTasks(params);

    // Aggregate rows by part_id
    const partsMap = new Map<number, PartWithTasksResponse>();
    const taskNamesSet = new Set<string>();

    for (const row of rows) {
      // Get or create part entry
      let part = partsMap.get(row.part_id);
      if (!part) {
        part = {
          partId: row.part_id,
          orderId: row.order_id,
          orderNumber: row.order_number,
          orderName: row.order_name,
          customerName: row.customer_name,
          displayNumber: row.display_number || '1',
          productType: row.product_type,
          specsDisplayName: row.specs_display_name,
          scope: row.part_scope,
          dueDate: row.due_date ? row.due_date.toISOString() : null,
          hardDueTime: row.hard_due_date_time || null,
          orderStatus: row.order_status,
          isParent: row.is_parent,
          tasks: []
        };
        partsMap.set(row.part_id, part);
      }

      // Add task if exists (LEFT JOIN may produce null task_id)
      if (row.task_id && row.task_name) {
        // Generate composite key: taskName|notes if notes exist, otherwise just taskName
        const taskKey = row.notes ? `${row.task_name}|${row.notes}` : row.task_name;
        part.tasks.push({
          taskId: row.task_id,
          taskName: row.task_name,
          taskKey: taskKey,
          role: row.assigned_role || 'manager',
          completed: Boolean(row.completed),
          completedAt: row.completed_at ? row.completed_at.toISOString() : null,
          completedBy: row.completed_by,
          notes: row.notes
        });
        taskNamesSet.add(taskKey);  // Use composite key for unique column tracking
      }
    }

    // Convert map to array
    let parts = Array.from(partsMap.values());

    // If hideCompleted, filter out parts where ALL tasks are completed
    if (params.hideCompleted) {
      parts = parts.filter(part => {
        if (part.tasks.length === 0) return true; // Keep parts with no tasks
        return part.tasks.some(task => !task.completed); // Keep if any task is pending
      });
    }

    // Get unique task columns, sorted by TASK_ORDER
    const taskColumns = this.sortTaskColumns(Array.from(taskNamesSet));

    return {
      data: parts,
      meta: {
        total: parts.length,
        taskColumns
      }
    };
  }

  /**
   * Sort task keys by their position in TASK_ORDER
   * Composite keys (taskName|notes) are grouped by base task name
   * Unknown tasks go to the end
   */
  private sortTaskColumns(taskKeys: string[]): string[] {
    return taskKeys.sort((a, b) => {
      // Extract base task name (before |) for TASK_ORDER lookup
      const nameA = a.split('|')[0];
      const nameB = b.split('|')[0];

      const indexA = TASK_ORDER.indexOf(nameA);
      const indexB = TASK_ORDER.indexOf(nameB);
      // Tasks not in TASK_ORDER get index 999
      const orderA = indexA >= 0 ? indexA : 999;
      const orderB = indexB >= 0 ? indexB : 999;

      // Primary: sort by TASK_ORDER position
      if (orderA !== orderB) return orderA - orderB;
      // Secondary: sort by full key (groups same-name tasks, sorts notes alphabetically)
      return a.localeCompare(b);
    });
  }
}

export const orderPartsTasksService = new OrderPartsTasksService();
