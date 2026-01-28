/**
 * Cash Payment Service
 * Created: 2025-01-27
 *
 * Business logic for cash job payments.
 * Handles recording payments, balance calculations, and auto-completion.
 */

import * as cashPaymentRepo from '../repositories/cashPaymentRepository';
import { orderService } from './orderService';
import { broadcastOrderStatus } from '../websocket/taskBroadcast';
import { CashPayment, CreateCashPaymentInput } from '../repositories/cashPaymentRepository';

// =============================================
// TYPES
// =============================================

export interface CashBalanceInfo {
  orderId: number;
  orderNumber: number;
  isCash: boolean;
  total: number;
  totalPaid: number;
  balance: number;
  payments: CashPayment[];
}

export interface RecordPaymentResult {
  payment: CashPayment;
  newBalance: number;
  autoCompleted: boolean;
}

// =============================================
// PAYMENT OPERATIONS
// =============================================

/**
 * Record a cash payment for an order
 * Updates cached balance and auto-completes if fully paid
 */
export async function recordCashPayment(
  input: Omit<CreateCashPaymentInput, 'created_by'>,
  userId: number
): Promise<RecordPaymentResult> {
  // Validate order exists and is a cash job
  const orderInfo = await cashPaymentRepo.getOrderCashInfo(input.order_id);
  if (!orderInfo) {
    throw new Error('Order not found');
  }

  if (!orderInfo.is_cash) {
    throw new Error('Order is not a cash job - use QuickBooks for invoice payments');
  }

  // Validate amount
  if (input.amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  // Create the payment
  const paymentId = await cashPaymentRepo.createPayment({
    ...input,
    created_by: userId
  });

  // Get the created payment
  const payment = await cashPaymentRepo.getPaymentById(paymentId);
  if (!payment) {
    throw new Error('Failed to retrieve created payment');
  }

  // Update cached balance
  const { balance } = await updateCashJobBalance(input.order_id);

  // Check for auto-complete
  let autoCompleted = false;
  if (orderInfo.status === 'awaiting_payment' && balance === 0) {
    try {
      await orderService.updateOrderStatus(
        input.order_id,
        'completed',
        0, // System user
        'Auto-completed: Cash job fully paid'
      );
      broadcastOrderStatus(input.order_id, orderInfo.order_number, 'completed', 'awaiting_payment', 0);
      console.log(`Cash job #${orderInfo.order_number} auto-completed: fully paid`);
      autoCompleted = true;
    } catch (error) {
      console.error(`Failed to auto-complete cash job #${orderInfo.order_number}:`, error);
    }
  }

  return {
    payment,
    newBalance: balance,
    autoCompleted
  };
}

/**
 * Delete a cash payment
 * Manager-only operation
 */
export async function deletePayment(paymentId: number, userId: number): Promise<{
  deleted: boolean;
  newBalance: number;
}> {
  // Get the payment to find order_id
  const payment = await cashPaymentRepo.getPaymentById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  // Verify this is a cash job
  const orderInfo = await cashPaymentRepo.getOrderCashInfo(payment.order_id);
  if (!orderInfo) {
    throw new Error('Order not found');
  }

  if (!orderInfo.is_cash) {
    throw new Error('Cannot delete - order is not a cash job');
  }

  // Delete the payment
  const deleted = await cashPaymentRepo.deletePayment(paymentId);
  if (!deleted) {
    throw new Error('Failed to delete payment');
  }

  // Update cached balance
  const { balance } = await updateCashJobBalance(payment.order_id);

  console.log(`Payment #${paymentId} deleted from order #${orderInfo.order_number} by user ${userId}`);

  return {
    deleted: true,
    newBalance: balance
  };
}

// =============================================
// BALANCE CALCULATIONS
// =============================================

/**
 * Calculate and update cached balance for a cash job
 */
export async function updateCashJobBalance(orderId: number): Promise<{
  total: number;
  totalPaid: number;
  balance: number;
}> {
  const total = await cashPaymentRepo.calculateOrderTotal(orderId);
  const totalPaid = await cashPaymentRepo.getTotalPaymentsForOrder(orderId);
  const balance = Math.max(0, total - totalPaid);

  // Update the order's cached balance
  await cashPaymentRepo.updateOrderCachedBalance(orderId, balance, total);

  return { total, totalPaid, balance };
}

/**
 * Get complete balance info for a cash job
 */
export async function getCashBalanceInfo(orderId: number): Promise<CashBalanceInfo> {
  const orderInfo = await cashPaymentRepo.getOrderCashInfo(orderId);
  if (!orderInfo) {
    throw new Error('Order not found');
  }

  const total = await cashPaymentRepo.calculateOrderTotal(orderId);
  const payments = await cashPaymentRepo.getPaymentsByOrderId(orderId);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, total - totalPaid);

  return {
    orderId,
    orderNumber: orderInfo.order_number,
    isCash: orderInfo.is_cash,
    total,
    totalPaid,
    balance,
    payments
  };
}

/**
 * Get all payments for an order
 */
export async function getOrderPayments(orderId: number): Promise<CashPayment[]> {
  return cashPaymentRepo.getPaymentsByOrderId(orderId);
}

/**
 * Check if an order is a cash job
 */
export async function isCashJob(orderId: number): Promise<boolean> {
  const orderInfo = await cashPaymentRepo.getOrderCashInfo(orderId);
  return orderInfo?.is_cash ?? false;
}

/**
 * Check if a cash job is fully paid and auto-complete if so
 * Called by checkAwaitingPaymentOrders on page load
 */
export async function checkAndAutoCompleteCashJob(orderId: number, orderNumber: number): Promise<{
  autoCompleted: boolean;
  balance: number;
}> {
  // Get current balance info
  const orderInfo = await cashPaymentRepo.getOrderCashInfo(orderId);
  if (!orderInfo) {
    throw new Error('Order not found');
  }

  if (!orderInfo.is_cash) {
    throw new Error('Order is not a cash job');
  }

  // Calculate current balance
  const { balance } = await updateCashJobBalance(orderId);

  // Auto-complete if balance is 0 and order is in awaiting_payment
  let autoCompleted = false;
  if (orderInfo.status === 'awaiting_payment' && balance === 0) {
    try {
      await orderService.updateOrderStatus(
        orderId,
        'completed',
        0, // System user
        'Auto-completed: Cash job fully paid'
      );
      broadcastOrderStatus(orderId, orderNumber, 'completed', 'awaiting_payment', 0);
      console.log(`✅ Cash job #${orderNumber} auto-completed: fully paid`);
      autoCompleted = true;
    } catch (error) {
      console.error(`Failed to auto-complete cash job #${orderNumber}:`, error);
    }
  }

  return { autoCompleted, balance };
}
