/**
 * Painting Task Generator
 * Generates painting tasks based on the 3D matrix (Item Type × Component × Timing)
 */

import {
  lookupPaintingTasks,
  getTaskNames,
  getMaterialCategory,
  getBackerType,
  PaintingComponent,
  PaintingTiming
} from './paintingTaskMatrix';
import { GeneratedTask, PartGroup } from './types';
import { findSpec, hasSpec } from './specParser';
import { getTaskSortOrder, TASK_ROLE_MAP } from './taskRules';

export interface PaintingTaskResult {
  tasks: GeneratedTask[];
  warnings: PaintingWarning[];
}

export interface PaintingWarning {
  partId: number;
  partName: string;
  itemType: string;
  component: string;
  timing: string;
  colour: string;
  message: string;
}

/**
 * Generate painting tasks for a part group
 * Uses the 3D matrix to determine which tasks to create
 */
export function generatePaintingTasks(
  orderId: number,
  partId: number,
  group: PartGroup
): PaintingTaskResult {
  const result: PaintingTaskResult = {
    tasks: [],
    warnings: []
  };

  // Check if part has Painting spec
  if (!hasSpec(group, 'Painting')) {
    return result; // No painting spec, nothing to do
  }

  const paintingSpec = findSpec(group, 'Painting');
  if (!paintingSpec) {
    return result;
  }

  // Validate required fields
  const component = paintingSpec.values.component as PaintingComponent | undefined;
  const timing = paintingSpec.values.timing as PaintingTiming | undefined;
  const colour = paintingSpec.values.colour;

  if (!component || !timing) {
    console.warn(`[PaintingTaskGenerator] Missing component or timing for part ${partId}`);
    return result;
  }

  if (!colour) {
    console.warn(`[PaintingTaskGenerator] Missing colour for part ${partId}`);
  }

  // Get item type (specs_display_name)
  const itemType = group.specsDisplayName || 'Unknown';

  // Determine material category if needed (for Substrate Cut)
  let materialCategory = undefined;
  if (itemType === 'Substrate Cut') {
    // Check Face spec first, fallback to Return spec
    const faceSpec = findSpec(group, 'Face');
    const returnSpec = findSpec(group, 'Return');
    const material = faceSpec?.values.material || returnSpec?.values.material;
    materialCategory = getMaterialCategory(material);
    console.log(`[PaintingTaskGenerator] Substrate Cut detected - Material: ${material} → Category: ${materialCategory}`);
  }

  // Determine backer type if needed (for Backer)
  let backerType = undefined;
  if (itemType === 'Backer') {
    backerType = getBackerType(itemType);
    console.log(`[PaintingTaskGenerator] Backer detected - Type: ${backerType}`);
  }

  // Lookup tasks from matrix
  const taskNumbers = lookupPaintingTasks(
    itemType,
    component,
    timing,
    materialCategory,
    backerType
  );

  console.log(`[PaintingTaskGenerator] Matrix lookup: ${itemType} + ${component} + ${timing} → [${taskNumbers.join(', ')}]`);

  // If no tasks found, create warning
  if (taskNumbers.length === 0) {
    const warning: PaintingWarning = {
      partId,
      partName: group.displayNumber,
      itemType,
      component,
      timing,
      colour: colour || 'N/A',
      message: `No standard painting tasks for ${itemType} + ${component} + ${timing}. Manually add tasks in Progress view.`
    };
    result.warnings.push(warning);
    console.log(`[PaintingTaskGenerator] ⚠️  No tasks for combination - Warning created`);
    return result;
  }

  // Convert task numbers to task objects
  const taskNames = getTaskNames(taskNumbers);

  for (const taskName of taskNames) {
    const notes = colour ? `Colour: ${colour}` : null;

    result.tasks.push({
      taskName,
      assignedRole: TASK_ROLE_MAP[taskName] || 'painter',
      notes,
      partId,
      orderId,
      sortOrder: getTaskSortOrder(taskName)
    });
  }

  console.log(`[PaintingTaskGenerator] ✓ Generated ${result.tasks.length} painting tasks`);

  return result;
}
