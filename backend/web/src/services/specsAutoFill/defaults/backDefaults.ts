/**
 * Back Material Defaults
 * Default back material values based on product type
 */

/**
 * Get default back material based on specs display name
 *
 * @param specsDisplayName - The product type name
 * @returns Default back material or null if not applicable
 */
export function getDefaultBackMaterial(specsDisplayName: string): string | null {
  switch (specsDisplayName) {
    // ACM back (2mm ACM)
    case 'Front Lit':
    case 'Front Lit Acrylic Face':
    case 'Blade Sign':
    case 'Marquee Bulb':
    case 'Return':
    case 'Material Cut':
      return '2mm ACM';

    // White PC back (2mm White PC)
    case 'Halo Lit':
    case 'Dual Lit - Single Layer':
    case 'Dual Lit - Double Layer':
    case '3D print':
      return '2mm White PC';

    default:
      return null;
  }
}
