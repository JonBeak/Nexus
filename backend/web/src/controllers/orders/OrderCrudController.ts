/**
 * Order CRUD Controller
 * HTTP Request Handlers for Core Order Operations
 *
 * Extracted from orderController.ts - 2025-11-21
 * Functions: getAllOrders, getOrderById, getCustomerTax, updateOrder,
 *            deleteOrder, validateOrderName, getOrderByEstimate
 */

import { Request, Response } from 'express';
import { orderService } from '../../services/orderService';
import { OrderFilters, UpdateOrderData } from '../../types/orders';
import { parseIntParam, sendErrorResponse } from '../../utils/controllerHelpers';

/**
 * Helper: Convert orderNumber to orderId
 * Returns orderId or null if not found
 * Exported for use by other order controllers
 */
export async function getOrderIdFromNumber(orderNumber: string): Promise<number | null> {
  const orderNum = parseIntParam(orderNumber, 'order number');
  if (orderNum === null) {
    return null;
  }
  return await orderService.tryGetOrderIdFromOrderNumber(orderNum);
}

/**
 * Get all orders with optional filters
 * GET /api/orders
 * Permission: orders.view (All roles)
 */
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { status, customer_id, search, limit = '50', offset = '0' } = req.query;

    const filters: OrderFilters = {
      status: status as string,
      customer_id: customer_id ? parseIntParam(customer_id as string, 'customer ID') ?? undefined : undefined,
      search: search as string,
      limit: parseIntParam(limit as string, 'limit') ?? 50,
      offset: parseIntParam(offset as string, 'offset') ?? 0
    };

    const orders = await orderService.getAllOrders(filters);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch orders', 'INTERNAL_ERROR');
  }
};

/**
 * Get single order with details
 * GET /api/orders/:orderNumber
 * Permission: orders.view (All roles)
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const order = await orderService.getOrderById(orderId);

    if (!order) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch order', 'INTERNAL_ERROR');
  }
};

/**
 * Get customer tax from billing address
 * GET /api/orders/:orderNumber/customer-tax
 * Permission: orders.view (All roles)
 * Returns the tax_name for the order's customer based on billing address
 */
export const getCustomerTax = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderNum = parseIntParam(orderNumber, 'order number');

    if (orderNum === null) {
      return sendErrorResponse(res, 'Invalid order number', 'VALIDATION_ERROR');
    }

    const taxName = await orderService.getCustomerTaxFromBillingAddress(orderNum);

    res.json({
      success: true,
      data: { tax_name: taxName }
    });
  } catch (error) {
    console.error('Error fetching customer tax:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to fetch customer tax', 'INTERNAL_ERROR');
  }
};

/**
 * Update order
 * PUT /api/orders/:orderId
 * Permission: orders.update (Manager+ only)
 */
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const updateData: UpdateOrderData = req.body;

    await orderService.updateOrder(orderId, updateData);

    res.json({
      success: true,
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('Error updating order:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update order';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Delete order (pre-confirmation only)
 * DELETE /api/orders/:orderId
 * Permission: orders.delete (Manager+ only)
 */
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    await orderService.deleteOrder(orderId);

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete order';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    if (errorMessage.includes('Cannot delete')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Validate order name uniqueness for a customer (Phase 1.5.a)
 * GET /api/orders/validate-name?orderName=xxx&customerId=123
 */
export const validateOrderName = async (req: Request, res: Response) => {
  try {
    const { orderName, customerId } = req.query;

    if (!orderName || !customerId) {
      return sendErrorResponse(res, 'orderName and customerId are required', 'VALIDATION_ERROR');
    }

    const isUnique = await orderService.isOrderNameUniqueForCustomer(
      String(orderName),
      Number(customerId)
    );

    res.json({
      success: true,
      unique: isUnique
    });
  } catch (error) {
    console.error('Error validating order name:', error);
    return sendErrorResponse(res, 'Failed to validate order name', 'INTERNAL_ERROR');
  }
};

/**
 * Get order for estimate (Phase 1.5.a)
 * GET /api/orders/by-estimate/:estimateId
 */
export const getOrderByEstimate = async (req: Request, res: Response) => {
  try {
    const { estimateId } = req.params;

    const order = await orderService.getOrderByEstimateId(Number(estimateId));

    res.json({
      success: true,
      order: order || null
    });
  } catch (error) {
    console.error('Error getting order by estimate:', error);
    return sendErrorResponse(res, 'Failed to get order', 'INTERNAL_ERROR');
  }
};

/**
 * Update order point persons
 * PUT /api/orders/:orderNumber/point-persons
 * Permission: orders.update (Manager+ only)
 */
export const updateOrderPointPersons = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { pointPersons } = req.body;
    const userId = (req as any).user?.user_id;

    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    if (!Array.isArray(pointPersons)) {
      return sendErrorResponse(res, 'pointPersons must be an array', 'VALIDATION_ERROR');
    }

    // Get the order to get customer_id for saving new contacts
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    await orderService.updateOrderPointPersons(orderId, order.customer_id, pointPersons, userId);

    res.json({
      success: true,
      message: 'Point persons updated successfully'
    });
  } catch (error) {
    console.error('Error updating order point persons:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to update point persons', 'INTERNAL_ERROR');
  }
};

/**
 * Update order accounting emails
 * PUT /api/orders/:orderNumber/accounting-emails
 * Permission: orders.update (Manager+ only)
 */
export const updateOrderAccountingEmails = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { accountingEmails } = req.body;
    const userId = (req as any).user?.user_id;

    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    if (!Array.isArray(accountingEmails)) {
      return sendErrorResponse(res, 'accountingEmails must be an array', 'VALIDATION_ERROR');
    }

    // Get the order to get customer_id for saving new accounting emails
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    await orderService.updateOrderAccountingEmails(orderId, order.customer_id, accountingEmails, userId);

    res.json({
      success: true,
      message: 'Accounting emails updated successfully'
    });
  } catch (error) {
    console.error('Error updating order accounting emails:', error);
    return sendErrorResponse(res, error instanceof Error ? error.message : 'Failed to update accounting emails', 'INTERNAL_ERROR');
  }
};
