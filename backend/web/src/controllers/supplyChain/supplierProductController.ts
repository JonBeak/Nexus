// Phase 4.c: Supplier Product Controller
// Purpose: HTTP request/response handling for supplier products
// Created: 2025-12-19

import { Request, Response } from 'express';
import { SupplierProductService } from '../../services/supplyChain/supplierProductService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';

const service = new SupplierProductService();

/**
 * Get all supplier products with optional filtering
 */
export const getSupplierProducts = async (req: Request, res: Response): Promise<void> => {
  const { archetype_id, supplier_id, search, active_only, has_price } = req.query;

  const result = await service.getSupplierProducts({
    archetype_id: archetype_id ? parseInt(archetype_id as string) : undefined,
    supplier_id: supplier_id ? parseInt(supplier_id as string) : undefined,
    search: search as string | undefined,
    active_only: active_only === 'false' ? false : true,
    has_price: has_price ? has_price === 'true' : undefined
  });

  handleServiceResult(res, result);
};

/**
 * Get supplier products for specific archetype
 */
export const getSupplierProductsByArchetype = async (req: Request, res: Response): Promise<void> => {
  const archetypeId = parseIntParam(req.params.archetypeId, 'Archetype ID');
  if (archetypeId === null) {
    return sendErrorResponse(res, 'Invalid archetype ID', 'VALIDATION_ERROR');
  }

  const result = await service.getSupplierProductsByArchetype(archetypeId);
  handleServiceResult(res, result);
};

/**
 * Get single supplier product by ID
 */
export const getSupplierProductById = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const result = await service.getSupplierProductById(id);
  handleServiceResult(res, result);
};

/**
 * Create new supplier product
 */
export const createSupplierProduct = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const {
    archetype_id,
    supplier_id,
    brand_name,
    sku,
    product_name,
    min_order_quantity,
    lead_time_days,
    unit_of_measure,
    specifications,
    notes,
    is_preferred,
    initial_price
  } = req.body;

  const result = await service.createSupplierProduct(
    {
      archetype_id,
      supplier_id,
      brand_name,
      sku,
      product_name,
      min_order_quantity,
      lead_time_days,
      unit_of_measure,
      specifications,
      notes,
      is_preferred,
      initial_price
    },
    user?.user_id
  );

  if (result.success) {
    // Fetch and return the full product data with pricing
    const productResult = await service.getSupplierProductById(result.data);
    handleServiceResult(res, productResult);
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Update supplier product
 */
export const updateSupplierProduct = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const result = await service.updateSupplierProduct(id, req.body, user?.user_id);

  if (result.success) {
    res.json({ success: true, data: null });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Delete supplier product (soft delete)
 */
export const deleteSupplierProduct = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const result = await service.deleteSupplierProduct(id, user?.user_id);
  handleServiceResult(res, result);
};

/**
 * Add new price to supplier product
 */
export const addPrice = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const { unit_price, cost_currency, effective_start_date, notes } = req.body;

  const result = await service.addPrice(
    id,
    {
      unit_price,
      cost_currency,
      effective_start_date: effective_start_date ? new Date(effective_start_date) : new Date(),
      notes
    },
    user?.user_id
  );

  if (result.success) {
    res.json({
      success: true,
      data: {
        pricing_id: result.data?.pricing_id,
        alert: result.data?.alert || false,
        change_percent: result.data?.change_percent
      }
    });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Get price history for supplier product
 */
export const getPriceHistory = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const result = await service.getPriceHistory(id);
  handleServiceResult(res, result);
};

/**
 * Get price range for archetype
 */
export const getArchetypePriceRange = async (req: Request, res: Response): Promise<void> => {
  const archetypeId = parseIntParam(req.params.archetypeId, 'Archetype ID');
  if (archetypeId === null) {
    return sendErrorResponse(res, 'Invalid archetype ID', 'VALIDATION_ERROR');
  }

  const result = await service.getPriceRange(archetypeId);
  handleServiceResult(res, result);
};

/**
 * Get price ranges for multiple archetypes
 */
export const getArchetypePriceRanges = async (req: Request, res: Response): Promise<void> => {
  const { archetype_ids } = req.body;

  if (!Array.isArray(archetype_ids)) {
    return sendErrorResponse(res, 'archetype_ids must be an array', 'VALIDATION_ERROR');
  }

  const result = await service.getPriceRanges(archetype_ids);

  if (result.success) {
    const rangesObject: Record<number, any> = {};
    result.data?.forEach((range, archetypeId) => {
      rangesObject[archetypeId] = range;
    });

    res.json({
      success: true,
      data: rangesObject
    });
  } else {
    handleServiceResult(res, result);
  }
};
