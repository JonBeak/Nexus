/**
 * Material Requirements Controller
 * HTTP request/response handling for material requirements
 * Created: 2025-01-27
 */

import { Request, Response } from 'express';
import { MaterialRequirementService } from '../../services/materialRequirementService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';
import { MaterialRequirementStatus } from '../../types/materialRequirements';

const service = new MaterialRequirementService();

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
