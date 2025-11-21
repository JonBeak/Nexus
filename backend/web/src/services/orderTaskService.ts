// File Clean up Finished: 2025-11-21
// Changes:
//   - Migrated 8 task methods from orderService.ts (architectural consolidation)
//   - Methods moved: updateTaskCompletion, getOrderTasks, getTasksByPart, getTasksByRole,
//                    batchUpdateTasks, addTaskToOrderPart, removeTask, getTaskTemplates
//   - Service now handles ALL task-related operations (generation + CRUD)
//   - Phase 3 plan: Migrate hard-coded templates to database-driven system

/**
 * Order Task Service
 * Business Logic for Task Generation and Management
 *
 * Handles:
 * - Task CRUD operations (create, read, update, delete)
 * - Task templates and auto-generation
 * - Tasks by role/part grouping
 * - Batch task updates
 *
 * Phase 1: Hard-coded task templates
 * Phase 3: Will migrate to database-driven templates
 */

import { PoolConnection } from 'mysql2/promise';
import { orderPartRepository } from '../repositories/orderPartRepository';
import { orderRepository } from '../repositories/orderRepository';
import { OrderPart, TaskTemplate, OrderTask } from '../types/orders';

/**
 * Production role types
 */
type ProductionRole = 'designer' | 'vinyl_cnc' | 'painting' | 'cut_bend' | 'leds' | 'packing';

/**
 * Task name to role mapping
 */
const TASK_ROLE_MAPPING: Record<string, ProductionRole> = {
  'design approval': 'designer',
  'cut returns': 'cut_bend',
  'cut faces': 'cut_bend',
  'weld returns': 'cut_bend',
  'cut material': 'cut_bend',
  'route/finish edges': 'cut_bend',
  'route edges if needed': 'cut_bend',
  'drill holes if needed': 'cut_bend',
  'cut acm to size': 'cut_bend',
  'cut substrate to size': 'cut_bend',
  'cut vinyl': 'vinyl_cnc',
  'weed vinyl': 'vinyl_cnc',
  'apply transfer tape': 'vinyl_cnc',
  'apply vinyl to faces': 'vinyl_cnc',
  'apply vinyl graphics': 'vinyl_cnc',
  'paint/finish': 'painting',
  'install led modules': 'leds',
  'wire power supply': 'leds',
  'quality check': 'packing',
  'package for shipping': 'packing'
};

/**
 * Hard-coded task templates for Phase 1
 * Phase 3 will migrate these to database
 */
const TASK_TEMPLATES: Record<string, string[]> = {
  // Channel Letters
  channel_letters: [
    'Design approval',
    'Cut returns',
    'Cut faces',
    'Weld returns',
    'Apply vinyl to faces',
    'Install LED modules',
    'Wire power supply',
    'Quality check',
    'Package for shipping'
  ],

  // Dimensional Letters
  dimensional_letters: [
    'Design approval',
    'Cut material',
    'Route/finish edges',
    'Paint/finish',
    'Quality check',
    'Package for shipping'
  ],

  // ACM Panels
  acm_panel: [
    'Design approval',
    'Cut ACM to size',
    'Apply vinyl graphics',
    'Quality check',
    'Package for shipping'
  ],

  // Vinyl Graphics
  vinyl: [
    'Design approval',
    'Cut vinyl',
    'Weed vinyl',
    'Apply transfer tape',
    'Quality check',
    'Package for shipping'
  ],

  // Substrate Cut
  substrate_cut: [
    'Design approval',
    'Cut substrate to size',
    'Route edges if needed',
    'Drill holes if needed',
    'Quality check',
    'Package for shipping'
  ],

  // Default template for unknown product types
  default: [
    'Design approval',
    'Production',
    'Quality check',
    'Package for shipping'
  ]
};

export class OrderTaskService {

  /**
   * Get role for task based on task name
   */
  private getTaskRole(taskName: string): ProductionRole | null {
    const normalized = taskName.toLowerCase();
    return TASK_ROLE_MAPPING[normalized] || null;
  }

  /**
   * Generate tasks for an order based on parts
   */
  async generateTasksForOrder(
    orderId: number,
    parts: OrderPart[],
    connection?: PoolConnection
  ): Promise<void> {
    for (const part of parts) {
      const template = this.getTaskTemplate(part.product_type_id);

      for (let i = 0; i < template.length; i++) {
        const taskName = template[i];
        const assignedRole = this.getTaskRole(taskName);

        await orderPartRepository.createOrderTask(
          {
            order_id: orderId,
            part_id: part.part_id,
            task_name: taskName,
            assigned_role: assignedRole
          },
          connection
        );
      }
    }
  }

  /**
   * Get task template for product type
   */
  private getTaskTemplate(productTypeId: string): string[] {
    // Normalize product type ID for comparison
    const normalized = productTypeId.toLowerCase().replace(/[^a-z]/g, '');

    // Check for matching template
    for (const [key, template] of Object.entries(TASK_TEMPLATES)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');

      if (normalized.includes(normalizedKey)) {
        return template;
      }
    }

    // Return default template if no match
    return TASK_TEMPLATES.default;
  }

  /**
   * Get all available task templates (for debugging/documentation)
   */
  getAvailableTemplates(): Record<string, string[]> {
    return { ...TASK_TEMPLATES };
  }

  /**
   * Get task template by product type ID (for preview)
   */
  getTemplateForProductType(productTypeId: string): TaskTemplate[] {
    const tasks = this.getTaskTemplate(productTypeId);
    return tasks.map((task_name) => ({
      task_name
    }));
  }

  // =====================================================
  // TASK CRUD OPERATIONS (Migrated from orderService.ts - 2025-11-21)
  // =====================================================

  /**
   * Update task completion status
   */
  async updateTaskCompletion(
    taskId: number,
    completed: boolean,
    userId: number
  ): Promise<void> {
    await orderPartRepository.updateTaskCompletion(taskId, completed, userId);
  }

  /**
   * Get all tasks for an order (flat list)
   */
  async getOrderTasks(orderId: number): Promise<OrderTask[]> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    return await orderPartRepository.getOrderTasks(orderId);
  }

  /**
   * Get tasks grouped by part with part details
   */
  async getTasksByPart(orderId: number): Promise<any[]> {
    // Validate order exists
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    const parts = await orderPartRepository.getOrderParts(orderId);
    const tasks = await orderPartRepository.getOrderTasks(orderId);

    // Group tasks by part
    return parts.map(part => {
      const partTasks = tasks.filter(t => t.part_id === part.part_id);
      const completedCount = partTasks.filter(t => t.completed).length;

      return {
        part_id: part.part_id,
        part_number: part.part_number,
        product_type: part.product_type,
        product_type_id: part.product_type_id,
        quantity: part.quantity,
        specifications: part.specifications,
        production_notes: part.production_notes,
        total_tasks: partTasks.length,
        completed_tasks: completedCount,
        progress_percent: partTasks.length > 0
          ? Math.round((completedCount / partTasks.length) * 100)
          : 0,
        tasks: partTasks
      };
    });
  }

  /**
   * Get all tasks grouped by production role
   */
  async getTasksByRole(includeCompleted: boolean = false, hoursBack: number = 24) {
    const roles = ['designer', 'vinyl_cnc', 'painting', 'cut_bend', 'leds', 'packing'];
    const result: any = {};

    for (const role of roles) {
      const tasks = await orderPartRepository.getTasksByRole(role, includeCompleted, hoursBack);
      result[role] = tasks;
    }

    return result;
  }

  /**
   * Batch update tasks (start/complete)
   */
  async batchUpdateTasks(updates: any[], userId: number) {
    for (const update of updates) {
      const { task_id, started, completed } = update;

      if (started !== undefined) {
        await orderPartRepository.updateTaskStarted(task_id, started, userId);
      }

      if (completed !== undefined) {
        await orderPartRepository.updateTaskCompletion(task_id, completed, userId);
      }
    }
  }

  /**
   * Add a task to an order part
   */
  async addTaskToOrderPart(
    orderId: number,
    partId: number,
    taskName: string,
    assignedRole?: 'designer' | 'vinyl_cnc' | 'painting' | 'cut_bend' | 'leds' | 'packing' | null
  ): Promise<number> {
    return await orderPartRepository.createOrderTask({
      order_id: orderId,
      part_id: partId,
      task_name: taskName,
      assigned_role: assignedRole || null
    });
  }

  /**
   * Remove a task by ID
   */
  async removeTask(taskId: number): Promise<void> {
    await orderPartRepository.deleteTask(taskId);
  }

  /**
   * Get available task templates from database
   */
  async getTaskTemplates(): Promise<{ task_name: string; assigned_role: string | null }[]> {
    return await orderPartRepository.getAvailableTasks();
  }
}

export const orderTaskService = new OrderTaskService();
