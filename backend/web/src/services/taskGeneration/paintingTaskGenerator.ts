/**
 * Painting Task Generator
 * Generates painting tasks based on the database matrix (Item Type × Component × Timing)
 *
 * Updated 2026-01-19: Now uses database table instead of hardcoded matrix
 */

import {
  getTaskNames,
  getMaterialCategory,
  getBackerType,
  PaintingComponent,
  PaintingTiming,
  PAINTING_TASKS
} from './paintingTaskMatrix';
import { GeneratedTask, PartGroup } from './types';
import { findSpec, hasSpec } from './specParser';
import { getTaskSortOrder, TASK_ROLE_MAP } from './taskRules';
import { settingsRepository } from '../../repositories/settingsRepository';

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
 * Convert a display name to a URL-friendly key
 * "Front Lit" -> "front-lit"
 * "Return & Trim" -> "return-trim"
 * "3D Print" -> "3d-print"
 */
function toKey(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/\s*&\s*/g, '-')      // "Return & Trim" -> "return-trim"
    .replace(/\s+/g, '-')          // spaces to hyphens
    .replace(/[^a-z0-9-]/g, '');   // remove special chars except hyphens
}

/**
 * Generate painting tasks for a part group
 * Uses the database matrix to determine which tasks to create
 */
export async function generatePaintingTasks(
  orderId: number,
  partId: number,
  group: PartGroup
): Promise<PaintingTaskResult> {
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

  // Convert to database keys
  const productTypeKey = toKey(itemType);
  const componentKey = toKey(component);
  const timingKey = toKey(timing);

  // Determine material variant if needed
  let materialVariant: string | null = null;

  if (itemType === 'Substrate Cut') {
    // Check Face spec first, fallback to Return spec
    const faceSpec = findSpec(group, 'Face');
    const returnSpec = findSpec(group, 'Return');
    const material = faceSpec?.values.material || returnSpec?.values.material;
    materialVariant = getMaterialCategory(material); // 'metal' or 'plastic'
    console.log(`[PaintingTaskGenerator] Substrate Cut detected - Material: ${material} → Variant: ${materialVariant}`);
  } else if (itemType === 'Backer') {
    materialVariant = getBackerType(itemType); // 'flat' or 'folded'
    console.log(`[PaintingTaskGenerator] Backer detected - Variant: ${materialVariant}`);
  }

  // Lookup tasks from database
  console.log(`[PaintingTaskGenerator] DB lookup: ${productTypeKey} + ${componentKey} + ${timingKey} (variant: ${materialVariant || 'none'})`);

  const taskNumbers = await settingsRepository.lookupPaintingTaskNumbers(
    productTypeKey,
    componentKey,
    timingKey,
    materialVariant
  );

  // If entry not found in database, create warning
  if (taskNumbers === null) {
    const warning: PaintingWarning = {
      partId,
      partName: group.displayNumber,
      itemType,
      component,
      timing,
      colour: colour || 'N/A',
      message: `No matrix entry for ${itemType} + ${component} + ${timing}. Configure in Settings or add tasks manually.`
    };
    result.warnings.push(warning);
    console.log(`[PaintingTaskGenerator] ⚠️  No database entry found - Warning created`);
    return result;
  }

  // If entry exists but has no tasks (null/empty), create warning
  if (taskNumbers.length === 0) {
    const warning: PaintingWarning = {
      partId,
      partName: group.displayNumber,
      itemType,
      component,
      timing,
      colour: colour || 'N/A',
      message: `No standard painting tasks for ${itemType} + ${component} + ${timing}. Add tasks manually in Progress view.`
    };
    result.warnings.push(warning);
    console.log(`[PaintingTaskGenerator] ⚠️  Matrix entry has no tasks - Warning created`);
    return result;
  }

  console.log(`[PaintingTaskGenerator] Matrix lookup result: [${taskNumbers.join(', ')}]`);

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

// Re-export types for convenience
export { PAINTING_TASKS };
