// File Clean up Finished: Nov 13, 2025
/**
 * Drain Hole Defaults
 * Default drain hole settings based on product type and customer preferences
 */

/**
 * Get default drain holes setting based on specs display name and customer preference
 */
export function getDefaultDrainHoles(specsDisplayName: string, customerPref?: boolean | number): string | null {
  switch (specsDisplayName) {
    case 'Halo Lit':
      return 'false';

    case 'Front Lit':
    case 'Dual Lit - Single Layer':
    case 'Dual Lit - Double Layer':
      // Database returns 1 or 0, convert to true/false strings
      return customerPref === 1 || customerPref === true ? 'true' : 'false';

    default:
      return null;
  }
}
