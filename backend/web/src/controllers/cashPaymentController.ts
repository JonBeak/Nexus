/**
 * Cash Payment Controller
 * Created: 2025-01-27
 *
 * HTTP handlers for cash job payment endpoints.
 */

import { Request, Response } from 'express';
import * as cashPaymentService from '../services/cashPaymentService';

/**
 * Record a cash payment for an order
 * POST /api/orders/:orderId/cash-payments
 */
export async function recordPayment(req: Request, res: Response): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      res.status(400).json({ success: false, message: 'Invalid order ID' });
      return;
    }

    const userId = (req as any).user?.user_id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const { amount, payment_method, payment_date, reference_number, memo } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Amount is required and must be positive' });
      return;
    }

    if (!payment_method || !['cash', 'e_transfer', 'check'].includes(payment_method)) {
      res.status(400).json({ success: false, message: 'Valid payment method is required (cash, e_transfer, check)' });
      return;
    }

    if (!payment_date) {
      res.status(400).json({ success: false, message: 'Payment date is required' });
      return;
    }

    const result = await cashPaymentService.recordCashPayment({
      order_id: orderId,
      amount: parseFloat(amount),
      payment_method,
      payment_date,
      reference_number,
      memo
    }, userId);

    res.json({
      success: true,
      data: {
        payment: result.payment,
        newBalance: result.newBalance,
        autoCompleted: result.autoCompleted
      }
    });
  } catch (error) {
    console.error('Error recording cash payment:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to record payment'
    });
  }
}

/**
 * Get all payments for an order
 * GET /api/orders/:orderId/cash-payments
 */
export async function getPayments(req: Request, res: Response): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      res.status(400).json({ success: false, message: 'Invalid order ID' });
      return;
    }

    const payments = await cashPaymentService.getOrderPayments(orderId);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error getting payments:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get payments'
    });
  }
}

/**
 * Delete a cash payment
 * DELETE /api/orders/:orderId/cash-payments/:paymentId
 */
export async function deletePayment(req: Request, res: Response): Promise<void> {
  try {
    const paymentId = parseInt(req.params.paymentId);
    if (isNaN(paymentId)) {
      res.status(400).json({ success: false, message: 'Invalid payment ID' });
      return;
    }

    const userId = (req as any).user?.user_id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const result = await cashPaymentService.deletePayment(paymentId, userId);

    res.json({
      success: true,
      data: {
        deleted: result.deleted,
        newBalance: result.newBalance
      }
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete payment'
    });
  }
}

/**
 * Get open cash orders with positive balance for a customer
 * GET /api/payments/customer/:customerId/open-cash-orders
 */
export async function getOpenCashOrders(req: Request, res: Response): Promise<void> {
  try {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) {
      res.status(400).json({ success: false, message: 'Invalid customer ID' });
      return;
    }

    const orders = await cashPaymentService.getOpenCashOrdersForCustomer(customerId);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error getting open cash orders:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get open cash orders'
    });
  }
}

/**
 * Record a cash payment split across multiple orders
 * POST /api/payments/cash
 */
export async function recordMultiOrderPayment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.user_id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const { allocations, payment_method, payment_date, reference_number, memo } = req.body;

    // Validate allocations
    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      res.status(400).json({ success: false, message: 'At least one order allocation is required' });
      return;
    }

    for (const alloc of allocations) {
      if (!alloc.order_id || !alloc.amount || alloc.amount <= 0) {
        res.status(400).json({ success: false, message: 'Each allocation must have a valid order_id and positive amount' });
        return;
      }
    }

    if (!payment_method || !['cash', 'e_transfer', 'check'].includes(payment_method)) {
      res.status(400).json({ success: false, message: 'Valid payment method is required (cash, e_transfer, check)' });
      return;
    }

    if (!payment_date) {
      res.status(400).json({ success: false, message: 'Payment date is required' });
      return;
    }

    const result = await cashPaymentService.recordMultiOrderCashPayment({
      allocations: allocations.map((a: any) => ({
        order_id: parseInt(a.order_id),
        amount: parseFloat(a.amount)
      })),
      payment_method,
      payment_date,
      reference_number,
      memo
    }, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error recording multi-order cash payment:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to record payment'
    });
  }
}

/**
 * Get balance info for a cash job order
 * GET /api/orders/:orderId/cash-balance
 */
export async function getBalance(req: Request, res: Response): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      res.status(400).json({ success: false, message: 'Invalid order ID' });
      return;
    }

    const balanceInfo = await cashPaymentService.getCashBalanceInfo(orderId);

    res.json({
      success: true,
      data: balanceInfo
    });
  } catch (error) {
    console.error('Error getting cash balance:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get balance'
    });
  }
}
