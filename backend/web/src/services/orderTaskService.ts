/**
 * Order Task Service
 * Business Logic for Task Generation and Management
 *
 * Phase 1: Hard-coded task templates
 * Phase 3: Will migrate to database-driven templates
 */

import { PoolConnection } from 'mysql2/promise';
import { orderRepository } from '../repositories/orderRepository';
import { OrderPart, TaskTemplate } from '../types/orders';

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

        await orderRepository.createOrderTask(
          {
            order_id: orderId,
            part_id: part.part_id,
            task_name: taskName,
            task_order: i + 1,
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
    return tasks.map((task_name, index) => ({
      task_name,
      task_order: index + 1
    }));
  }
}

export const orderTaskService = new OrderTaskService();
