/**
 * Material Requirements Controller
 * HTTP request/response handling for material requirements
 * Created: 2025-01-27
 */

import { Request, Response } from 'express';
import { MaterialRequirementService } from '../../services/materialRequirementService';
import { MaterialRequirementHoldsService } from '../../services/materialRequirementHoldsService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';
import { MaterialRequirementStatus } from '../../types/materialRequirements';

const service = new MaterialRequirementService();
const holdsService = new MaterialRequirementHoldsService();

/**
 * Get all material requirements with optional filtering
 */
export const getMaterialRequirements = async (req: Request, res: Response): Promise<void> => {
  const {
    order_id,
    supplier_id,
    archetype_id,
    status,
    is_stock_item,
    entry_date_from,
    entry_date_to,
    search,
    limit,
    offset,
  } = req.query;

  // Parse status - can be single value or comma-separated
  let parsedStatus: MaterialRequirementStatus | MaterialRequirementStatus[] | undefined;
  if (status) {
    const statusStr = status as string;
    if (statusStr.includes(',')) {
      parsedStatus = statusStr.split(',') as MaterialRequirementStatus[];
    } else {
      parsedStatus = statusStr as MaterialRequirementStatus;
    }
  }

  const result = await service.getMaterialRequirements({
    order_id: order_id ? parseInt(order_id as string) : undefined,
    supplier_id: supplier_id ? parseInt(supplier_id as string) : undefined,
    archetype_id: archetype_id ? parseInt(archetype_id as string) : undefined,
    status: parsedStatus,
    is_stock_item: is_stock_item !== undefined ? is_stock_item === 'true' : undefined,
    entry_date_from: entry_date_from as string | undefined,
    entry_date_to: entry_date_to as string | undefined,
    search: search as string | undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });

  handleServiceResult(res, result);
};

/**
 * Get actionable requirements for Overview (pending/backordered)
 */
export const getActionableRequirements = async (req: Request, res: Response): Promise<void> => {
  const result = await service.getActionableRequirements();
  handleServiceResult(res, result);
};

/**
 * Get requirements for a specific order
 */
export const getRequirementsByOrderId = async (req: Request, res: Response): Promise<void> => {
  const orderId = parseIntParam(req.params.orderId, 'Order ID');
  if (orderId === null) {
    return sendErrorResponse(res, 'Invalid order ID', 'VALIDATION_ERROR');
  }

  const result = await service.getRequirementsByOrderId(orderId);
  handleServiceResult(res, result);
};

/**
 * Get single material requirement by ID
 */
export const getRequirementById = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const result = await service.getRequirementById(id);
  handleServiceResult(res, result);
};

/**
 * Create new material requirement
 */
export const createRequirement = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const {
    order_id,
    is_stock_item,
    archetype_id,
    custom_product_type,
    supplier_product_id,
    size_description,
    quantity_ordered,
    supplier_id,
    entry_date,
    expected_delivery_date,
    delivery_method,
    notes,
  } = req.body;

  const result = await service.createRequirement(
    {
      order_id,
      is_stock_item,
      archetype_id,
      custom_product_type,
      supplier_product_id,
      size_description,
      quantity_ordered,
      supplier_id,
      entry_date,
      expected_delivery_date,
      delivery_method,
      notes,
    },
    user?.user_id
  );

  if (result.success) {
    // Fetch and return the full requirement data
    const requirementResult = await service.getRequirementById(result.data);
    handleServiceResult(res, requirementResult, { successStatus: 201 });
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Update material requirement
 */
export const updateRequirement = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const result = await service.updateRequirement(id, req.body, user?.user_id);

  if (result.success) {
    // Fetch and return the updated requirement data
    const requirementResult = await service.getRequirementById(id);
    handleServiceResult(res, requirementResult);
  } else {
    handleServiceResult(res, result);
  }
};

/**
 * Receive quantity for a requirement (partial receipt support)
 */
export const receiveQuantity = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const { quantity, received_date, notes } = req.body;

  if (quantity === undefined || quantity <= 0) {
    return sendErrorResponse(res, 'Quantity to receive must be greater than 0', 'VALIDATION_ERROR');
  }

  const result = await service.receiveQuantity(
    id,
    { quantity, received_date, notes },
    user?.user_id
  );

  handleServiceResult(res, result);
};

/**
 * Bulk receive multiple requirements
 */
export const bulkReceive = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { items, received_date } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return sendErrorResponse(res, 'Items array is required', 'VALIDATION_ERROR');
  }

  const result = await service.bulkReceive({ items, received_date }, user?.user_id);
  handleServiceResult(res, result);
};

/**
 * Add requirements to shopping cart
 */
export const addToCart = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { requirement_ids, cart_id } = req.body;

  if (!Array.isArray(requirement_ids) || requirement_ids.length === 0) {
    return sendErrorResponse(res, 'requirement_ids array is required', 'VALIDATION_ERROR');
  }

  if (!cart_id) {
    return sendErrorResponse(res, 'cart_id is required', 'VALIDATION_ERROR');
  }

  const result = await service.addToCart(requirement_ids, cart_id, user?.user_id);
  handleServiceResult(res, result);
};

/**
 * Delete material requirement
 */
export const deleteRequirement = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const result = await service.deleteRequirement(id);
  handleServiceResult(res, result);
};

/**
 * Get recent orders for dropdown
 */
export const getRecentOrders = async (req: Request, res: Response): Promise<void> => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const result = await service.getRecentOrders(limit);
  handleServiceResult(res, result);
};

/**
 * Get status counts
 */
export const getStatusCounts = async (req: Request, res: Response): Promise<void> => {
  const result = await service.getStatusCounts();
  handleServiceResult(res, result);
};

/**
 * Get pending/backordered requirements grouped by supplier
 * Used for supplier order generation
 */
export const getGroupedBySupplier = async (req: Request, res: Response): Promise<void> => {
  const result = await service.getGroupedBySupplier();
  handleServiceResult(res, result);
};

// ===========================================================================
// INVENTORY HOLD ENDPOINTS
// ===========================================================================

/**
 * Check stock availability for a material requirement
 * Returns whether stock exists and what type (vinyl or general)
 */
export const checkStockAvailability = async (req: Request, res: Response): Promise<void> => {
  const { archetype_id, vinyl_product_id, supplier_product_id } = req.query;

  const result = await holdsService.checkStockAvailability(
    archetype_id ? parseInt(archetype_id as string) : null,
    vinyl_product_id ? parseInt(vinyl_product_id as string) : null,
    supplier_product_id ? parseInt(supplier_product_id as string) : null
  );

  handleServiceResult(res, result);
};

/**
 * Create a vinyl hold for a material requirement
 */
export const createVinylHold = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const { vinyl_id, quantity } = req.body;

  if (!vinyl_id) {
    return sendErrorResponse(res, 'vinyl_id is required', 'VALIDATION_ERROR');
  }
  if (!quantity) {
    return sendErrorResponse(res, 'quantity is required', 'VALIDATION_ERROR');
  }

  const result = await holdsService.createVinylHold(id, vinyl_id, quantity, user?.user_id);
  handleServiceResult(res, result, { successStatus: 201 });
};

/**
 * Create a general inventory hold for a material requirement
 */
export const createGeneralInventoryHold = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const { supplier_product_id, quantity } = req.body;

  if (!supplier_product_id) {
    return sendErrorResponse(res, 'supplier_product_id is required', 'VALIDATION_ERROR');
  }
  if (!quantity) {
    return sendErrorResponse(res, 'quantity is required', 'VALIDATION_ERROR');
  }

  const result = await holdsService.createGeneralInventoryHold(id, supplier_product_id, quantity, user?.user_id);
  handleServiceResult(res, result, { successStatus: 201 });
};

/**
 * Release a hold from a material requirement
 */
export const releaseHold = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const result = await holdsService.releaseHold(id, user?.user_id);
  handleServiceResult(res, result);
};

/**
 * Get hold details for a material requirement
 */
export const getHoldForRequirement = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const result = await holdsService.getHoldForRequirement(id);
  handleServiceResult(res, result);
};

/**
 * Get other holds on the same vinyl item (for multi-hold receive flow)
 */
export const getOtherHoldsOnVinyl = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const vinyl_id = parseIntParam(req.query.vinyl_id as string, 'Vinyl ID');
  if (vinyl_id === null) {
    return sendErrorResponse(res, 'Invalid vinyl_id', 'VALIDATION_ERROR');
  }

  const result = await holdsService.getOtherHoldsOnVinyl(id, vinyl_id);
  handleServiceResult(res, result);
};

/**
 * Receive a requirement with a vinyl hold
 * Handles multi-hold scenario where multiple requirements hold the same vinyl
 */
export const receiveRequirementWithHold = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const id = parseIntParam(req.params.id, 'Requirement ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid requirement ID', 'VALIDATION_ERROR');
  }

  const { also_receive_requirement_ids } = req.body;

  const result = await holdsService.receiveRequirementWithVinylHold(
    id,
    also_receive_requirement_ids || [],
    user?.user_id
  );
  handleServiceResult(res, result);
};

/**
 * Get available vinyl items with holds for a vinyl product or raw specs
 * Accepts either vinyl_product_id OR brand+series query params
 */
export const getAvailableVinylWithHolds = async (req: Request, res: Response): Promise<void> => {
  const { vinyl_product_id, brand, series, colour_number, colour_name } = req.query;

  // Validate that at least one lookup method is provided
  if (!vinyl_product_id && !(brand && series)) {
    return sendErrorResponse(res, 'Either vinyl_product_id or brand+series are required', 'VALIDATION_ERROR');
  }

  const result = await holdsService.getAvailableVinylWithHolds({
    vinylProductId: vinyl_product_id ? parseInt(vinyl_product_id as string) : undefined,
    brand: brand as string | undefined,
    series: series as string | undefined,
    colour_number: colour_number as string | undefined,
    colour_name: colour_name as string | undefined,
  });
  handleServiceResult(res, result);
};

/**
 * Get supplier products with holds for an archetype
 */
export const getSupplierProductsWithHolds = async (req: Request, res: Response): Promise<void> => {
  const archetype_id = parseIntParam(req.query.archetype_id as string, 'Archetype ID');
  if (archetype_id === null) {
    return sendErrorResponse(res, 'Invalid archetype_id', 'VALIDATION_ERROR');
  }

  const result = await holdsService.getSupplierProductsWithHolds(archetype_id);
  handleServiceResult(res, result);
};
