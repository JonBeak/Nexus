// File Clean up Finished: Nov 14, 2025
// Changes:
// - Migrated from direct pool.execute() to query() helper via repository layer
// - Implemented full 3-layer architecture (Route → Controller → Service → Repository)
// - Created LEDRepository for database access (findAllActive, findByFuzzyMatch, etc.)
// - Created LEDService for business logic
// - Controller now contains ONLY HTTP handling logic
// - Enhanced error handling and logging
// - Added proper TypeScript types from repository
/**
 * LED Controller
 *
 * HTTP request/response handlers for LED product management
 * Created: Nov 14, 2025 during ledsController.ts refactoring
 * Part of 3-layer architecture: Route → Controller → Service → Repository → Database
 */

import { Request, Response } from 'express';
import { LEDService } from '../services/ledService';

const ledService = new LEDService();

/**
 * GET /api/leds
 * Get all active LED types for specification dropdowns
 */
export const getActiveLEDs = async (req: Request, res: Response): Promise<void> => {
  try {
    const leds = await ledService.getActiveLEDs();

    res.json({
      success: true,
      leds
    });
  } catch (error) {
    console.error('Controller error fetching active LEDs:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch LED types'
    });
  }
};
