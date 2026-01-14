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
    case 'Trim Cap':
      return '2mm PC';

    case 'Halo Lit':
      return '1mm Aluminum';

    case '3D print':
      return '4.5mm Acrylic';

    default:
      return null;
  }
}

/**
 * Get default face color based on specs display name
 * Note: Removed auto-fill for all products - user should select manually
 */
export function getDefaultFaceColor(specsDisplayName: string): string | null {
  // No auto-fill for face colour - let user select
  return null;
}
