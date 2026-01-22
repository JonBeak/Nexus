/**
 * Task Rules Engine
 * Defines spec-to-task mapping rules based on the Task Generation Specification
 *
 * Updated 2026-01-22: Added async database-backed versions via taskConfigService
 * Hardcoded arrays kept as fallback for backwards compatibility
 */

import { ProductionRole } from '../../types/orders';
import { GeneratedTask, PartGroup, UnknownApplication } from './types';
import { hasSpec, getSpecValue, findSpec, getCuttingMethod, extractBoxTypeMaterial, findAllSpecs, parseSpecifications } from './specParser';
import { vinylMatrixService } from '../vinylMatrixService';
import { generatePaintingTasks } from './paintingTaskGenerator';
import { taskConfigService } from './taskConfigService';

/**
 * Default sort order for tasks not found in TASK_ORDER
 * These tasks will appear at the end of the task list
 */
const UNKNOWN_TASK_SORT_ORDER = 999;

/**
 * Canonical task order (from Nexus_Orders_TaskGeneration.md Task Reference)
 * Tasks are sorted by their position in this array
 *
 * Note: Order-wide tasks (Design Files, Design Approval, QC & Packing) are tracked
 * via order status and are NOT generated as part-specific tasks.
 */
export const TASK_ORDER: string[] = [
  '3D Print',
  'Paper Pattern',
  'Vinyl Stencil',
  'UL',
  'Vinyl Plotting',
  'Sanding (320) before cutting',
  'Scuffing before cutting',
  'Paint before cutting',
  'Vinyl Before Cutting',
  'Vinyl Wrap Return/Trim',
  'CNC Router Cut',
  'Laser Cut',
  'Cut & Bend Return',
  'Cut & Bend Trim',
  'Sanding (320) after cutting',
  'Scuffing after cutting',
  'Paint After Cutting',
  'Backer / Raceway Bending',
  'Paint After Bending',
  'Vinyl After Cutting',
  'Trim Fabrication',
  'Return Fabrication',
  'Return Gluing',
  'Mounting Hardware',
  'Face Assembly',
  'LEDs',
  'Backer / Raceway Fabrication',
  'Vinyl after Fabrication',
  'Paint after Fabrication',
  'Assembly',
  'QC & Packing'
];

/**
 * Get sort order for a task name
 * Returns the index in TASK_ORDER, or UNKNOWN_TASK_SORT_ORDER if not found
 */
export function getTaskSortOrder(taskName: string): number {
  const index = TASK_ORDER.indexOf(taskName);
  return index >= 0 ? index : UNKNOWN_TASK_SORT_ORDER;
}

/**
 * Task name to role mapping (from specification document)
 *
 * Note: Status-based tasks (Design Files, Design Approval, QC & Packing) are NOT included here
 * because they are tracked via order.status, not as per-part tasks.
 */
export const TASK_ROLE_MAP: Record<string, ProductionRole> = {
  '3D Print': 'designer',
  'Paper Pattern': 'designer',
  'Vinyl Stencil': 'designer',
  'UL': 'designer',
  'Vinyl Plotting': 'designer',
  'Vinyl Before Cutting': 'vinyl_applicator',
  'Vinyl After Cutting': 'vinyl_applicator',
  'Vinyl Wrap Return/Trim': 'vinyl_applicator',
  'Vinyl after Fabrication': 'vinyl_applicator',
  'CNC Router Cut': 'cnc_router_operator',
  'Laser Cut': 'manager',
  'Cut & Bend Return': 'cut_bender_operator',
  'Cut & Bend Trim': 'cut_bender_operator',
  'Backer / Raceway Bending': 'backer_raceway_fabricator',
  'Trim Fabrication': 'trim_fabricator',
  'Return Fabrication': 'return_fabricator',
  'Return Gluing': 'return_gluer',
  'Mounting Hardware': 'mounting_assembler',
  'Face Assembly': 'face_assembler',
  'LEDs': 'led_installer',
  'Backer / Raceway Fabrication': 'backer_raceway_fabricator',
  'Assembly': 'backer_raceway_assembler',
  // Painting tasks
  'Sanding (320) before cutting': 'painter',
  'Scuffing before cutting': 'painter',
  'Paint before cutting': 'painter',
  'Sanding (320) after cutting': 'painter',
  'Scuffing after cutting': 'painter',
  'Paint After Cutting': 'painter',
  'Paint After Bending': 'painter',
  'Paint after Fabrication': 'painter'
};

/**
 * Get role for a task name
 */
export function getRole(taskName: string): ProductionRole {
  return TASK_ROLE_MAP[taskName] || 'manager';
}

// =============================================================================
// Async Database-Backed Versions (via taskConfigService)
// =============================================================================

/**
 * Get sort order for a task name (async, database-backed with caching)
 * Returns the index in task order, or UNKNOWN_TASK_SORT_ORDER if not found
 */
export async function getTaskSortOrderAsync(taskName: string): Promise<number> {
  return taskConfigService.getTaskSortOrder(taskName);
}

/**
 * Get role for a task name (async, database-backed with caching)
 * Returns 'manager' as default if not found
 */
export async function getRoleAsync(taskName: string): Promise<ProductionRole> {
  return taskConfigService.getRole(taskName);
}

/**
 * Get task order array (async, database-backed with caching)
 */
export async function getTaskOrderAsync(): Promise<string[]> {
  return taskConfigService.getTaskOrder();
}

/**
 * Get task role map (async, database-backed with caching)
 */
export async function getTaskRoleMapAsync(): Promise<Record<string, ProductionRole>> {
  return taskConfigService.getTaskRoleMap();
}

/**
 * Invalidate task config cache (call after settings updates)
 */
export async function invalidateTaskConfigCache(): Promise<void> {
  return taskConfigService.invalidateCache();
}

/**
 * Generate BASE tasks (always included for every part)
 *
 * @deprecated - No longer used. Design Files and Design Approval are now tracked
 * via order status (pending_production_files_creation / pending_production_files_approval)
 * instead of per-part tasks. Keeping function for reference.
 */
export function generateBaseTasks(orderId: number, partId: number): GeneratedTask[] {
  return [
    {
      taskName: 'Design Files',
      assignedRole: getRole('Design Files'),
      notes: null,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Design Files')
    },
    {
      taskName: 'Design Approval',
      assignedRole: getRole('Design Approval'),
      notes: null,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Design Approval')
    }
  ];
}

/**
 * Generate CLOSING tasks (always at the end)
 *
 * @deprecated - No longer used. QC & Packing is now tracked via order status
 * (qc_packing) instead of per-part tasks. Keeping function for reference.
 */
export function generateClosingTasks(orderId: number, partId: number): GeneratedTask[] {
  return [
    {
      taskName: 'QC & Packing',
      assignedRole: getRole('QC & Packing'),
      notes: null,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('QC & Packing')
    }
  ];
}

/**
 * Generate COMPONENT tasks based on spec presence
 * 3DP Return spec → 3D Print
 * Return spec → Cut & Bend Return, Return Fabrication, Return Gluing
 * Trim spec → Cut & Bend Trim, Trim Fabrication
 * Face spec → CNC Router Cut (with Face note)
 * Back spec → CNC Router Cut (with Back note)
 */
export function generateComponentTasks(
  orderId: number,
  partId: number,
  group: PartGroup
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];

  // 3DP Return spec → 3D Print task (for 3D Print products)
  if (hasSpec(group, '3DP Return')) {
    const depth = getSpecValue(group, '3DP Return', 'depth');
    const faceMaterial = getSpecValue(group, '3DP Return', 'face_material');
    const printNote = [depth, faceMaterial].filter(Boolean).join(' - ') || null;

    tasks.push({
      taskName: '3D Print',
      assignedRole: getRole('3D Print'),
      notes: printNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('3D Print')
    });
  }

  // Return spec → 3 tasks
  if (hasSpec(group, 'Return')) {
    const colour = getSpecValue(group, 'Return', 'colour');
    const depth = getSpecValue(group, 'Return', 'depth');
    const returnNote = [depth, colour].filter(Boolean).join(' ') || null;

    tasks.push({
      taskName: 'Cut & Bend Return',
      assignedRole: getRole('Cut & Bend Return'),
      notes: returnNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Cut & Bend Return')
    });

    tasks.push({
      taskName: 'Return Fabrication',
      assignedRole: getRole('Return Fabrication'),
      notes: colour || null,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Return Fabrication')
    });

    tasks.push({
      taskName: 'Return Gluing',
      assignedRole: getRole('Return Gluing'),
      notes: null,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Return Gluing')
    });
  }

  // Trim spec → 2 tasks
  if (hasSpec(group, 'Trim')) {
    const colour = getSpecValue(group, 'Trim', 'colour');

    tasks.push({
      taskName: 'Cut & Bend Trim',
      assignedRole: getRole('Cut & Bend Trim'),
      notes: colour || null,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Cut & Bend Trim')
    });

    tasks.push({
      taskName: 'Trim Fabrication',
      assignedRole: getRole('Trim Fabrication'),
      notes: colour || null,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Trim Fabrication')
    });
  }

  // Face spec → CNC Router Cut
  if (hasSpec(group, 'Face')) {
    const material = getSpecValue(group, 'Face', 'material');
    const colour = getSpecValue(group, 'Face', 'colour');
    const faceNote = ['Face', material, colour].filter(Boolean).join(', ');

    tasks.push({
      taskName: 'CNC Router Cut',
      assignedRole: getRole('CNC Router Cut'),
      notes: faceNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('CNC Router Cut')
    });
  }

  // Back spec → CNC Router Cut (separate task)
  if (hasSpec(group, 'Back')) {
    const material = getSpecValue(group, 'Back', 'material');
    const backNote = ['Back', material].filter(Boolean).join(', ');

    tasks.push({
      taskName: 'CNC Router Cut',
      assignedRole: getRole('CNC Router Cut'),
      notes: backNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('CNC Router Cut')
    });
  }

  // Cutting Tasks → Generate by checking each part for Cutting + Material/Box Type pairs
  // This ensures we match the correct material to each cutting task
  // Note: Cutting must be paired with Material or Box Type (not Face/Back)
  for (const part of group.parts) {
    // Parse specs for this individual part using the proper parser
    const partSpecs = parseSpecifications(part.specifications || {});

    // Find Cutting spec in this part
    const cuttingSpec = partSpecs.find(s => s.templateName === 'Cutting');
    if (!cuttingSpec) continue;

    const cuttingMethod = cuttingSpec.values.method;
    if (!cuttingMethod) continue;

    // Find Material or Box Type spec in this part (for cutting material info)
    const materialSpec = partSpecs.find(s => s.templateName === 'Material');
    const boxTypeSpec = partSpecs.find(s => s.templateName === 'Box Type');

    let materialInfo: string | null = null;

    if (materialSpec) {
      const substrate = materialSpec.values.substrate || '';
      const colour = materialSpec.values.colour || '';
      materialInfo = [substrate, colour].filter(Boolean).join(', ') || null;
    } else if (boxTypeSpec) {
      const material = boxTypeSpec.values.material || '';
      const colour = boxTypeSpec.values.colour || '';
      materialInfo = [material, colour].filter(Boolean).join(', ') || null;
    }

    // Generate cutting task if we have both method and material
    if (materialInfo) {
      if (cuttingMethod === 'Router') {
        tasks.push({
          taskName: 'CNC Router Cut',
          assignedRole: getRole('CNC Router Cut'),
          notes: materialInfo,
          partId,
          orderId,
          sortOrder: getTaskSortOrder('CNC Router Cut')
        });
      } else if (cuttingMethod === 'Laser') {
        tasks.push({
          taskName: 'Laser Cut',
          assignedRole: getRole('Laser Cut'),
          notes: materialInfo,
          partId,
          orderId,
          sortOrder: getTaskSortOrder('Laser Cut')
        });
      }
    }
  }

  // Box Type spec → Backer / Raceway Fabrication task
  if (hasSpec(group, 'Box Type')) {
    const materialInfo = extractBoxTypeMaterial(group);
    const fabrication = getSpecValue(group, 'Box Type', 'fabrication');
    const fabricationNote = fabrication ? `${materialInfo} - ${fabrication}` : materialInfo;

    tasks.push({
      taskName: 'Backer / Raceway Fabrication',
      assignedRole: getRole('Backer / Raceway Fabrication'),
      notes: fabricationNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Backer / Raceway Fabrication')
    });
  }

  return tasks;
}

/**
 * Generate CONDITIONAL tasks based on spec values
 * Returns tasks and manual input flags
 */
export async function generateConditionalTasks(
  orderId: number,
  partId: number,
  group: PartGroup
): Promise<{ tasks: GeneratedTask[]; requiresManualInput: boolean; manualInputReasons: string[]; paintingWarnings: any[]; unknownApplications: UnknownApplication[] }> {
  const tasks: GeneratedTask[] = [];
  let requiresManualInput = false;
  const manualInputReasons: string[] = [];
  const paintingWarnings: any[] = [];
  const unknownApplications: UnknownApplication[] = [];

  // LEDs tasks - one per LED spec
  const ledSpecs = findAllSpecs(group, 'LEDs');
  for (const ledSpec of ledSpecs) {
    const ledType = ledSpec.values.led_type || '';
    const count = ledSpec.values.count || '';
    const note = ledSpec.values.note || '';
    const ledNote = [ledType, count ? `Count: ${count}` : null, note].filter(Boolean).join(', ') || null;

    tasks.push({
      taskName: 'LEDs',
      assignedRole: getRole('LEDs'),
      notes: ledNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('LEDs')
    });
  }

  // Vinyl tasks (based on application value)
  const vinylResult = await generateVinylTasks(orderId, partId, group, 'Vinyl');
  tasks.push(...vinylResult.tasks);
  if (vinylResult.requiresManualInput) {
    requiresManualInput = true;
    manualInputReasons.push(...vinylResult.reasons);
  }
  unknownApplications.push(...vinylResult.unknownApplications);

  // Digital Print tasks (same logic as Vinyl)
  const digitalPrintResult = await generateVinylTasks(orderId, partId, group, 'Digital Print');
  tasks.push(...digitalPrintResult.tasks);
  if (digitalPrintResult.requiresManualInput) {
    requiresManualInput = true;
    manualInputReasons.push(...digitalPrintResult.reasons);
  }
  unknownApplications.push(...digitalPrintResult.unknownApplications);

  // Mounting Hardware (from Mounting spec)
  if (hasSpec(group, 'Mounting') || hasSpec(group, 'Pins')) {
    const pinType = getSpecValue(group, 'Mounting', 'pins') || getSpecValue(group, 'Pins', 'pins');
    const spacers = getSpecValue(group, 'Mounting', 'spacers') || getSpecValue(group, 'Pins', 'spacers');
    const mountingNote = [pinType, spacers].filter(Boolean).join(', ') || null;

    tasks.push({
      taskName: 'Mounting Hardware',
      assignedRole: getRole('Mounting Hardware'),
      notes: mountingNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Mounting Hardware')
    });
  }

  // Mounting Hardware (from D-Tape spec) - can create second task
  if (hasSpec(group, 'D-Tape')) {
    const thickness = getSpecValue(group, 'D-Tape', 'thickness');

    tasks.push({
      taskName: 'Mounting Hardware',
      assignedRole: getRole('Mounting Hardware'),
      notes: thickness ? `D-Tape: ${thickness}` : 'D-Tape',
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Mounting Hardware')
    });
  }

  // Acrylic spec → CNC Router Cut (for Push Thru products)
  if (hasSpec(group, 'Acrylic')) {
    const thickness = getSpecValue(group, 'Acrylic', 'thickness');
    const colour = getSpecValue(group, 'Acrylic', 'colour');
    const acrylicNote = [thickness, colour].filter(Boolean).join(', ') || null;

    tasks.push({
      taskName: 'CNC Router Cut',
      assignedRole: getRole('CNC Router Cut'),
      notes: acrylicNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('CNC Router Cut')
    });
  }

  // Face Assembly spec → Face Assembly task (for Halo Lit, Trimless Letters, etc.)
  if (hasSpec(group, 'Face Assembly')) {
    const faceAssemblySpec = findSpec(group, 'Face Assembly');
    const description = faceAssemblySpec?.values.description || null;

    tasks.push({
      taskName: 'Face Assembly',
      assignedRole: getRole('Face Assembly'),
      notes: description,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Face Assembly')
    });
  }

  // Assembly spec → Face Assembly or Backer / Raceway Assembly based on item name
  if (hasSpec(group, 'Assembly')) {
    // Check the item_name of the part that has the Assembly spec
    const assemblyPart = group.parts.find(part => {
      const partSpecs = parseSpecifications(part.specifications || {});
      return partSpecs.some(s => s.templateName === 'Assembly');
    });

    const itemName = assemblyPart?.specsDisplayName?.toLowerCase() || '';
    const assemblySpec = findSpec(group, 'Assembly');
    const description = assemblySpec?.values.description || null;

    // Determine task based on product type
    // Backer-type products use "Assembly" task, face-type products use "Face Assembly"
    const isBacker = itemName.includes('backer') ||
                     itemName.includes('raceway') ||
                     itemName.includes('push thru') ||
                     itemName.includes('knockout box');
    const taskName = isBacker ? 'Assembly' : 'Face Assembly';

    tasks.push({
      taskName,
      assignedRole: getRole(taskName),
      notes: description,
      partId,
      orderId,
      sortOrder: getTaskSortOrder(taskName)
    });
  }

  // Painting tasks (based on 3D matrix lookup from database)
  if (hasSpec(group, 'Painting')) {
    const paintingResult = await generatePaintingTasks(orderId, partId, group);
    tasks.push(...paintingResult.tasks);

    // Collect warnings for frontend display
    if (paintingResult.warnings.length > 0) {
      paintingWarnings.push(...paintingResult.warnings);
      // Also add to manual input reasons for backward compatibility
      for (const warning of paintingResult.warnings) {
        manualInputReasons.push(warning.message);
      }
    }
  }

  return { tasks, requiresManualInput, manualInputReasons, paintingWarnings, unknownApplications };
}

/**
 * Helper: Generate normalized key from value
 */
function generateKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Generate Vinyl/Digital Print tasks based on application value
 * Processes ALL specs of the given type (not just the first one)
 * Uses vinyl application matrix to determine which tasks to generate
 */
async function generateVinylTasks(
  orderId: number,
  partId: number,
  group: PartGroup,
  specName: 'Vinyl' | 'Digital Print'
): Promise<{ tasks: GeneratedTask[]; requiresManualInput: boolean; reasons: string[]; unknownApplications: UnknownApplication[] }> {
  const tasks: GeneratedTask[] = [];
  const reasons: string[] = [];
  const unknownApplications: UnknownApplication[] = [];
  let requiresManualInput = false;

  // Get ALL specs of this type (not just the first one)
  const specs = findAllSpecs(group, specName);
  if (specs.length === 0) {
    return { tasks, requiresManualInput, reasons, unknownApplications };
  }

  // Get product type key for matrix lookup
  const productType = group.specsDisplayName || 'Unknown';
  const productTypeKey = generateKey(productType);

  // Process each spec individually
  for (const spec of specs) {
    const application = spec.values.application || spec.values.colours || '';
    const colour = spec.values.colour || spec.values.colours || '';
    const printType = spec.values.type || ''; // For Digital Print: Translucent, Opaque, etc.

    // Build notes based on spec type
    let taskNote: string | null = null;
    if (specName === 'Digital Print') {
      // Format: "Digital Print - Translucent: White - Face, Full"
      const typePart = printType || 'Unknown';
      const basePart = colour ? `Digital Print - ${typePart}: ${colour}` : `Digital Print - ${typePart}`;
      taskNote = application ? `${basePart} - ${application}` : basePart;
    } else {
      // Vinyl: include colour and application
      if (colour && application) {
        taskNote = `Colour: ${colour} - ${application}`;
      } else if (colour) {
        taskNote = `Colour: ${colour}`;
      } else if (application) {
        taskNote = application;
      } else {
        taskNote = null;
      }
    }

    // Skip if no application specified
    if (!application) {
      continue;
    }

    // Generate application key for matrix lookup
    const applicationKey = generateKey(application);

    // Lookup tasks from vinyl application matrix
    const matrixResult = await vinylMatrixService.getTasksForApplication(productTypeKey, applicationKey);

    if (matrixResult.success && matrixResult.data && matrixResult.data.length > 0) {
      // Found in matrix - generate tasks from matrix
      for (const taskName of matrixResult.data) {
        tasks.push({
          taskName,
          assignedRole: getRole(taskName),
          notes: taskNote,
          partId,
          orderId,
          sortOrder: getTaskSortOrder(taskName)
        });
      }
    } else {
      // No matrix entry found - flag as unknown for modal
      unknownApplications.push({
        partId,
        partDisplayNumber: group.displayNumber,
        productType,
        productTypeKey,
        application,
        applicationKey,
        colour,
        specName
      });
    }
  }

  return { tasks, requiresManualInput, reasons, unknownApplications };
}
