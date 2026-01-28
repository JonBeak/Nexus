// File Clean up Finished: Nov 14, 2025
// Changes:
// - Removed 11 redundant auth checks (middleware guarantees user exists)
// - Replaced all ID validation with parseIntParam() helper
// - Replaced error handling with handleServiceResult() and sendErrorResponse()
// - Changed Request param to AuthRequest for type safety
// - Added non-null assertions (req.user!) since auth middleware guarantees user
// - Reduced from 462 → 217 lines (53% reduction)
/**
 * Vinyl Inventory Controller
 * HTTP layer for vinyl inventory management
 */

import { Request, Response } from 'express';
import { VinylInventoryService } from '../../services/vinyl/vinylInventoryService';
import { AuthRequest } from '../../types';
import {
  VinylInventoryFilters,
  CreateVinylItemRequest,
  UpdateVinylItemRequest,
  MarkVinylAsUsedRequest,
  StatusChangeRequest
} from '../../types/vinyl';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Get all vinyl inventory items with optional filters
 */
export const getVinylItems = async (req: AuthRequest, res: Response) => {
  try {
    const filters: VinylInventoryFilters = {
      disposition: req.query.disposition as any,
      search: req.query.search as string,
      brand: req.query.brand as string,
      series: req.query.series as string,
      location: req.query.location as string,
      supplier_id: req.query.supplier_id ? parseInt(req.query.supplier_id as string) : undefined,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const result = await VinylInventoryService.getVinylItems(req.user!, filters);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch vinyl inventory', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get single vinyl item by ID
 */
export const getVinylItemById = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseIntParam(req.params.id, 'vinyl item ID');
    if (id === null) {
      return sendErrorResponse(res, 'Invalid vinyl item ID', 'VALIDATION_ERROR');
    }

    const result = await VinylInventoryService.getVinylItemById(req.user!, id);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch vinyl item', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Create new vinyl inventory item
 */
export const createVinylItem = async (req: AuthRequest, res: Response) => {
  try {
    const data: CreateVinylItemRequest = req.body;
    const result = await VinylInventoryService.createVinylItem(req.user!, data);
    handleServiceResult(res, result, { successStatus: 201 });
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to create vinyl item', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Update vinyl inventory item
 */
export const updateVinylItem = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseIntParam(req.params.id, 'vinyl item ID');
    if (id === null) {
      return sendErrorResponse(res, 'Invalid vinyl item ID', 'VALIDATION_ERROR');
    }

    const data: UpdateVinylItemRequest = req.body;
    const result = await VinylInventoryService.updateVinylItem(req.user!, id, data);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to update vinyl item', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Mark vinyl as used with optional job associations
 */
export const markVinylAsUsed = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseIntParam(req.params.id, 'vinyl item ID');
    if (id === null) {
      return sendErrorResponse(res, 'Invalid vinyl item ID', 'VALIDATION_ERROR');
    }

    const data: MarkVinylAsUsedRequest = req.body;
    const result = await VinylInventoryService.markVinylAsUsed(req.user!, id, data);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to mark vinyl as used', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Update order associations for vinyl item
 */
export const updateOrderLinks = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseIntParam(req.params.id, 'vinyl item ID');
    if (id === null) {
      return sendErrorResponse(res, 'Invalid vinyl item ID', 'VALIDATION_ERROR');
    }

    const { order_ids } = req.body;
    if (!Array.isArray(order_ids)) {
      return sendErrorResponse(res, 'order_ids must be an array', 'VALIDATION_ERROR');
    }

    const result = await VinylInventoryService.updateOrderLinks(req.user!, id, order_ids);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to update order associations', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Delete vinyl inventory item
 */
export const deleteVinylItem = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseIntParam(req.params.id, 'vinyl item ID');
    if (id === null) {
      return sendErrorResponse(res, 'Invalid vinyl item ID', 'VALIDATION_ERROR');
    }

    const result = await VinylInventoryService.deleteVinylItem(req.user!, id);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to delete vinyl item', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get vinyl inventory statistics
 */
export const getVinylStats = async (req: AuthRequest, res: Response) => {
  try {
    const result = await VinylInventoryService.getVinylStats(req.user!);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch vinyl statistics', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get recent vinyl items for copying
 */
export const getRecentVinylForCopying = async (req: AuthRequest, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const result = await VinylInventoryService.getRecentVinylForCopying(req.user!, limit);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch recent vinyl items', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Handle status changes (used, waste, returned)
 */
export const changeVinylStatus = async (req: AuthRequest, res: Response) => {
  try {
    const data: StatusChangeRequest = req.body;

    // Validate required fields
    if (!data.vinyl_id || !data.disposition) {
      return sendErrorResponse(res, 'vinyl_id and disposition are required', 'VALIDATION_ERROR');
    }

    const result = await VinylInventoryService.changeVinylStatus(req.user!, data);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to change vinyl status', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get order links for a vinyl item
 */
export const getOrderLinks = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseIntParam(req.params.id, 'vinyl item ID');
    if (id === null) {
      return sendErrorResponse(res, 'Invalid vinyl item ID', 'VALIDATION_ERROR');
    }

    // Get the vinyl item which includes order associations
    const result = await VinylInventoryService.getVinylItemById(req.user!, id);

    if (result.success) {
      res.json({
        success: true,
        data: result.data.order_associations || []
      });
    } else {
      sendErrorResponse(res, result.error || 'Failed to fetch order associations', result.code);
    }
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch order associations', 'INTERNAL_ERROR', error.message);
  }
};