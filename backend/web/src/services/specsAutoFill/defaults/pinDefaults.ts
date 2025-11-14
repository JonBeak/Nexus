// File Clean up Finished: Nov 13, 2025
/**
 * Pin Defaults
 * Default pin length values based on product type
 */

/**
 * Get default pin length based on specs display name
 */
export function getDefaultPinLength(specsDisplayName: string): string {
  // 3D Print gets shorter pins
  if (specsDisplayName === '3D print') {
    return '2"';
  }

  // Most channel letters get 6" pins
  return '6"';
}
