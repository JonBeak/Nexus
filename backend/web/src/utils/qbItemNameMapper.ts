// File Clean up Finished: 2025-11-15
// Changes: Removed 9 console.log debugging statements (production code should not log every mapper call)

/**
 * QB Item Name to Specs Display Name Mapper
 * Maps QuickBooks item names to simplified display names for the Specs section
 */

/**
 * Map QB Item Name to Specs Display Name
 *
 * Mappings:
 * - x" Front Lit → Front Lit
 * - x" Halo Lit, x" Reverse Channel, x" Reverse Channel Letters → Halo Lit
 * - x" Dual Lit 1 Layer → Dual Lit - Single Layer
 * - x" Dual Lit 2 Layer → Dual Lit - Double Layer
 * - x" Trimless Letters → Front Lit Acrylic Face
 * - All other names → Keep original
 *
 * @param qbItemName - The QuickBooks item name from job estimation
 * @returns The mapped display name for specs section
 */
export function mapQBItemNameToSpecsDisplayName(qbItemName: string | null | undefined): string {
  // If no QB item name, return empty string
  if (!qbItemName) {
    return '';
  }

  // Normalize the input - trim and handle case insensitivity
  const normalizedName = qbItemName.trim();

  // Pattern 1: x" Front Lit → Front Lit
  // Matches: 3" Front Lit, 5" Front Lit (case insensitive)
  if (/^\d+["']?\s*front\s*lit$/i.test(normalizedName)) {
    return 'Front Lit';
  }

  // Pattern 2: x" Halo Lit, x" Reverse Channel, x" Reverse Channel Letters → Halo Lit
  // Matches: 3" Halo Lit, 3" Reverse Channel, 3" Reverse Channel Letters (case insensitive)
  if (/^\d+["']?\s*(halo\s*lit|reverse\s*channel(\s*letters?)?)$/i.test(normalizedName)) {
    return 'Halo Lit';
  }

  // Pattern 3: x" Dual Lit 1 Layer → Dual Lit - Single Layer
  // Matches: 3" Dual Lit 1 Layer (case insensitive)
  if (/^\d+["']?\s*dual\s*lit\s*1\s*layer$/i.test(normalizedName)) {
    return 'Dual Lit - Single Layer';
  }

  // Pattern 4: x" Dual Lit 2 Layer → Dual Lit - Double Layer
  // Matches: 3" Dual Lit 2 Layer (case insensitive)
  if (/^\d+["']?\s*dual\s*lit\s*2\s*layers?$/i.test(normalizedName)) {
    return 'Dual Lit - Double Layer';
  }

  // Pattern 5: x" Trimless Letters → Front Lit Acrylic Face
  // Matches: 3" Trimless Letters (case insensitive)
  if (/^\d+["']?\s*trimless\s*letters?$/i.test(normalizedName)) {
    return 'Front Lit Acrylic Face';
  }

  // No mapping found - return original QB item name
  return qbItemName;
}
