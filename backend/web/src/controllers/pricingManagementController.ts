/**
 * Pricing Management Controller - HTTP handling for generic pricing CRUD
 *
 * Validates tableKey against whitelist, type-converts request body,
 * and delegates to the service layer.
 */

import { Request, Response } from 'express';
import { pricingManagementService } from '../services/pricingManagementService';
import { handleServiceResult, parseIntParam } from '../utils/controllerHelpers';
import { getTableDefinition } from '../config/pricingTableDefinitions';

/**
 * GET /api/pricing-management/:tableKey
 * Get all rows for a pricing table
 */
export const getRows = async (req: Request, res: Response) => {
  try {
    const { tableKey } = req.params;
    const includeInactive = req.query.includeInactive === 'true';

    const result = await pricingManagementService.getRows(tableKey, includeInactive);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('Error in getRows:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pricing data' });
  }
};

/**
 * POST /api/pricing-management/:tableKey
 * Create a new row
 */
export const createRow = async (req: Request, res: Response) => {
  try {
    const { tableKey } = req.params;
    const userId = (req as any).user?.id;

    const result = await pricingManagementService.createRow(tableKey, req.body, userId);
    return handleServiceResult(res, result, { successStatus: 201 });
  } catch (error) {
    console.error('Error in createRow:', error);
    res.status(500).json({ success: false, error: 'Failed to create pricing record' });
  }
};

/**
 * PUT /api/pricing-management/:tableKey/:id
 * Update an existing row
 */
export const updateRow = async (req: Request, res: Response) => {
  try {
    const { tableKey, id } = req.params;
    const userId = (req as any).user?.id;

    // Determine if ID is numeric or string based on table definition
    const def = getTableDefinition(tableKey);
    if (!def) {
      return res.status(404).json({ success: false, error: `Unknown pricing table: ${tableKey}` });
    }

    const parsedId = def.autoIncrement ? parseIntParam(id, 'ID') : parseInt(id);
    if (parsedId === null || isNaN(parsedId)) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const result = await pricingManagementService.updateRow(tableKey, parsedId, req.body, userId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('Error in updateRow:', error);
    res.status(500).json({ success: false, error: 'Failed to update pricing record' });
  }
};

/**
 * DELETE /api/pricing-management/:tableKey/:id
 * Deactivate (soft delete) a row
 */
export const deactivateRow = async (req: Request, res: Response) => {
  try {
    const { tableKey, id } = req.params;
    const userId = (req as any).user?.id;

    const parsedId = parseIntParam(id, 'ID');
    if (parsedId === null) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const result = await pricingManagementService.deactivateRow(tableKey, parsedId, userId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('Error in deactivateRow:', error);
    res.status(500).json({ success: false, error: 'Failed to deactivate record' });
  }
};

/**
 * PUT /api/pricing-management/:tableKey/:id/restore
 * Restore (reactivate) a row
 */
export const restoreRow = async (req: Request, res: Response) => {
  try {
    const { tableKey, id } = req.params;
    const userId = (req as any).user?.id;

    const parsedId = parseIntParam(id, 'ID');
    if (parsedId === null) {
      return res.status(400).json({ success: false, error: 'Invalid ID parameter' });
    }

    const result = await pricingManagementService.restoreRow(tableKey, parsedId, userId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('Error in restoreRow:', error);
    res.status(500).json({ success: false, error: 'Failed to restore record' });
  }
};
