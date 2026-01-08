// FINISHED: Migrated to ServiceResult<T> system - Completed 2025-11-15
// Changes:
// - Added import: handleServiceResult from controllerHelpers
// - Updated service layer to return ServiceResult<LED[]>
// - Replaced manual res.json() with handleServiceResult() helper
// - Zero breaking changes - endpoint continues to work as expected
//
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
import { handleServiceResult } from '../utils/controllerHelpers';

const ledService = new LEDService();

/**
 * GET /api/leds
 * Get all active LED types for specification dropdowns
 */
export const getActiveLEDs = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ledService.getActiveLEDs();
    handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error fetching active LEDs:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch LED types'
    });
  }
};

/**
 * GET /api/leds/all
 * Get all LED types including inactive (for management UI)
 */
export const getAllLEDs = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const result = await ledService.getAllLEDs(includeInactive);
    handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error fetching all LEDs:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch LED types'
    });
  }
};

/**
 * POST /api/leds
 * Create a new LED type
 */
export const createLED = async (req: Request, res: Response): Promise<void> => {
  try {
    const { product_code, colour, watts, volts, brand, model, supplier, price, lumens, is_default } = req.body;
    const result = await ledService.createLED({
      product_code,
      colour,
      watts: watts ? parseFloat(watts) : undefined,
      volts: volts ? parseInt(volts) : undefined,
      brand,
      model,
      supplier,
      price: price ? parseFloat(price) : undefined,
      lumens,
      is_default: Boolean(is_default)
    });
    handleServiceResult(res, result, { successStatus: 201 });
  } catch (error) {
    console.error('Controller error creating LED:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create LED type'
    });
  }
};

/**
 * PUT /api/leds/:ledId
 * Update an existing LED type
 */
export const updateLED = async (req: Request, res: Response): Promise<void> => {
  try {
    const ledId = parseInt(req.params.ledId);
    if (isNaN(ledId)) {
      res.status(400).json({ success: false, message: 'Invalid LED ID' });
      return;
    }

    const updates: Record<string, unknown> = {};
    const { product_code, colour, watts, volts, brand, model, supplier, price, lumens, is_default, is_active } = req.body;

    if (product_code !== undefined) updates.product_code = product_code;
    if (colour !== undefined) updates.colour = colour;
    if (watts !== undefined) updates.watts = watts ? parseFloat(watts) : null;
    if (volts !== undefined) updates.volts = volts ? parseInt(volts) : null;
    if (brand !== undefined) updates.brand = brand;
    if (model !== undefined) updates.model = model;
    if (supplier !== undefined) updates.supplier = supplier;
    if (price !== undefined) updates.price = price ? parseFloat(price) : null;
    if (lumens !== undefined) updates.lumens = lumens;
    if (is_default !== undefined) updates.is_default = Boolean(is_default);
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    const result = await ledService.updateLED(ledId, updates);
    handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error updating LED:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update LED type'
    });
  }
};

/**
 * DELETE /api/leds/:ledId
 * Deactivate an LED type (soft delete)
 */
export const deactivateLED = async (req: Request, res: Response): Promise<void> => {
  try {
    const ledId = parseInt(req.params.ledId);
    if (isNaN(ledId)) {
      res.status(400).json({ success: false, message: 'Invalid LED ID' });
      return;
    }

    const result = await ledService.deactivateLED(ledId);
    handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error deactivating LED:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to deactivate LED type'
    });
  }
};
