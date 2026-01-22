/**
 * Task Metadata Controller
 *
 * Serves canonical task metadata (taskOrder, taskRoleMap, autoHideColumns)
 * as the SINGLE SOURCE OF TRUTH for task configuration.
 *
 * Data is now sourced from the database (task_definitions table) instead of
 * hardcoded arrays, allowing runtime configuration via Settings UI.
 *
 * Frontend should fetch from this endpoint rather than maintaining duplicates.
 */

import { Request, Response } from 'express';
import { settingsRepository } from '../../repositories/settingsRepository';
import { TASK_ORDER, TASK_ROLE_MAP } from '../../services/taskGeneration/taskRules';

// Hardcoded fallback for AUTO_HIDE_COLUMNS (used if DB query fails)
const FALLBACK_AUTO_HIDE_COLUMNS: string[] = [
  'Vinyl Plotting',
  'Sanding (320) before cutting',
  'Scuffing before cutting',
  'Paint before cutting',
  'Vinyl Before Cutting',
  'Vinyl Wrap Return/Trim',
  'Sanding (320) after cutting',
  'Scuffing after cutting',
  'Paint After Cutting',
  'Backer / Raceway Bending',
  'Paint After Bending',
  'Vinyl After Cutting',
  'Vinyl after Fabrication',
  'Paint after Fabrication',
  'Laser Cut',
  '3D Print',
  'Paper Pattern',
  'Vinyl Stencil',
  'UL',
  'Mounting Hardware',
  'Face Assembly',
  'Backer / Raceway Fabrication',
  'Assembly',
  'QC & Packing'
];

/**
 * Get task metadata (taskOrder, taskRoleMap, autoHideColumns)
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
    // Attempt to load from database
    const metadata = await settingsRepository.getTaskMetadata();

    // Validate we got data - if empty, fall back to hardcoded
    if (metadata.taskOrder.length === 0) {
      console.warn('[TaskMetadataController] Database returned empty task definitions, using hardcoded fallback');
      res.json({
        success: true,
        data: {
          taskOrder: TASK_ORDER,
          taskRoleMap: TASK_ROLE_MAP,
          autoHideColumns: FALLBACK_AUTO_HIDE_COLUMNS
        }
      });
      return;
    }

    res.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    console.error('Error fetching task metadata from database, using fallback:', error);

    // Fall back to hardcoded values on error
    res.json({
      success: true,
      data: {
        taskOrder: TASK_ORDER,
        taskRoleMap: TASK_ROLE_MAP,
        autoHideColumns: FALLBACK_AUTO_HIDE_COLUMNS
      }
    });
  }
};
