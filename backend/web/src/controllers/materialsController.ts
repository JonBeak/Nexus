// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added imports: sendErrorResponse
// - Replaced 0 instances of parseInt() (none present)
// - Replaced 1 instance of manual res.status().json() with sendErrorResponse()
// - Service layer uses appropriate error handling

// File Clean up Finished: Nov 14, 2025
// Changes:
// - Migrated from direct pool.execute() to query() helper via repository layer
// - Implemented full 3-layer architecture (Route → Controller → Service → Repository)
// - Created SubstrateRepository for database access (findAllActiveNames, findByName, etc.)
// - Created SubstrateService for business logic (includes cost calculation helpers)
// - Controller now contains ONLY HTTP handling logic
// - Enhanced error handling and logging
// - Added proper TypeScript types from repository
/**
 * Materials Controller
 *
 * HTTP request/response handlers for substrate material management
 * Created: Nov 14, 2025 during materialsController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { Request, Response } from 'express';
import { SubstrateService } from '../services/substrateService';
import { sendErrorResponse } from '../utils/controllerHelpers';

const substrateService = new SubstrateService();

/**
 * GET /api/materials/substrates
 * Get all active substrate names for specification dropdowns
 */
export const getActiveSubstrates = async (req: Request, res: Response): Promise<void> => {
  try {
    const substrates = await substrateService.getActiveSubstrateNames();

    res.json({
      success: true,
      substrates
    });
  } catch (error) {
    console.error('Controller error fetching active substrates:', error);
    sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch substrate materials', 'INTERNAL_ERROR');
  }
};
