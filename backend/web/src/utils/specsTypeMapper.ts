// File Clean up Finished: 2025-11-15
// Changes: Removed 5 console.log debugging statements (kept console.warn for unmapped items - that's valuable)

/**
 * Specs Type Mapper
 * Maps specs_display_name to appropriate specification types
 *
 * Phase 1: Returns spec type names only (spec1 values populated in Phase 2)
 */

export interface SpecType {
  name: string;        // e.g., "Return", "Trim", "Face"
  spec1?: string;      // Will be populated in Phase 2
  spec2?: string;      // Will be populated in Phase 2
  spec3?: string;      // Will be populated in Phase 2
}

/**
 * Map Specs Display Name to Specification Types
 *
 * Returns an array of spec type objects with empty values (to be filled later)
 *
 * @param specsDisplayName - The mapped display name (e.g., "Front Lit", "Halo Lit")
 * @param isParentOrRegular - If true, adds "Notes" spec at the end (for parent/regular rows)
 * @returns Array of spec type objects with names only
 */
export function mapSpecsDisplayNameToTypes(
  specsDisplayName: string | null | undefined,
  isParentOrRegular: boolean = false
): SpecType[] {
  // If no specs display name, return empty array
  if (!specsDisplayName) {
    return [];
  }

  const normalizedName = specsDisplayName.trim();

  // Mapping table based on specs_display_name
  const specsMap: Record<string, string[]> = {
    // Channel Letters
    'Front Lit': ['Return', 'Trim', 'Face', 'Back', 'Drain Holes'],
    'Halo Lit': ['Return', 'Face', 'Back', 'Mounting', 'Drain Holes'],
    'Front Lit Acrylic Face': ['Return', 'Face', 'Back', 'Drain Holes'],
    'Dual Lit - Single Layer': ['Return', 'Trim', 'Face', 'Back', 'Drain Holes'],
    'Dual Lit - Double Layer': ['Return', 'Trim', 'Face', 'Back', 'Drain Holes'],

    // Components
    // Note: Vinyl gets Cut/Peel/Mask added below for parent items only
    'Vinyl': ['Vinyl'],
    'LEDs': ['LEDs', 'Wire Length'],
    'Power Supplies': ['Power Supply'],
    'Extra Wire': ['Wire Length'],
    'UL': ['UL'],

    // Specialized Products
    '3D print': ['3DP Return', 'Face', 'Back', 'Illumination', 'Mounting'],
    'Blade Sign': ['Return', 'Trim', 'Face', 'Back'],
    'Marquee Bulb': ['Return', 'Face', 'Back'],
    'Neon LED': ['Neon Base', 'Neon LED', 'Mounting'],
    'Vinyl Cut': ['Cut', 'Peel', 'Mask'],
    'Material Cut': ['Return', 'Trim', 'Face', 'Back'],

    // Standalone Components
    'Return': ['Return', 'Back', 'Drain Holes'],
    'Trim Cap': ['Trim', 'Face'],

    // Structural/Mounting
    'Backer': ['Box Type', 'Cutting', 'Assembly', 'Wire Length'],
    'Frame': ['Material', 'Assembly'],
    'Aluminum Raceway': ['Material', 'Assembly'],
    'Extrusion Raceway': ['Extr. Colour', 'Assembly'],

    // Push Thru Products
    'Push Thru': ['Box Type', 'Acrylic'],
    'Knockout Box': ['Box Type', 'Acrylic'],

    // Other Products
    'Substrate Cut': ['Material', 'Cutting', 'Mounting', 'D-Tape'],
    'Painting': ['Painting'],

    // Standalone Assembly
    'Assembly': ['Assembly'],
  };

  // Look up the spec types for this display name
  let specTypeNames = specsMap[normalizedName];

  if (!specTypeNames) {
    console.warn(
      `[Specs Type Mapper] ⚠️  WARNING: No mapping found for "${normalizedName}". ` +
      `Please add this mapping to specsTypeMapper.ts and update Nexus_Orders_SpecsMapping.md. ` +
      `Returning empty array.`
    );
    return [];
  }

  // Clone the array to avoid mutating the original mapping
  specTypeNames = [...specTypeNames];

  // Special handling for Vinyl: add Cut, Peel, Mask for parent items only
  if (normalizedName === 'Vinyl' && isParentOrRegular) {
    specTypeNames.push('Cut', 'Peel', 'Mask');
  }

  // Convert spec type names into SpecType objects (with empty values)
  const specTypes: SpecType[] = specTypeNames.map(name => ({
    name,
    spec1: '',
    spec2: '',
    spec3: ''
  }));

  // Add "Notes" spec at the end for parent/regular rows
  if (isParentOrRegular) {
    specTypes.push({
      name: 'Notes',
      spec1: '',
      spec2: '',
      spec3: ''
    });
  }

  return specTypes;
}

/**
 * Get all available specs display names (for dropdown/reference)
 * Includes both mapped and unmapped items
 */
export function getAllSpecsDisplayNames(): string[] {
  return [
    // ===== MAPPED ITEMS (26) =====
    'Front Lit',
    'Halo Lit',
    'Front Lit Acrylic Face',
    'Dual Lit - Single Layer',
    'Dual Lit - Double Layer',
    'Vinyl',
    'LEDs',
    'Power Supplies',
    'Extra Wire',
    'UL',
    '3D print',
    'Blade Sign',
    'Marquee Bulb',
    'Neon LED',
    'Vinyl Cut',
    'Material Cut',
    'Return',
    'Trim Cap',
    'Backer',
    'Frame',
    'Aluminum Raceway',
    'Extrusion Raceway',
    'Push Thru',
    'Knockout Box',
    'Substrate Cut',
    'Painting',
    'Assembly',

    // ===== UNMAPPED ITEMS (14) - To be mapped incrementally =====
    'Dual Lit',
    'Trimless Front Lit',
    'Trimless Halo Lit',
    'Trimless Dual Lit',
    'Epoxy',
    'Stainless Steel Sign',
    'Front Lit Push Thru',
    'Acrylic MINI',
    'Halo Acrylic',
    'Custom',
    'Dual Lit Acrylic Face (Discontinued)',
    'Channel Letter',
    'Reverse Channel',
    'Trimless Channel',
  ];
}

/**
 * Get only mapped specs display names (items that have spec type mappings)
 */
export function getMappedSpecsDisplayNames(): string[] {
  return [
    'Front Lit',
    'Halo Lit',
    'Front Lit Acrylic Face',
    'Dual Lit - Single Layer',
    'Dual Lit - Double Layer',
    'Vinyl',
    'LEDs',
    'Power Supplies',
    'Extra Wire',
    'UL',
    '3D print',
    'Blade Sign',
    'Marquee Bulb',
    'Neon LED',
    'Vinyl Cut',
    'Material Cut',
    'Return',
    'Trim Cap',
    'Backer',
    'Frame',
    'Aluminum Raceway',
    'Extrusion Raceway',
    'Push Thru',
    'Knockout Box',
    'Substrate Cut',
    'Painting',
    'Assembly',
  ];
}
