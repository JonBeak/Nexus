/**
 * Payment Utilities
 * Shared helpers and constants for QB and Cash payment sections
 */

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

/** QB payment methods (numeric IDs matching QuickBooks) */
export const QB_PAYMENT_METHODS = [
  { value: '1', label: 'Cash' },
  { value: '2', label: 'Check' },
  { value: '3', label: 'Credit Card' },
  { value: '4', label: 'E-Transfer' },
  { value: '5', label: 'Wire Transfer' },
];

/** Cash order payment methods (string keys matching backend enum) */
export const CASH_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'e_transfer', label: 'E-Transfer' },
];
