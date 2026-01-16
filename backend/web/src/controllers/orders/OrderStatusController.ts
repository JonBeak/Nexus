/**
 * Order Status Controller
 * HTTP Request Handlers for Order Status Management
 *
 * Extracted from orderController.ts - 2025-11-21
 * Functions: updateOrderStatus, getStatusHistory, getOrderProgress
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../../types';
import { orderService } from '../../services/orderService';
import { checkAwaitingPaymentOrders as checkPayments } from '../../services/invoiceListingService';
import { sendErrorResponse } from '../../utils/controllerHelpers';
import { getOrderIdFromNumber } from './OrderCrudController';

/**
 * Update order status
 * PUT /api/orders/:orderId/status
 * Permission: orders.update (Manager+ only)
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const { status, notes } = req.body;

    if (!status) {
      return sendErrorResponse(res, 'Status is required', 'VALIDATION_ERROR');
    }

    if (!user) {
      return sendErrorResponse(res, 'User not authenticated', 'UNAUTHORIZED');
    }

    await orderService.updateOrderStatus(
      orderId,
      status,
      user.user_id,
      notes
    );

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    console.error('Error updating order status:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update order status';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    if (errorMessage.includes('Invalid status')) {
      return sendErrorResponse(res, errorMessage, 'VALIDATION_ERROR');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Get status history for order
 * GET /api/orders/:orderId/status-history
 * Permission: orders.view (All roles)
 */
export const getStatusHistory = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const history = await orderService.getStatusHistory(orderId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching status history:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch status history';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Get order progress
 * GET /api/orders/:orderId/progress
 * Permission: orders.view (All roles)
 */
export const getOrderProgress = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const orderId = await getOrderIdFromNumber(orderNumber);

    if (!orderId) {
      return sendErrorResponse(res, 'Order not found', 'NOT_FOUND');
    }

    const progress = await orderService.getOrderProgress(orderId);

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Error fetching order progress:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch order progress';

    if (errorMessage.includes('not found')) {
      return sendErrorResponse(res, errorMessage, 'NOT_FOUND');
    }

    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};

/**
 * Check awaiting payment orders for completion
 * POST /api/orders/check-awaiting-payments
 * Permission: orders.view (called on page load for Orders/Invoices pages)
 *
 * Triggers balance sync for all orders in awaiting_payment status.
 * Auto-completes orders when linked invoice is fully paid (balance = 0).
 */
export const checkAwaitingPaymentOrders = async (req: Request, res: Response) => {
  try {
    const result = await checkPayments();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking awaiting payment orders:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to check awaiting payment orders';
    return sendErrorResponse(res, errorMessage, 'INTERNAL_ERROR');
  }
};
