/**
 * Backend Date Utilities
 * Shared date formatting functions for server-side code
 * Created: 2026-02-06
 */

/**
 * Get local date string in YYYY-MM-DD format.
 * Avoids the UTC-midnight edge case of toISOString().split('T')[0]
 * which can shift to the previous day in Eastern timezone.
 */
export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
