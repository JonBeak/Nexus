/**
 * Supplier Order Controller
 * HTTP request handlers for supplier order management
 * Created: 2026-02-02
 */

import { Request, Response } from 'express';
import { SupplierOrderService } from '../../services/supplierOrderService';
import {
  SupplierOrderSearchParams,
  CreateSupplierOrderRequest,
  CreateSupplierOrderItemRequest,
  UpdateSupplierOrderRequest,
  UpdateSupplierOrderItemRequest,
  GenerateOrderRequest,
  ReceiveItemsRequest,
  SupplierOrderStatus,
} from '../../types/supplierOrders';

const service = new SupplierOrderService();

// ============================================================================
// ORDER HANDLERS
// ============================================================================

/**
 * GET /supplier-orders
 * Get all supplier orders with optional filtering
 */
export const getOrders = async (req: Request, res: Response) => {
  try {
    const params: SupplierOrderSearchParams = {
      supplier_id: req.query.supplier_id ? parseInt(req.query.supplier_id as string) : undefined,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    // Handle status filter
    if (req.query.status) {
      const statusStr = req.query.status as string;
      if (statusStr.includes(',')) {
        params.status = statusStr.split(',') as SupplierOrderStatus[];
      } else {
        params.status = statusStr as SupplierOrderStatus;
      }
    }

    // Handle date filters
    if (req.query.order_date_from) {
      params.order_date_from = req.query.order_date_from as string;
    }
    if (req.query.order_date_to) {
      params.order_date_to = req.query.order_date_to as string;
    }
    if (req.query.expected_delivery_from) {
      params.expected_delivery_from = req.query.expected_delivery_from as string;
    }
    if (req.query.expected_delivery_to) {
      params.expected_delivery_to = req.query.expected_delivery_to as string;
    }

    const result = await service.getOrders(params);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Error in getOrders:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch orders',
    });
  }
};

/**
 * GET /supplier-orders/:id
 * Get single order with items
 */
export const getOrder = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const result = await service.getOrderWithItems(id);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Error in getOrder:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch order',
    });
  }
};

/**
 * POST /supplier-orders
 * Create new supplier order
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
    const data: CreateSupplierOrderRequest = req.body;
    const userId = (req as any).user?.userId;

    const result = await service.createOrder(data, userId);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.status(201).json({
      success: true,
      message: 'Supplier order created',
      data: result.data,
    });
  } catch (error) {
    console.error('Error in createOrder:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create order',
    });
  }
};

/**
 * POST /supplier-orders/generate
 * Generate order from material requirements
 */
export const generateOrder = async (req: Request, res: Response) => {
  try {
    const data: GenerateOrderRequest = req.body;
    const userId = (req as any).user?.userId;

    const result = await service.generateOrderFromRequirements(data, userId);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.status(201).json({
      success: true,
      message: 'Supplier order generated from requirements',
      data: result.data,
    });
  } catch (error) {
    console.error('Error in generateOrder:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate order',
    });
  }
};

/**
 * PUT /supplier-orders/:id
 * Update supplier order
 */
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const data: UpdateSupplierOrderRequest = req.body;
    const userId = (req as any).user?.userId;

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const result = await service.updateOrder(id, data, userId);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Order updated' });
  } catch (error) {
    console.error('Error in updateOrder:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update order',
    });
  }
};

/**
 * POST /supplier-orders/:id/submit
 * Submit order to supplier
 */
export const submitOrder = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { order_date, notes } = req.body;
    const userId = (req as any).user?.userId;

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const result = await service.submitOrder(id, order_date, userId, notes);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Order submitted' });
  } catch (error) {
    console.error('Error in submitOrder:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to submit order',
    });
  }
};

/**
 * PUT /supplier-orders/:id/status
 * Update order status
 */
export const updateStatus = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, notes } = req.body;
    const userId = (req as any).user?.userId;

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const result = await service.updateStatus(id, status, userId, notes);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Error in updateStatus:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update status',
    });
  }
};

/**
 * POST /supplier-orders/:id/receive
 * Receive items on an order
 */
export const receiveItems = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const data: ReceiveItemsRequest = req.body;
    const userId = (req as any).user?.userId;

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const result = await service.receiveItems(id, data, userId);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      message: result.data?.fully_delivered ? 'Order fully delivered' : 'Items received',
      data: result.data,
    });
  } catch (error) {
    console.error('Error in receiveItems:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to receive items',
    });
  }
};

/**
 * DELETE /supplier-orders/:id
 * Delete supplier order (draft only)
 */
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const result = await service.deleteOrder(id);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Order deleted' });
  } catch (error) {
    console.error('Error in deleteOrder:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete order',
    });
  }
};

/**
 * GET /supplier-orders/:id/history
 * Get order status history
 */
export const getStatusHistory = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const result = await service.getStatusHistory(id);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Error in getStatusHistory:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch status history',
    });
  }
};

/**
 * GET /supplier-orders/status-counts
 * Get counts by status
 */
export const getStatusCounts = async (_req: Request, res: Response) => {
  try {
    const result = await service.getStatusCounts();

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Error in getStatusCounts:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch status counts',
    });
  }
};

// ============================================================================
// ITEM HANDLERS
// ============================================================================

/**
 * POST /supplier-orders/:id/items
 * Add item to order
 */
export const addItem = async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const data: CreateSupplierOrderItemRequest = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const result = await service.addItem(orderId, data);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.status(201).json({
      success: true,
      message: 'Item added',
      data: { item_id: result.data },
    });
  } catch (error) {
    console.error('Error in addItem:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add item',
    });
  }
};

/**
 * PUT /supplier-orders/:id/items/:itemId
 * Update order item
 */
export const updateItem = async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const data: UpdateSupplierOrderItemRequest = req.body;

    if (isNaN(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid item ID' });
    }

    const result = await service.updateItem(itemId, data);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Item updated' });
  } catch (error) {
    console.error('Error in updateItem:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update item',
    });
  }
};

/**
 * DELETE /supplier-orders/:id/items/:itemId
 * Remove item from order
 */
export const removeItem = async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.itemId);

    if (isNaN(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid item ID' });
    }

    const result = await service.removeItem(itemId);

    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Item removed' });
  } catch (error) {
    console.error('Error in removeItem:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove item',
    });
  }
};
