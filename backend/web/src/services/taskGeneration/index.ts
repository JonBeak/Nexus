/**
 * Task Generation Service
 * Main orchestrator for spec-driven task generation
 *
 * Flow:
 * 1. Load all parts for the order
 * 2. Group parts by parent (parent + sub-parts)
 * 3. For each group, collect specs and generate tasks
 * 4. Save tasks to database
 */

import { orderPartRepository } from '../../repositories/orderPartRepository';
import { query } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { TaskGenerationResult, GeneratedTask, PartGroup } from './types';
import { groupPartsByParent } from './specParser';
import {
  generateBaseTasks,
  generateClosingTasks,
  generateComponentTasks,
  generateConditionalTasks,
  getTaskSortOrder,
  getRole
} from './taskRules';
import { hasSpec } from './specParser';
import { calculateOrderDataHash } from '../../utils/orderDataHashService';

/**
 * Customer preferences for order-wide task generation
 */
interface CustomerPreferences {
  pattern_yes_or_no: number;
  pattern_type: string | null;
}

/**
 * Generate production tasks for an order
 * This is the main entry point for task generation
 */
export async function generateTasksForOrder(orderId: number): Promise<TaskGenerationResult> {
  console.log(`[TaskGeneration] Starting task generation for order ${orderId}`);

  const result: TaskGenerationResult = {
    tasksCreated: 0,
    tasksByPart: [],
    requiresManualInput: false,
    manualInputReasons: [],
    warnings: [],
    paintingWarnings: [],
    unknownApplications: []
  };

  // 1. Load all parts for the order
  const parts = await orderPartRepository.getOrderParts(orderId);

  if (parts.length === 0) {
    result.warnings.push('No parts found for order');
    return result;
  }

  // Step 1: Remove header rows (they never get tasks)
  const nonHeaderParts = parts.filter(part => !part.is_header_row);

  console.log(`[TaskGeneration] Found ${parts.length} parts, ${nonHeaderParts.length} non-header parts`);

  if (nonHeaderParts.length === 0) {
    result.warnings.push('No parts found for order');
    return result;
  }

  // Step 2: Group parts by parent (parent + sub-parts)
  const allGroups = groupPartsByParent(nonHeaderParts);

  // Step 3: Filter to only groups where PARENT has a Product Type selected
  // This ensures tasks are only generated for parent parts with specs_display_name
  const partGroups = allGroups.filter(group => {
    const hasProductType = group.specsDisplayName && group.specsDisplayName.trim();
    if (!hasProductType) {
      console.log(`[TaskGeneration] Skipping Part ${group.displayNumber} - no Product Type selected`);
    }
    return hasProductType;
  });

  console.log(`[TaskGeneration] ${allGroups.length} groups total, ${partGroups.length} with Product Types`);

  if (partGroups.length === 0) {
    result.warnings.push('No parent parts with Product Types found for order');
    return result;
  }

  // 3. Delete existing tasks and order-wide parts for this order
  await deleteExistingTasks(orderId);
  await deleteExistingOrderWideParts(orderId);

  // 4. Generate tasks for each group
  const allTasks: GeneratedTask[] = [];

  for (const group of partGroups) {
    console.log(`[TaskGeneration] Processing group: Part ${group.displayNumber} (${group.specsDisplayName || 'No type'})`);
    console.log(`[TaskGeneration]   - Specs found: ${group.allSpecs.map(s => s.templateName).join(', ') || 'None'}`);

    const groupTasks: GeneratedTask[] = [];

    // Component tasks (based on spec presence)
    groupTasks.push(...generateComponentTasks(orderId, group.parentPartId, group));

    // Conditional tasks (based on spec values)
    const conditionalResult = await generateConditionalTasks(orderId, group.parentPartId, group);
    groupTasks.push(...conditionalResult.tasks);

    if (conditionalResult.requiresManualInput) {
      result.requiresManualInput = true;
      result.manualInputReasons.push(...conditionalResult.manualInputReasons);
    }

    // Collect painting warnings from conditional tasks result
    if (conditionalResult.paintingWarnings && conditionalResult.paintingWarnings.length > 0) {
      result.paintingWarnings?.push(...conditionalResult.paintingWarnings);
    }

    // Collect unknown applications
    if (conditionalResult.unknownApplications && conditionalResult.unknownApplications.length > 0) {
      result.unknownApplications?.push(...conditionalResult.unknownApplications);
    }

    // Add to result
    result.tasksByPart.push({
      partId: group.parentPartId,
      displayNumber: group.displayNumber,
      tasks: groupTasks
    });

    allTasks.push(...groupTasks);

    console.log(`[TaskGeneration]   - Generated ${groupTasks.length} tasks`);
  }

  // 4.5 Generate order-wide tasks (Pattern, UL)
  const orderWideTasks = await generateOrderWideTasks(orderId, partGroups);
  if (orderWideTasks.length > 0) {
    allTasks.push(...orderWideTasks);
    console.log(`[TaskGeneration] Generated ${orderWideTasks.length} order-wide tasks`);
  }

  // 5. Save all tasks to database
  if (allTasks.length > 0) {
    await saveTasks(allTasks);
    result.tasksCreated = allTasks.length;
  }

  // 5.5 Create job-level QC & Packing task (part_id = null)
  // This is always created for every order and syncs bidirectionally with order status
  await createQCPackingTask(orderId);
  result.tasksCreated += 1;
  console.log(`[TaskGeneration] Created QC & Packing job-level task`);

  // 6. Update task generation timestamp and hash
  await updateTaskGenerationMeta(orderId);

  console.log(`[TaskGeneration] Completed. Created ${result.tasksCreated} tasks`);
  if (result.requiresManualInput) {
    console.log(`[TaskGeneration] Manual input required: ${result.manualInputReasons.join(', ')}`);
  }

  return result;
}

/**
 * Delete all existing tasks for an order
 */
async function deleteExistingTasks(orderId: number): Promise<void> {
  await query(
    'DELETE FROM order_tasks WHERE order_id = ?',
    [orderId]
  );
  console.log(`[TaskGeneration] Deleted existing tasks for order ${orderId}`);
}

/**
 * Save generated tasks to database
 */
async function saveTasks(tasks: GeneratedTask[]): Promise<void> {
  if (tasks.length === 0) return;

  // Sort tasks by their canonical order before inserting
  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  // Build bulk insert query
  const values: any[] = [];
  const placeholders: string[] = [];

  for (const task of sortedTasks) {
    placeholders.push('(?, ?, ?, ?, ?, ?)');
    values.push(
      task.orderId,
      task.partId,
      task.taskName,
      task.sortOrder,
      task.assignedRole,
      task.notes
    );
  }

  const sql = `
    INSERT INTO order_tasks (order_id, part_id, task_name, sort_order, assigned_role, notes)
    VALUES ${placeholders.join(', ')}
  `;

  await query(sql, values);
}

/**
 * Update task generation metadata on orders table
 */
async function updateTaskGenerationMeta(orderId: number): Promise<void> {
  const dataHash = await calculateOrderDataHash(orderId);

  await query(
    `UPDATE orders
     SET tasks_generated_at = NOW(),
         tasks_data_hash = ?
     WHERE order_id = ?`,
    [dataHash, orderId]
  );
}

/**
 * Delete existing order-wide parts for an order
 * These will be recreated during task generation
 */
async function deleteExistingOrderWideParts(orderId: number): Promise<void> {
  await query(
    'DELETE FROM order_parts WHERE order_id = ? AND is_order_wide = 1',
    [orderId]
  );
  console.log(`[TaskGeneration] Deleted existing order-wide parts for order ${orderId}`);
}

/**
 * Fetch customer preferences for order-wide task generation
 */
async function fetchCustomerPreferences(orderId: number): Promise<CustomerPreferences | null> {
  const rows = await query(
    `SELECT c.pattern_yes_or_no, c.pattern_type
     FROM orders o
     JOIN customers c ON o.customer_id = c.customer_id
     WHERE o.order_id = ?`,
    [orderId]
  ) as RowDataPacket[];

  if (rows.length === 0) {
    return null;
  }

  return {
    pattern_yes_or_no: rows[0].pattern_yes_or_no || 0,
    pattern_type: rows[0].pattern_type || null
  };
}

/**
 * Check if a part group is "Substrate Cut with D-Tape"
 * This determines whether Vinyl Stencil (vs Paper Pattern) is needed
 */
function isSubstrateCutWithDTape(group: PartGroup): boolean {
  const isSubstrateCut = group.specsDisplayName?.toLowerCase().includes('substrate cut');
  const hasDTape = hasSpec(group, 'D-Tape');
  return Boolean(isSubstrateCut && hasDTape);
}

/**
 * Generate order-wide tasks (Paper Pattern, Vinyl Stencil, UL)
 * These tasks apply to the entire order, not individual parts
 *
 * Returns generated tasks and creates the order-wide part if needed
 */
async function generateOrderWideTasks(
  orderId: number,
  partGroups: PartGroup[]
): Promise<GeneratedTask[]> {
  const tasks: GeneratedTask[] = [];

  // Fetch customer preferences
  const customerPrefs = await fetchCustomerPreferences(orderId);
  if (!customerPrefs) {
    console.log(`[TaskGeneration] Could not fetch customer preferences for order ${orderId}`);
    return tasks;
  }

  // Check conditions for each order-wide task
  const wantsPattern = customerPrefs.pattern_yes_or_no === 1;
  const isDigitalPattern = customerPrefs.pattern_type === 'Digital';

  // Paper Pattern: Customer wants pattern (not digital) AND any part is NOT Substrate Cut with D-Tape
  const needsPaperPattern = wantsPattern &&
    !isDigitalPattern &&
    partGroups.some(g => !isSubstrateCutWithDTape(g));

  // Vinyl Stencil: Customer wants pattern (not digital) AND any part IS Substrate Cut with D-Tape
  const needsVinylStencil = wantsPattern &&
    !isDigitalPattern &&
    partGroups.some(g => isSubstrateCutWithDTape(g));

  // UL: Any part has UL spec
  const needsUL = partGroups.some(g => hasSpec(g, 'UL'));

  // Only create order-wide part if there are tasks to generate
  if (!needsPaperPattern && !needsVinylStencil && !needsUL) {
    return tasks;
  }

  // Create order-wide part
  const orderWidePart = await createOrderWidePart(orderId);
  console.log(`[TaskGeneration] Created order-wide part ${orderWidePart.partId} for order ${orderId}`);

  // Generate tasks
  if (needsPaperPattern) {
    tasks.push({
      taskName: 'Paper Pattern',
      assignedRole: getRole('Paper Pattern'),
      notes: null,
      partId: orderWidePart.partId,
      orderId,
      sortOrder: getTaskSortOrder('Paper Pattern')
    });
  }

  if (needsVinylStencil) {
    tasks.push({
      taskName: 'Vinyl Stencil',
      assignedRole: getRole('Vinyl Stencil'),
      notes: null,
      partId: orderWidePart.partId,
      orderId,
      sortOrder: getTaskSortOrder('Vinyl Stencil')
    });
  }

  if (needsUL) {
    tasks.push({
      taskName: 'UL',
      assignedRole: getRole('UL'),
      notes: null,
      partId: orderWidePart.partId,
      orderId,
      sortOrder: getTaskSortOrder('UL')
    });
  }

  return tasks;
}

/**
 * Create an order-wide part for order-level tasks
 * This part is NOT a parent (excluded from Tasks Table) but DOES have tasks (shown in Tasks list)
 */
async function createOrderWidePart(orderId: number): Promise<{ partId: number }> {
  // Get the next part number for this order
  const maxPartRows = await query(
    'SELECT MAX(part_number) as max_part FROM order_parts WHERE order_id = ?',
    [orderId]
  ) as RowDataPacket[];

  const nextPartNumber = (maxPartRows[0]?.max_part || 0) + 1;

  // Create the order-wide part
  const partId = await orderPartRepository.createOrderPart({
    order_id: orderId,
    part_number: nextPartNumber,
    is_header_row: false,
    is_order_wide: true,
    display_number: 'OW',  // "Order Wide" - distinct from numeric part numbers
    is_parent: false,  // NOT a parent - this excludes it from Tasks Table (which filters by is_parent=1)
    product_type: 'Order Tasks',
    part_scope: 'ORDER_WIDE',
    product_type_id: 'order_tasks',
    quantity: 1,
    specifications: {}
  });

  return { partId };
}

/**
 * Create job-level QC & Packing task (part_id = null)
 * This task is always created for every order and syncs bidirectionally with status:
 * - Completing task → moves order to shipping/pick_up
 * - Moving to shipping/pick_up/awaiting_payment/completed → marks task complete
 * - Moving to production statuses → marks task incomplete
 * - on_hold/cancelled → no change to task
 */
async function createQCPackingTask(orderId: number): Promise<number> {
  const QC_TASK_NAME = 'QC & Packing';
  const QC_TASK_ROLE = 'manager';
  const QC_SORT_ORDER = getTaskSortOrder(QC_TASK_NAME);

  const result = await query(
    `INSERT INTO order_tasks (order_id, part_id, task_name, sort_order, assigned_role, notes)
     VALUES (?, NULL, ?, ?, ?, NULL)`,
    [orderId, QC_TASK_NAME, QC_SORT_ORDER, QC_TASK_ROLE]
  ) as ResultSetHeader;

  return result.insertId;
}

// Re-export types
export type { TaskGenerationResult, GeneratedTask, PartGroup } from './types';
