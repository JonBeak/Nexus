// Supply Chain: Inventory Controller
// Purpose: HTTP request/response handling for inventory management
// Created: 2026-02-02

import { Request, Response } from 'express';
import { InventoryService } from '../../services/supplyChain/inventoryService';
import { parseIntParam, handleServiceResult, sendErrorResponse } from '../../utils/controllerHelpers';

const service = new InventoryService();

/**
 * Get stock levels for supplier products
 */
export const getStockLevels = async (req: Request, res: Response): Promise<void> => {
  const { archetype_id, supplier_id, category, stock_status, search } = req.query;

  const result = await service.getStockLevels({
    archetype_id: archetype_id ? parseInt(archetype_id as string) : undefined,
    supplier_id: supplier_id ? parseInt(supplier_id as string) : undefined,
    category: category as string | undefined,
    stock_status: stock_status as 'out_of_stock' | 'critical' | 'low' | 'ok' | undefined,
    search: search as string | undefined
  });

  handleServiceResult(res, result);
};

/**
 * Get aggregated archetype stock levels
 */
export const getArchetypeStockLevels = async (req: Request, res: Response): Promise<void> => {
  const { category, stock_status, search } = req.query;

  const result = await service.getArchetypeStockLevels({
    category: category as string | undefined,
    stock_status: stock_status as 'out_of_stock' | 'critical' | 'low' | 'ok' | undefined,
    search: search as string | undefined
  });

  handleServiceResult(res, result);
};

/**
 * Get low stock alerts
 */
export const getLowStockAlerts = async (req: Request, res: Response): Promise<void> => {
  const { category, supplier_id, alert_level } = req.query;

  const result = await service.getLowStockAlerts({
    category: category as string | undefined,
    supplier_id: supplier_id ? parseInt(supplier_id as string) : undefined,
    alert_level: alert_level as 'out_of_stock' | 'critical' | 'low' | undefined
  });

  handleServiceResult(res, result);
};

/**
 * Get stock summary by category
 */
export const getStockSummaryByCategory = async (req: Request, res: Response): Promise<void> => {
  const result = await service.getStockSummaryByCategory();
  handleServiceResult(res, result);
};

/**
 * Adjust stock (generic adjustment with transaction logging)
 */
export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const user = (req as any).user;
  const { adjustment, transaction_type, reference_type, reference_id, unit_cost, notes } = req.body;

  if (typeof adjustment !== 'number') {
    return sendErrorResponse(res, 'Adjustment amount is required', 'VALIDATION_ERROR');
  }

  if (!transaction_type) {
    return sendErrorResponse(res, 'Transaction type is required', 'VALIDATION_ERROR');
  }

  const result = await service.adjustStock({
    supplier_product_id: id,
    adjustment,
    transaction_type,
    reference_type,
    reference_id,
    unit_cost,
    notes,
    user_id: user?.user_id
  });

  handleServiceResult(res, result);
};

/**
 * Receive stock from supplier order
 */
export const receiveStock = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const user = (req as any).user;
  const { quantity, unit_cost, supplier_order_id, notes } = req.body;

  if (typeof quantity !== 'number' || quantity <= 0) {
    return sendErrorResponse(res, 'Valid positive quantity is required', 'VALIDATION_ERROR');
  }

  const result = await service.receiveStock({
    supplier_product_id: id,
    quantity,
    unit_cost,
    supplier_order_id,
    notes,
    user_id: user?.user_id
  });

  handleServiceResult(res, result);
};

/**
 * Use/consume stock for production
 */
export const useStock = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const user = (req as any).user;
  const { quantity, order_id, notes } = req.body;

  if (typeof quantity !== 'number' || quantity <= 0) {
    return sendErrorResponse(res, 'Valid positive quantity is required', 'VALIDATION_ERROR');
  }

  const result = await service.useStock({
    supplier_product_id: id,
    quantity,
    order_id,
    notes,
    user_id: user?.user_id
  });

  handleServiceResult(res, result);
};

/**
 * Manual inventory adjustment (count correction)
 */
export const makeAdjustment = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const user = (req as any).user;
  const { new_quantity, notes } = req.body;

  if (typeof new_quantity !== 'number' || new_quantity < 0) {
    return sendErrorResponse(res, 'Valid non-negative quantity is required', 'VALIDATION_ERROR');
  }

  const result = await service.makeAdjustment({
    supplier_product_id: id,
    new_quantity,
    notes,
    user_id: user?.user_id
  });

  handleServiceResult(res, result);
};

/**
 * Update stock settings (reorder point, location, etc.)
 */
export const updateStockSettings = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const { location, reorder_point, last_count_date } = req.body;

  const result = await service.updateStockSettings(id, {
    location,
    reorder_point,
    last_count_date
  });

  handleServiceResult(res, result);
};

/**
 * Reserve stock for an order
 */
export const reserveStock = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const { quantity } = req.body;

  if (typeof quantity !== 'number' || quantity <= 0) {
    return sendErrorResponse(res, 'Valid positive quantity is required', 'VALIDATION_ERROR');
  }

  const result = await service.reserveStock(id, quantity);
  handleServiceResult(res, result);
};

/**
 * Release reserved stock
 */
export const releaseReservation = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const { quantity } = req.body;

  if (typeof quantity !== 'number' || quantity <= 0) {
    return sendErrorResponse(res, 'Valid positive quantity is required', 'VALIDATION_ERROR');
  }

  const result = await service.releaseReservation(id, quantity);
  handleServiceResult(res, result);
};

/**
 * Get transaction history
 */
export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  const {
    supplier_product_id,
    archetype_id,
    supplier_id,
    transaction_type,
    reference_type,
    reference_id,
    start_date,
    end_date,
    limit,
    offset
  } = req.query;

  const result = await service.getTransactions({
    supplier_product_id: supplier_product_id ? parseInt(supplier_product_id as string) : undefined,
    archetype_id: archetype_id ? parseInt(archetype_id as string) : undefined,
    supplier_id: supplier_id ? parseInt(supplier_id as string) : undefined,
    transaction_type: transaction_type as any,
    reference_type: reference_type as string | undefined,
    reference_id: reference_id ? parseInt(reference_id as string) : undefined,
    start_date: start_date as string | undefined,
    end_date: end_date as string | undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined
  });

  handleServiceResult(res, result);
};

/**
 * Get transactions for a specific supplier product
 */
export const getProductTransactions = async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id, 'Supplier Product ID');
  if (id === null) {
    return sendErrorResponse(res, 'Invalid supplier product ID', 'VALIDATION_ERROR');
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

  const result = await service.getProductTransactions(id, limit);
  handleServiceResult(res, result);
};

/**
 * Get recent activity
 */
export const getRecentActivity = async (req: Request, res: Response): Promise<void> => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

  const result = await service.getRecentActivity(limit);
  handleServiceResult(res, result);
};

/**
 * Get transaction summary
 */
export const getTransactionSummary = async (req: Request, res: Response): Promise<void> => {
  const { start_date, end_date, supplier_id, archetype_id } = req.query;

  const result = await service.getTransactionSummary({
    start_date: start_date as string | undefined,
    end_date: end_date as string | undefined,
    supplier_id: supplier_id ? parseInt(supplier_id as string) : undefined,
    archetype_id: archetype_id ? parseInt(archetype_id as string) : undefined
  });

  handleServiceResult(res, result);
};
