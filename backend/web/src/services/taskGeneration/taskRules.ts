/**
 * Task Rules Engine
 * Defines spec-to-task mapping rules based on the Task Generation Specification
 */

import { ProductionRole } from '../../types/orders';
import { GeneratedTask, PartGroup } from './types';
import { hasSpec, getSpecValue, findSpec, getCuttingMethod, extractBoxTypeMaterial, findAllSpecs, parseSpecifications } from './specParser';

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
  'Vinyl Plotting',
  'Sanding (320) before cutting',
  'Scuffing before cutting',
  'Paint before cutting',
  'Vinyl Face Before Cutting',
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
  'Vinyl Face After Cutting',
  'Trim Fabrication',
  'Return Fabrication',
  'Return Gluing',
  'Mounting Hardware',
  'Face Assembly',
  'LEDs',
  'Backer / Raceway Fabrication',
  'Vinyl after Fabrication',
  'Paint after Fabrication',
  'Assembly'
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
  'Vinyl Plotting': 'designer',
  'Vinyl Face Before Cutting': 'vinyl_applicator',
  'Vinyl Face After Cutting': 'vinyl_applicator',
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
function getRole(taskName: string): ProductionRole {
  return TASK_ROLE_MAP[taskName] || 'manager';
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
export function generateConditionalTasks(
  orderId: number,
  partId: number,
  group: PartGroup
): { tasks: GeneratedTask[]; requiresManualInput: boolean; manualInputReasons: string[]; paintingWarnings: any[] } {
  const tasks: GeneratedTask[] = [];
  let requiresManualInput = false;
  const manualInputReasons: string[] = [];
  const paintingWarnings: any[] = [];

  // LEDs task
  if (hasSpec(group, 'LEDs')) {
    const ledType = getSpecValue(group, 'LEDs', 'led_type');
    const count = getSpecValue(group, 'LEDs', 'count');
    const ledNote = [ledType, count ? `Count: ${count}` : null].filter(Boolean).join(', ') || null;

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
  const vinylResult = generateVinylTasks(orderId, partId, group, 'Vinyl');
  tasks.push(...vinylResult.tasks);
  if (vinylResult.requiresManualInput) {
    requiresManualInput = true;
    manualInputReasons.push(...vinylResult.reasons);
  }

  // Digital Print tasks (same logic as Vinyl)
  const digitalPrintResult = generateVinylTasks(orderId, partId, group, 'Digital Print');
  tasks.push(...digitalPrintResult.tasks);
  if (digitalPrintResult.requiresManualInput) {
    requiresManualInput = true;
    manualInputReasons.push(...digitalPrintResult.reasons);
  }

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

  // Painting tasks (based on 3D matrix lookup)
  if (hasSpec(group, 'Painting')) {
    const { generatePaintingTasks } = require('./paintingTaskGenerator');
    const paintingResult = generatePaintingTasks(orderId, partId, group);
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

  return { tasks, requiresManualInput, manualInputReasons, paintingWarnings };
}

/**
 * Generate Vinyl/Digital Print tasks based on application value
 */
function generateVinylTasks(
  orderId: number,
  partId: number,
  group: PartGroup,
  specName: 'Vinyl' | 'Digital Print'
): { tasks: GeneratedTask[]; requiresManualInput: boolean; reasons: string[] } {
  const tasks: GeneratedTask[] = [];
  const reasons: string[] = [];
  let requiresManualInput = false;

  const spec = findSpec(group, specName);
  if (!spec) {
    return { tasks, requiresManualInput, reasons };
  }

  const application = spec.values.application || spec.values.colours || '';
  const colour = spec.values.colour || spec.values.colours || '';
  const colourNote = colour ? `Colour: ${colour}` : null;

  // Normalize application value for comparison
  const normalizedApp = application.toLowerCase().replace(/[,\s]+/g, ' ').trim();

  if (normalizedApp.includes('face') && normalizedApp.includes('full')) {
    // Face, Full → Vinyl Face Before Cutting
    tasks.push({
      taskName: 'Vinyl Face Before Cutting',
      assignedRole: getRole('Vinyl Face Before Cutting'),
      notes: colourNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Vinyl Face Before Cutting')
    });
  } else if (
    normalizedApp.includes('face') &&
    (normalizedApp.includes('white keyline') || normalizedApp.includes('custom cut'))
  ) {
    // Face, White Keyline OR Face, Custom Cut → Vinyl Plotting + Vinyl Face After Cutting
    tasks.push({
      taskName: 'Vinyl Plotting',
      assignedRole: getRole('Vinyl Plotting'),
      notes: colourNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Vinyl Plotting')
    });
    tasks.push({
      taskName: 'Vinyl Face After Cutting',
      assignedRole: getRole('Vinyl Face After Cutting'),
      notes: colourNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Vinyl Face After Cutting')
    });
  } else if (
    normalizedApp.includes('return wrap') ||
    normalizedApp.includes('trim wrap') ||
    (normalizedApp.includes('return') && normalizedApp.includes('trim') && normalizedApp.includes('wrap'))
  ) {
    // Return Wrap, Trim Wrap, or Return & Trim Wrap → Vinyl Plotting + Vinyl Wrap Return/Trim
    tasks.push({
      taskName: 'Vinyl Plotting',
      assignedRole: getRole('Vinyl Plotting'),
      notes: colourNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Vinyl Plotting')
    });
    tasks.push({
      taskName: 'Vinyl Wrap Return/Trim',
      assignedRole: getRole('Vinyl Wrap Return/Trim'),
      notes: colourNote,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Vinyl Wrap Return/Trim')
    });
  } else if (normalizedApp.includes('face') && normalizedApp.includes('return') && normalizedApp.includes('wrap')) {
    // Face & Return Wrap → MANUAL INPUT REQUIRED
    requiresManualInput = true;
    reasons.push(`${specName} application "Face & Return Wrap" requires manual task selection`);
  } else if (application) {
    // Unknown application value - add generic vinyl task with note
    tasks.push({
      taskName: 'Vinyl Plotting',
      assignedRole: getRole('Vinyl Plotting'),
      notes: `${application}${colour ? `, ${colour}` : ''}`,
      partId,
      orderId,
      sortOrder: getTaskSortOrder('Vinyl Plotting')
    });
  }

  return { tasks, requiresManualInput, reasons };
}
