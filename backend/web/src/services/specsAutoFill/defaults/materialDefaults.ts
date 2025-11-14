// File Clean up Finished: Nov 13, 2025
/**
 * Material Defaults
 * Default face material and color values based on product type
 */

/**
 * Get default face material based on specs display name
 */
export function getDefaultFaceMaterial(specsDisplayName: string): string | null {
  switch (specsDisplayName) {
    case 'Front Lit':
    case 'Dual Lit - Single Layer':
    case 'Dual Lit - Double Layer':
      return '2mm PC';

    case 'Halo Lit':
      return '1mm Aluminum';

    default:
      return null;
  }
}

/**
 * Get default face color based on specs display name
 */
export function getDefaultFaceColor(specsDisplayName: string): string | null {
  switch (specsDisplayName) {
    case 'Front Lit':
    case 'Dual Lit - Single Layer':
    case 'Dual Lit - Double Layer':
      return 'White';

    case 'Halo Lit':
      return null; // No color for Halo Lit

    default:
      return null;
  }
}
