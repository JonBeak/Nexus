// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added import: handleServiceResult from controllerHelpers
// - Updated service layer to return ServiceResult<PowerSupply[]>
// - Replaced manual res.json() with handleServiceResult() helper
// - Zero breaking changes - endpoint continues to work as expected
//
// File Clean up Finished: Nov 14, 2025
// Changes:
// - Migrated from direct pool.execute() to query() helper via repository layer
// - Implemented full 3-layer architecture (Route → Controller → Service → Repository)
// - Created PowerSupplyRepository for database access (findAllActive, findByFuzzyMatch, etc.)
// - Created PowerSupplyService for business logic
// - Controller now contains ONLY HTTP handling logic
// - Enhanced error handling and logging
// - Added proper TypeScript types from repository
/**
 * Power Supply Controller
 *
 * HTTP request/response handlers for power supply product management
 * Created: Nov 14, 2025 during powerSuppliesController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { Request, Response } from 'express';
import { PowerSupplyService } from '../services/powerSupplyService';
import { handleServiceResult } from '../utils/controllerHelpers';

const powerSupplyService = new PowerSupplyService();

/**
 * GET /api/power-supplies
 * Get all active power supply types for specification dropdowns
 */
export const getActivePowerSupplies = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await powerSupplyService.getActivePowerSupplies();
    handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error fetching active power supplies:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch power supply types'
    });
  }
};
