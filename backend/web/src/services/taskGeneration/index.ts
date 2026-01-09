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
  getTaskSortOrder
} from './taskRules';
import { calculateOrderDataHash } from '../../utils/orderDataHashService';

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

  // 3. Delete existing tasks for this order
  await deleteExistingTasks(orderId);

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

  // 5. Save all tasks to database
  if (allTasks.length > 0) {
    await saveTasks(allTasks);
    result.tasksCreated = allTasks.length;
  }

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

// Re-export types
export type { TaskGenerationResult, GeneratedTask, PartGroup } from './types';
