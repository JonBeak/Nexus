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
  console.log('[Specs Type Mapper] Input:', specsDisplayName, 'isParentOrRegular:', isParentOrRegular);

  // If no specs display name, return empty array
  if (!specsDisplayName) {
    console.log('[Specs Type Mapper] No specs display name, returning empty array');
    return [];
  }

  const normalizedName = specsDisplayName.trim();
  console.log('[Specs Type Mapper] Normalized:', normalizedName);

  // Mapping table based on specs_display_name
  const specsMap: Record<string, string[]> = {
    // Channel Letters
    'Front Lit': ['Return', 'Trim', 'Face', 'Drain Holes'],
    'Halo Lit': ['Return', 'Face', 'Pins', 'Drain Holes'],
    'Front Lit Acrylic Face': ['Return', 'Face', 'Drain Holes'],
    'Dual Lit - Single Layer': ['Return', 'Trim', 'Face', 'Drain Holes'],
    'Dual Lit - Double Layer': ['Return', 'Trim', 'Face', 'Drain Holes'],

    // Components
    // Note: Vinyl gets Cut/Peel/Mask added below for parent items only
    'Vinyl': ['Vinyl'],
    'LEDs': ['LEDs', 'Wire Length'],
    'Power Supplies': ['Power Supply'],
    'Extra Wire': ['Wire Length'],
    'UL': ['UL'],

    // Specialized Products
    '3D print': ['Return', 'Face', 'Pins'],
    'Blade Sign': ['Return', 'Trim', 'Face'],
    'Marquee Bulb': ['Return', 'Face'],
    'Neon LED': ['Neon Base', 'Neon LED', 'Mounting'],
    'Vinyl Cut': ['Cut', 'Peel', 'Mask'],
    'Material Cut': ['Return', 'Trim', 'Face', 'Back'],

    // Structural/Mounting
    'Backer': ['Material', 'Cutting', 'Assembly'],
    'Frame': ['Material', 'Assembly'],
    'Aluminum Raceway': ['Material', 'Assembly'],
    'Extrusion Raceway': ['Extr. Colour', 'Assembly'],

    // Push Thru Products
    'Push Thru': ['Box Material', 'Push Thru Acrylic'],
    'Knockout Box': ['Box Material', 'Push Thru Acrylic'],

    // Other Products
    'Substrate Cut': ['Material', 'Cutting', 'Mounting'],
    'Painting': ['Painting'],
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
    console.log('[Specs Type Mapper] Added Cut/Peel/Mask to parent Vinyl item');
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

  console.log('[Specs Type Mapper] Mapped to spec types:', specTypes);
  return specTypes;
}

/**
 * Get all available specs display names (for dropdown/reference)
 * Includes both mapped and unmapped items
 */
export function getAllSpecsDisplayNames(): string[] {
  return [
    // ===== MAPPED ITEMS (12) =====
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
    'Substrate Cut',
    'Painting',

    // ===== UNMAPPED ITEMS (28) - To be mapped incrementally =====
    'Dual Lit',
    'Trimless Front Lit',
    'Trimless Halo Lit',
    'Trimless Dual Lit',
    '3D print',
    'Blade Sign',
    'Marquee Bulb',
    'Epoxy',
    'Push Thru',
    'Neon LED',
    'Stainless Steel Sign',
    'Return',
    'Trim Cap',
    'Front Lit Push Thru',
    'Acrylic MINI',
    'Halo Acrylic',
    'Vinyl Cut',
    'Backer',
    'Frame',
    'Custom',
    'Aluminum Raceway',
    'Extrusion Raceway',
    'Dual Lit Acrylic Face (Discontinued)',
    'Material Cut',
    'Channel Letter',
    'Reverse Channel',
    'Trimless Channel',
    'Knockout Box',
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
    'Backer',
    'Frame',
    'Aluminum Raceway',
    'Extrusion Raceway',
    'Push Thru',
    'Knockout Box',
    'Substrate Cut',
    'Painting',
  ];
}
