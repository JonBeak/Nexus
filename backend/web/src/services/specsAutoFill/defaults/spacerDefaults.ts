// File Clean up Finished: Nov 13, 2025
/**
 * Spacer Defaults
 * Default spacer length values based on product type
 */

/**
 * Get default spacer length based on specs display name
 */
export function getDefaultSpacerLength(specsDisplayName: string): string {
  // 3D Print gets shorter spacers
  if (specsDisplayName === '3D print') {
    return '0.5"';
  }

  // Standard spacer length for most products
  return '1.5"';
}
