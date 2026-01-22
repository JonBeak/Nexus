// File Clean up Finished: Nov 14, 2025
// Changes:
// - Removed 13 redundant auth checks (middleware guarantees user exists)
// - Replaced all ID validation with parseIntParam() helper
// - Replaced error handling with handleServiceResult() and sendErrorResponse()
// - Changed Request param to AuthRequest for type safety
// - Added non-null assertions (req.user!) since auth middleware guarantees user
// - Reduced from 507 → 260 lines (49% reduction)

/**
 * Vinyl Products Controller
 * HTTP layer for vinyl products catalog management
 */

import { Response } from 'express';
import { VinylProductsService } from '../../services/vinyl/vinylProductsService';
import { AuthRequest } from '../../types';
import {
  VinylProductsFilters,
  CreateVinylProductRequest,
  UpdateVinylProductRequest
} from '../../types/vinyl';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Get all vinyl products with optional filters
 */
export const getVinylProducts = async (req: AuthRequest, res: Response) => {
  try {
    const filters: VinylProductsFilters = {
      search: req.query.search as string,
      brand: req.query.brand as string,
      series: req.query.series as string,
      is_active: req.query.is_active ? req.query.is_active === 'true' : undefined,
      has_inventory: req.query.has_inventory ? req.query.has_inventory === 'true' : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const result = await VinylProductsService.getVinylProducts(req.user!, filters);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch vinyl products', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get single vinyl product by ID
 */
export const getVinylProductById = async (req: AuthRequest, res: Response) => {
  try {
    const productId = parseIntParam(req.params.id, 'product ID');
    if (productId === null) {
      return sendErrorResponse(res, 'Invalid product ID', 'VALIDATION_ERROR');
    }

    const result = await VinylProductsService.getVinylProductById(req.user!, productId);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch vinyl product', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Create new vinyl product
 */
export const createVinylProduct = async (req: AuthRequest, res: Response) => {
  try {
    const data: CreateVinylProductRequest = req.body;
    const result = await VinylProductsService.createVinylProduct(req.user!, data);
    handleServiceResult(res, result, { successStatus: 201 });
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to create vinyl product', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Update vinyl product
 */
export const updateVinylProduct = async (req: AuthRequest, res: Response) => {
  try {
    const productId = parseIntParam(req.params.id, 'product ID');
    if (productId === null) {
      return sendErrorResponse(res, 'Invalid product ID', 'VALIDATION_ERROR');
    }

    const data: UpdateVinylProductRequest = req.body;
    const result = await VinylProductsService.updateVinylProduct(req.user!, productId, data);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to update vinyl product', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Delete vinyl product (soft delete)
 */
export const deleteVinylProduct = async (req: AuthRequest, res: Response) => {
  try {
    const productId = parseIntParam(req.params.id, 'product ID');
    if (productId === null) {
      return sendErrorResponse(res, 'Invalid product ID', 'VALIDATION_ERROR');
    }

    const result = await VinylProductsService.deleteVinylProduct(req.user!, productId);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to delete vinyl product', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get vinyl product statistics
 */
export const getVinylProductStats = async (req: AuthRequest, res: Response) => {
  try {
    const result = await VinylProductsService.getVinylProductStats(req.user!);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch vinyl product statistics', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get autofill suggestions for product forms
 */
export const getAutofillSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const result = await VinylProductsService.getAutofillSuggestions(req.user!);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch autofill suggestions', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get active products only
 */
export const getActiveProducts = async (req: AuthRequest, res: Response) => {
  try {
    const result = await VinylProductsService.getActiveProducts(req.user!);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch active products', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Search products
 */
export const searchProducts = async (req: AuthRequest, res: Response) => {
  try {
    const searchTerm = req.query.q as string;
    if (!searchTerm || searchTerm.trim() === '') {
      return sendErrorResponse(res, 'Search term is required', 'VALIDATION_ERROR');
    }

    const activeOnly = req.query.active_only === 'true';
    const result = await VinylProductsService.searchProducts(req.user!, searchTerm, { activeOnly });
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to search products', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Toggle product active status
 */
export const toggleProductStatus = async (req: AuthRequest, res: Response) => {
  try {
    const productId = parseIntParam(req.params.id, 'product ID');
    if (productId === null) {
      return sendErrorResponse(res, 'Invalid product ID', 'VALIDATION_ERROR');
    }

    const result = await VinylProductsService.toggleProductStatus(req.user!, productId);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to toggle product status', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get products by brand
 */
export const getProductsByBrand = async (req: AuthRequest, res: Response) => {
  try {
    const brand = req.params.brand;
    if (!brand || brand.trim() === '') {
      return sendErrorResponse(res, 'Brand is required', 'VALIDATION_ERROR');
    }

    const result = await VinylProductsService.getProductsByBrand(req.user!, brand);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch products by brand', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Bulk update products
 */
export const bulkUpdateProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return sendErrorResponse(res, 'updates must be an array', 'VALIDATION_ERROR');
    }

    const result = await VinylProductsService.bulkUpdateProducts(req.user!, updates);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to bulk update products', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Sync product from inventory
 */
export const syncProductFromInventory = async (req: AuthRequest, res: Response) => {
  try {
    const inventoryData = req.body;
    if (!inventoryData.brand || !inventoryData.series) {
      return sendErrorResponse(res, 'Brand and series are required', 'VALIDATION_ERROR');
    }

    const result = await VinylProductsService.syncProductFromInventory(req.user!, inventoryData);
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to sync product from inventory', 'INTERNAL_ERROR', error.message);
  }
};

/**
 * Get vinyl colour options for specification dropdown
 * Returns formatted strings for combobox: "{Series}-{ColourNumber} {ColourName}"
 */
export const getColourOptions = async (req: AuthRequest, res: Response) => {
  try {
    const result = await VinylProductsService.getColourOptions();
    handleServiceResult(res, result);
  } catch (error: any) {
    sendErrorResponse(res, 'Failed to fetch vinyl colour options', 'INTERNAL_ERROR', error.message);
  }
};
