// Shared number and price formatting utilities
// Used across all pricing calculators and UI components for consistent display

/**
 * Format a general number with optional maximum decimal places
 * - Removes trailing zeros (e.g., 10.00 → "10", 1.50 → "1.5")
 * - Limits decimal places to maxDecimals (default: 2)
 * - Use for percentages, multipliers, and general numeric display
 *
 * @param value - Number or string to format
 * @param maxDecimals - Maximum decimal places (default: 2)
 * @returns Formatted string with trailing zeros removed
 *
 * @example
 * formatNumber(10.00000) → "10"
 * formatNumber(1.50000) → "1.5"
 * formatNumber(10.123, 2) → "10.12"
 */
export const formatNumber = (value: number | string, maxDecimals: number = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';

  // Round to maxDecimals and remove trailing zeros
  const rounded = parseFloat(num.toFixed(maxDecimals));
  return rounded.toString();
};

/**
 * Format price for display
 * - Returns integer string if whole number (e.g., "50")
 * - Returns 2 decimal places if fractional (e.g., "50.25")
 * - Handles both number and string inputs for database compatibility
 *
 * @param price - Price value as number or string
 * @returns Formatted price string
 */
export const formatPrice = (price: number | string): string => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return '0';
  return numPrice % 1 === 0 ? numPrice.toString() : numPrice.toFixed(2);
};

/**
 * Format price with thousands separators
 * - Always returns 2 decimal places (e.g., "1,250.00")
 * - Adds commas for thousands (e.g., "1,234,567.89")
 */
export const formatPriceWithCommas = (price: number): string => {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};
