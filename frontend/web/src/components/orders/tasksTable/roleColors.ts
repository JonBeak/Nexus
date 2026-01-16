/**
 * Role-based color mapping for Tasks Table
 * Maps ProductionRole values to Tailwind CSS classes
 *
 * NOTE: TASK_ORDER and TASK_ROLE_MAP are now served from the backend API.
 * Use TaskMetadataResource to fetch task metadata (ordering, role mapping, auto-hide columns).
 * This file only contains styling constants (ROLE_COLORS) and helper functions.
 */

export type ProductionRole =
  | 'designer'
  | 'manager'
  | 'vinyl_applicator'
  | 'cnc_router_operator'
  | 'cut_bender_operator'
  | 'return_fabricator'
  | 'trim_fabricator'
  | 'painter'
  | 'return_gluer'
  | 'mounting_assembler'
  | 'face_assembler'
  | 'led_installer'
  | 'backer_raceway_fabricator'
  | 'backer_raceway_assembler'
  | 'qc_packer';

export interface RoleColorConfig {
  headerBg: string;      // Header cell background
  headerText: string;    // Header text color
  cellBg: string;        // Task cell background
  completedBg: string;   // Completed task background
  checkmark: string;     // Checkmark icon color
  border: string;        // Border color
  ring: string;          // Inset ring color for cell outline
}

/**
 * Color categories:
 * - Design/Vinyl: Blue (#3B82F6)
 * - Painter: Purple (#A855F7)
 * - LEDs: Yellow (#EAB308)
 * - Cut & Bend: Orange (#F97316)
 * - CNC Router: Red (#EF4444)
 * - Fabricators: Teal (#14B8A6)
 * - Manager: Gray (#6B7280)
 */
export const ROLE_COLORS: Record<ProductionRole, RoleColorConfig> = {
  // Design/Vinyl - Blue
  designer: {
    headerBg: 'bg-blue-100',
    headerText: 'text-blue-800',
    cellBg: 'bg-blue-100',
    completedBg: 'bg-blue-200',
    checkmark: 'text-blue-600',
    border: 'border-blue-300',
    ring: 'ring-blue-300'
  },
  vinyl_applicator: {
    headerBg: 'bg-blue-100',
    headerText: 'text-blue-800',
    cellBg: 'bg-blue-100',
    completedBg: 'bg-blue-200',
    checkmark: 'text-blue-600',
    border: 'border-blue-300',
    ring: 'ring-blue-300'
  },

  // Painter - Purple
  painter: {
    headerBg: 'bg-purple-100',
    headerText: 'text-purple-800',
    cellBg: 'bg-purple-100',
    completedBg: 'bg-purple-200',
    checkmark: 'text-purple-600',
    border: 'border-purple-300',
    ring: 'ring-purple-300'
  },

  // LEDs - Yellow
  led_installer: {
    headerBg: 'bg-yellow-100',
    headerText: 'text-yellow-800',
    cellBg: 'bg-yellow-100',
    completedBg: 'bg-yellow-200',
    checkmark: 'text-yellow-600',
    border: 'border-yellow-300',
    ring: 'ring-yellow-300'
  },

  // Cut & Bend - Orange
  cut_bender_operator: {
    headerBg: 'bg-orange-100',
    headerText: 'text-orange-800',
    cellBg: 'bg-orange-100',
    completedBg: 'bg-orange-200',
    checkmark: 'text-orange-600',
    border: 'border-orange-300',
    ring: 'ring-orange-300'
  },

  // CNC Router - Red
  cnc_router_operator: {
    headerBg: 'bg-red-100',
    headerText: 'text-red-800',
    cellBg: 'bg-red-100',
    completedBg: 'bg-red-200',
    checkmark: 'text-red-600',
    border: 'border-red-300',
    ring: 'ring-red-300'
  },

  // Fabricators - Teal
  trim_fabricator: {
    headerBg: 'bg-teal-100',
    headerText: 'text-teal-800',
    cellBg: 'bg-teal-100',
    completedBg: 'bg-teal-200',
    checkmark: 'text-teal-600',
    border: 'border-teal-300',
    ring: 'ring-teal-300'
  },
  return_fabricator: {
    headerBg: 'bg-teal-100',
    headerText: 'text-teal-800',
    cellBg: 'bg-teal-100',
    completedBg: 'bg-teal-200',
    checkmark: 'text-teal-600',
    border: 'border-teal-300',
    ring: 'ring-teal-300'
  },
  return_gluer: {
    headerBg: 'bg-teal-100',
    headerText: 'text-teal-800',
    cellBg: 'bg-teal-100',
    completedBg: 'bg-teal-200',
    checkmark: 'text-teal-600',
    border: 'border-teal-300',
    ring: 'ring-teal-300'
  },
  mounting_assembler: {
    headerBg: 'bg-sky-100',
    headerText: 'text-sky-800',
    cellBg: 'bg-sky-100',
    completedBg: 'bg-sky-200',
    checkmark: 'text-sky-600',
    border: 'border-sky-300',
    ring: 'ring-sky-300'
  },
  face_assembler: {
    headerBg: 'bg-sky-100',
    headerText: 'text-sky-800',
    cellBg: 'bg-sky-100',
    completedBg: 'bg-sky-200',
    checkmark: 'text-sky-600',
    border: 'border-sky-300',
    ring: 'ring-sky-300'
  },
  backer_raceway_fabricator: {
    headerBg: 'bg-indigo-100',
    headerText: 'text-indigo-800',
    cellBg: 'bg-indigo-100',
    completedBg: 'bg-indigo-200',
    checkmark: 'text-indigo-600',
    border: 'border-indigo-300',
    ring: 'ring-indigo-300'
  },
  backer_raceway_assembler: {
    headerBg: 'bg-indigo-100',
    headerText: 'text-indigo-800',
    cellBg: 'bg-indigo-100',
    completedBg: 'bg-indigo-200',
    checkmark: 'text-indigo-600',
    border: 'border-indigo-300',
    ring: 'ring-indigo-300'
  },

  // Manager / QC - Slate
  manager: {
    headerBg: 'bg-slate-100',
    headerText: 'text-slate-700',
    cellBg: 'bg-slate-100',
    completedBg: 'bg-slate-200',
    checkmark: 'text-slate-600',
    border: 'border-slate-300',
    ring: 'ring-slate-300'
  },
  qc_packer: {
    headerBg: 'bg-slate-100',
    headerText: 'text-slate-700',
    cellBg: 'bg-slate-100',
    completedBg: 'bg-slate-200',
    checkmark: 'text-slate-600',
    border: 'border-slate-300',
    ring: 'ring-slate-300'
  }
};

/**
 * Get role color config, with fallback for unknown roles
 */
export function getRoleColors(role: string | null | undefined): RoleColorConfig {
  if (role && role in ROLE_COLORS) {
    return ROLE_COLORS[role as ProductionRole];
  }
  // Default to gray for unknown roles
  return ROLE_COLORS.manager;
}

/**
 * Get role for a task key using pre-fetched role map
 * For synchronous usage when metadata is already loaded from TaskMetadataResource
 *
 * @param taskKey - Column key (handles indexed keys like "TaskName#2")
 * @param taskRoleMap - Pre-fetched role map from TaskMetadataResource
 * @returns ProductionRole for the task, defaults to 'manager' if not found
 */
export function getTaskRoleSync(
  taskKey: string,
  taskRoleMap: Record<string, ProductionRole>
): ProductionRole {
  // Extract base task name from column key (strip #N suffix if present)
  const hashIndex = taskKey.lastIndexOf('#');
  const taskName = (hashIndex > 0 && /^\d+$/.test(taskKey.slice(hashIndex + 1)))
    ? taskKey.slice(0, hashIndex)
    : taskKey;
  return taskRoleMap[taskName] || 'manager';
}
