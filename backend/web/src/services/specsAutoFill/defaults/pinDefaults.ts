// File Clean up Finished: Nov 13, 2025
/**
 * Pin Defaults
 * Default pin length values based on product type
 */

/**
 * Get default pin length based on specs display name
 * Note: Removed auto-fill - user should select pin type manually
 */
export function getDefaultPinLength(specsDisplayName: string): string | null {
  // No auto-fill for pins - let user select
  return null;
}
