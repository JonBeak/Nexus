// Shared price formatting utility
// Used across all pricing calculators for consistent price display

/**
 * Format price for display
 * - Returns integer string if whole number (e.g., "50")
 * - Returns 2 decimal places if fractional (e.g., "50.25")
 */
export const formatPrice = (price: number): string => {
  return price % 1 === 0 ? price.toString() : price.toFixed(2);
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
