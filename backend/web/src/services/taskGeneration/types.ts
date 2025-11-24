/**
 * Task Generation Types
 * Type definitions for spec-driven task generation
 */

import { ProductionRole } from '../../types/orders';

/**
 * Parsed specification from order part
 */
export interface ParsedSpec {
  templateName: string;  // e.g., "Return", "Trim", "Face", "Vinyl"
  values: Record<string, string>;  // e.g., { colour: "White", depth: "3\"", material: "2mm PC" }
}

/**
 * Part group for task generation (parent + sub-parts)
 */
export interface PartGroup {
  parentPartId: number;
  displayNumber: string;  // Base display number (e.g., "1", "2")
  specsDisplayName: string | null;  // e.g., "Front Lit", "Halo Lit"
  allSpecs: ParsedSpec[];  // Merged specs from parent + all sub-parts
  parts: PartInfo[];  // All parts in the group
}

/**
 * Basic part info for grouping
 */
export interface PartInfo {
  partId: number;
  displayNumber: string;
  isParent: boolean;
  specsDisplayName: string | null;
  specifications: Record<string, any>;
}

/**
 * Generated task before saving
 */
export interface GeneratedTask {
  taskName: string;
  assignedRole: ProductionRole;
  notes: string | null;
  partId: number;  // Always the parent part_id
  orderId: number;
  sortOrder: number;  // Position in canonical task order
}

/**
 * Result of task generation
 */
export interface TaskGenerationResult {
  tasksCreated: number;
  tasksByPart: { partId: number; displayNumber: string; tasks: GeneratedTask[] }[];
  requiresManualInput: boolean;
  manualInputReasons: string[];
  warnings: string[];
  paintingWarnings?: PaintingWarning[];
}

/**
 * Painting task warning (when matrix returns no tasks)
 */
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
 * Task rule definition
 */
export interface TaskRule {
  taskName: string;
  role: ProductionRole;
  noteTemplate?: string;  // Template for auto-generating notes
}
