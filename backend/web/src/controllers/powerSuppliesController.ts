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

/**
 * GET /api/power-supplies/all
 * Get all power supplies including inactive (for management UI)
 */
export const getAllPowerSupplies = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const result = await powerSupplyService.getAllPowerSupplies(includeInactive);
    handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error fetching all power supplies:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch power supplies'
    });
  }
};

/**
 * POST /api/power-supplies
 * Create a new power supply
 */
export const createPowerSupply = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      transformer_type,
      price,
      watts,
      rated_watts,
      volts,
      warranty_labour_years,
      warranty_product_years,
      notes,
      ul_listed,
      is_default_non_ul,
      is_default_ul
    } = req.body;

    const result = await powerSupplyService.createPowerSupply({
      transformer_type,
      price: price ? parseFloat(price) : undefined,
      watts: watts ? parseInt(watts) : undefined,
      rated_watts: rated_watts ? parseInt(rated_watts) : undefined,
      volts: volts ? parseInt(volts) : undefined,
      warranty_labour_years: warranty_labour_years ? parseInt(warranty_labour_years) : undefined,
      warranty_product_years: warranty_product_years ? parseInt(warranty_product_years) : undefined,
      notes,
      ul_listed: Boolean(ul_listed),
      is_default_non_ul: Boolean(is_default_non_ul),
      is_default_ul: Boolean(is_default_ul)
    });
    handleServiceResult(res, result, { successStatus: 201 });
  } catch (error) {
    console.error('Controller error creating power supply:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create power supply'
    });
  }
};

/**
 * PUT /api/power-supplies/:powerSupplyId
 * Update an existing power supply
 */
export const updatePowerSupply = async (req: Request, res: Response): Promise<void> => {
  try {
    const powerSupplyId = parseInt(req.params.powerSupplyId);
    if (isNaN(powerSupplyId)) {
      res.status(400).json({ success: false, message: 'Invalid power supply ID' });
      return;
    }

    const updates: Record<string, unknown> = {};
    const {
      transformer_type,
      price,
      watts,
      rated_watts,
      volts,
      warranty_labour_years,
      warranty_product_years,
      notes,
      ul_listed,
      is_default_non_ul,
      is_default_ul,
      is_active
    } = req.body;

    if (transformer_type !== undefined) updates.transformer_type = transformer_type;
    if (price !== undefined) updates.price = price ? parseFloat(price) : null;
    if (watts !== undefined) updates.watts = watts ? parseInt(watts) : null;
    if (rated_watts !== undefined) updates.rated_watts = rated_watts ? parseInt(rated_watts) : null;
    if (volts !== undefined) updates.volts = volts ? parseInt(volts) : null;
    if (warranty_labour_years !== undefined) updates.warranty_labour_years = warranty_labour_years ? parseInt(warranty_labour_years) : null;
    if (warranty_product_years !== undefined) updates.warranty_product_years = warranty_product_years ? parseInt(warranty_product_years) : null;
    if (notes !== undefined) updates.notes = notes;
    if (ul_listed !== undefined) updates.ul_listed = Boolean(ul_listed);
    if (is_default_non_ul !== undefined) updates.is_default_non_ul = Boolean(is_default_non_ul);
    if (is_default_ul !== undefined) updates.is_default_ul = Boolean(is_default_ul);
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    const result = await powerSupplyService.updatePowerSupply(powerSupplyId, updates);
    handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error updating power supply:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update power supply'
    });
  }
};

/**
 * DELETE /api/power-supplies/:powerSupplyId
 * Deactivate a power supply (soft delete)
 */
export const deactivatePowerSupply = async (req: Request, res: Response): Promise<void> => {
  try {
    const powerSupplyId = parseInt(req.params.powerSupplyId);
    if (isNaN(powerSupplyId)) {
      res.status(400).json({ success: false, message: 'Invalid power supply ID' });
      return;
    }

    const result = await powerSupplyService.deactivatePowerSupply(powerSupplyId);
    handleServiceResult(res, result);
  } catch (error) {
    console.error('Controller error deactivating power supply:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to deactivate power supply'
    });
  }
};
