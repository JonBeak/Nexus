/**
 * Formatting Utilities for DualTableLayout
 * Extracted from DualTableLayout.tsx (Phase 4)
 */

/**
 * Format currency value for display
 * Returns '-' for null/undefined/0 values
 * Returns '$X.XX' for valid numbers
 */
export const formatCurrency = (value: number | string | undefined | null): string => {
  if (value == null || value === '') return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue) || numValue === 0) return '-';
  return `$${numValue.toFixed(2)}`;
};

/**
 * Format quantity value for display
 * Returns '-' for null/undefined/0 values
 * Removes trailing zeros for whole numbers (e.g., 5.00 → 5)
 * Keeps decimals for fractional quantities (e.g., 2.5 → 2.5)
 */
export const formatQuantity = (value: number | string | undefined | null): string => {
  if (value == null || value === '') return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue) || numValue === 0) return '-';
  return numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(2).replace(/\.?0+$/, '');
};
