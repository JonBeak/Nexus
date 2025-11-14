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
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch substrate materials'
    });
  }
};
