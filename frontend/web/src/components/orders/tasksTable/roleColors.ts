/**
 * Role-based color mapping for Tasks Table
 * Maps ProductionRole values to Tailwind CSS classes
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
    cellBg: 'bg-blue-50',
    completedBg: 'bg-blue-100',
    checkmark: 'text-blue-600',
    border: 'border-blue-200'
  },
  vinyl_applicator: {
    headerBg: 'bg-blue-100',
    headerText: 'text-blue-800',
    cellBg: 'bg-blue-50',
    completedBg: 'bg-blue-100',
    checkmark: 'text-blue-600',
    border: 'border-blue-200'
  },

  // Painter - Purple
  painter: {
    headerBg: 'bg-purple-100',
    headerText: 'text-purple-800',
    cellBg: 'bg-purple-50',
    completedBg: 'bg-purple-100',
    checkmark: 'text-purple-600',
    border: 'border-purple-200'
  },

  // LEDs - Yellow
  led_installer: {
    headerBg: 'bg-yellow-100',
    headerText: 'text-yellow-800',
    cellBg: 'bg-yellow-50',
    completedBg: 'bg-yellow-100',
    checkmark: 'text-yellow-600',
    border: 'border-yellow-200'
  },

  // Cut & Bend - Orange
  cut_bender_operator: {
    headerBg: 'bg-orange-100',
    headerText: 'text-orange-800',
    cellBg: 'bg-orange-50',
    completedBg: 'bg-orange-100',
    checkmark: 'text-orange-600',
    border: 'border-orange-200'
  },

  // CNC Router - Red
  cnc_router_operator: {
    headerBg: 'bg-red-100',
    headerText: 'text-red-800',
    cellBg: 'bg-red-50',
    completedBg: 'bg-red-100',
    checkmark: 'text-red-600',
    border: 'border-red-200'
  },

  // Fabricators - Teal
  trim_fabricator: {
    headerBg: 'bg-teal-100',
    headerText: 'text-teal-800',
    cellBg: 'bg-teal-50',
    completedBg: 'bg-teal-100',
    checkmark: 'text-teal-600',
    border: 'border-teal-200'
  },
  return_fabricator: {
    headerBg: 'bg-teal-100',
    headerText: 'text-teal-800',
    cellBg: 'bg-teal-50',
    completedBg: 'bg-teal-100',
    checkmark: 'text-teal-600',
    border: 'border-teal-200'
  },
  return_gluer: {
    headerBg: 'bg-teal-100',
    headerText: 'text-teal-800',
    cellBg: 'bg-teal-50',
    completedBg: 'bg-teal-100',
    checkmark: 'text-teal-600',
    border: 'border-teal-200'
  },
  mounting_assembler: {
    headerBg: 'bg-sky-100',
    headerText: 'text-sky-800',
    cellBg: 'bg-sky-50',
    completedBg: 'bg-sky-100',
    checkmark: 'text-sky-600',
    border: 'border-sky-200'
  },
  face_assembler: {
    headerBg: 'bg-sky-100',
    headerText: 'text-sky-800',
    cellBg: 'bg-sky-50',
    completedBg: 'bg-sky-100',
    checkmark: 'text-sky-600',
    border: 'border-sky-200'
  },
  backer_raceway_fabricator: {
    headerBg: 'bg-indigo-100',
    headerText: 'text-indigo-800',
    cellBg: 'bg-indigo-50',
    completedBg: 'bg-indigo-100',
    checkmark: 'text-indigo-600',
    border: 'border-indigo-200'
  },
  backer_raceway_assembler: {
    headerBg: 'bg-indigo-100',
    headerText: 'text-indigo-800',
    cellBg: 'bg-indigo-50',
    completedBg: 'bg-indigo-100',
    checkmark: 'text-indigo-600',
    border: 'border-indigo-200'
  },

  // Manager / QC - Slate
  manager: {
    headerBg: 'bg-slate-100',
    headerText: 'text-slate-700',
    cellBg: 'bg-slate-50',
    completedBg: 'bg-slate-100',
    checkmark: 'text-slate-600',
    border: 'border-slate-200'
  },
  qc_packer: {
    headerBg: 'bg-slate-100',
    headerText: 'text-slate-700',
    cellBg: 'bg-slate-50',
    completedBg: 'bg-slate-100',
    checkmark: 'text-slate-600',
    border: 'border-slate-200'
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
 * Canonical task order (from backend taskRules.ts)
 * Used for column ordering in the Tasks Table
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
  'Face Assembling',
  'LEDs',
  'Backer / Raceway Fabrication',
  'Vinyl after Fabrication',
  'Paint after Fabrication',
  'Assembly'
];

/**
 * Task name to role mapping
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
  'Face Assembling': 'face_assembler',
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
 * Get role for a task key (handles composite keys like "taskName|notes")
 */
export function getTaskRole(taskKey: string): ProductionRole {
  // Extract base task name from composite key (before |)
  const taskName = taskKey.split('|')[0];
  return TASK_ROLE_MAP[taskName] || 'manager';
}
