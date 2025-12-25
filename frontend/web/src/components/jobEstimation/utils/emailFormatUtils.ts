/**
 * Shared email formatting utilities for estimate summaries
 *
 * IMPORTANT: These functions MUST match the backend formatting:
 * See: backend/web/src/services/estimate/estimateEmailService.ts
 *
 * Used by EstimateEmailComposer and related components to ensure
 * frontend preview matches actual email output.
 */

/**
 * Format currency for display
 * Output: "$1,234.56"
 */
export const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return '-';
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format date for display
 * Output: "Jan. 1, 2025" (with period after month abbreviation)
 * MUST match backend estimateEmailService.formatDate()
 *
 * IMPORTANT: Database DATE columns are returned as Date objects by mysql2,
 * which get serialized to ISO strings like "2025-12-23T00:00:00.000Z".
 * We extract just the date part to avoid timezone issues.
 */
export const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';

  // Extract just the date part (YYYY-MM-DD) from any date string format
  // Handles: "2025-12-23", "2025-12-23T00:00:00.000Z", "2025-12-23T05:00:00.000Z"
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return '-';

  const [, yearStr, monthStr, dayStr] = dateMatch;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Create date in local timezone
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return '-';

  // Match backend format: "Jan. 1, 2025" (with period)
  const monthName = d.toLocaleDateString('en-US', { month: 'short' });
  return `${monthName}. ${day}, ${year}`;
};

/**
 * Calculate and format "Valid Until" date (30 days from estimate date)
 * Used for estimate summary display
 */
export const calculateValidUntilDate = (estimateDate: string | undefined): string => {
  if (!estimateDate) return '-';

  // Extract just the date part (YYYY-MM-DD) from any date string format
  const dateMatch = estimateDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return '-';

  const [, yearStr, monthStr, dayStr] = dateMatch;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Create date in local timezone and add 30 days
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return '-';
  d.setDate(d.getDate() + 30);

  // Format the result
  const monthName = d.toLocaleDateString('en-US', { month: 'short' });
  return `${monthName}. ${d.getDate()}, ${d.getFullYear()}`;
};
