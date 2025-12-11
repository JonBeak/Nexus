/**
 * Task Metadata Controller
 *
 * Serves canonical task metadata (TASK_ORDER, TASK_ROLE_MAP, AUTO_HIDE_COLUMNS)
 * as the SINGLE SOURCE OF TRUTH for task configuration.
 *
 * Frontend should fetch from this endpoint rather than maintaining duplicates.
 */

import { Request, Response } from 'express';
import { TASK_ORDER, TASK_ROLE_MAP } from '../../services/taskGeneration/taskRules';

/**
 * Tasks that should be auto-hidden in the TasksTable when no data exists on the current page.
 * These are typically less common tasks that don't need to be shown by default.
 */
const AUTO_HIDE_COLUMNS: string[] = [
  'Vinyl Plotting',
  'Sanding (320) before cutting',
  'Scuffing before cutting',
  'Paint before cutting',
  'Vinyl Face Before Cutting',
  'Vinyl Wrap Return/Trim',
  'Sanding (320) after cutting',
  'Scuffing after cutting',
  'Paint After Cutting',
  'Backer / Raceway Bending',
  'Paint After Bending',
  'Vinyl Face After Cutting',
  'Vinyl after Fabrication',
  'Paint after Fabrication',
  'Laser Cut'
];

/**
 * Get task metadata (TASK_ORDER, TASK_ROLE_MAP, AUTO_HIDE_COLUMNS)
 * GET /api/orders/metadata/tasks
 * Permission: orders.view
 *
 * Returns the canonical task configuration that the frontend uses for:
 * - Column ordering in the Tasks Table
 * - Role-based color coding
 * - Auto-hide behavior for sparse columns
 */
export const getTaskMetadata = async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        taskOrder: TASK_ORDER,
        taskRoleMap: TASK_ROLE_MAP,
        autoHideColumns: AUTO_HIDE_COLUMNS
      }
    });
  } catch (error) {
    console.error('Error fetching task metadata:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task metadata'
    });
  }
};
