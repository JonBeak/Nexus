import { api } from '../../apiClient';

/**
 * Cash Payment API - Cash Job Payment Operations
 * Handles recording/retrieving payments for cash job orders
 */

export type CashPaymentMethod = 'cash' | 'e_transfer' | 'check';

export interface CashPayment {
  payment_id: number;
  order_id: number;
  amount: number;
  payment_method: CashPaymentMethod;
  payment_date: string;
  reference_number: string | null;
  memo: string | null;
  created_by: number;
  created_at: string;
  created_by_name?: string;
}

export interface CashBalanceInfo {
  orderId: number;
  orderNumber: number;
  isCash: boolean;
  total: number;
  totalPaid: number;
  balance: number;
  payments: CashPayment[];
}

export interface RecordPaymentInput {
  amount: number;
  payment_method: CashPaymentMethod;
  payment_date: string;
  reference_number?: string;
  memo?: string;
}

export interface RecordPaymentResult {
  payment: CashPayment;
  newBalance: number;
  autoCompleted: boolean;
}

/**
 * Record a cash payment for a cash job order
 */
export async function recordPayment(
  orderId: number,
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const response = await api.post(`/orders/${orderId}/cash-payments`, input);
  return response.data;
}

/**
 * Get all payments for an order
 */
export async function getPayments(orderId: number): Promise<CashPayment[]> {
  const response = await api.get(`/orders/${orderId}/cash-payments`);
  return response.data;
}

/**
 * Delete a cash payment
 */
export async function deletePayment(
  orderId: number,
  paymentId: number
): Promise<{ deleted: boolean; newBalance: number }> {
  const response = await api.delete(`/orders/${orderId}/cash-payments/${paymentId}`);
  return response.data;
}

/**
 * Get balance info for a cash job order
 */
export async function getBalance(orderId: number): Promise<CashBalanceInfo> {
  const response = await api.get(`/orders/${orderId}/cash-balance`);
  return response.data;
}

/**
 * Format payment method for display
 */
export function formatPaymentMethod(method: CashPaymentMethod): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'e_transfer':
      return 'E-Transfer';
    case 'check':
      return 'Check';
    default:
      return method;
  }
}
