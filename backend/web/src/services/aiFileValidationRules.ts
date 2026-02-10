/**
 * AI File Validation Rules
 * Spec-type detection, validation rule building, and rule descriptions
 */

import { ValidationRuleConfig, ValidationRuleDisplay, StandardHoleSize } from '../types/aiFileValidation';

// =============================================
// SPEC-TYPE SPECIFIC VALIDATION RULES
// =============================================

/**
 * Front Lit channel letter validation rules (trim cap structure)
 * File scale: 10% (multiply by 10 for real-world dimensions)
 */
export const FRONT_LIT_STRUCTURE_RULES: ValidationRuleConfig = {
  file_scale: 0.1,                    // 10% scale
  trim_offset_min_mm: 1.5,           // per side, in real mm (minimum acceptable offset)
  trim_offset_max_mm: 2.5,           // per side, in real mm (maximum at straight edges)
  miter_factor: 4.0,                 // corners can extend up to miter_factor * max before bevel
  min_mounting_holes: 2,
  mounting_holes_per_inch_perimeter: 0.05,  // 1 per 20" real
  mounting_holes_per_sq_inch_area: 0.0123,  // 1 per 81 sq in real
  check_wire_holes: true,            // Front lit always has LEDs
  expected_mounting_names: ['Regular Mounting'],  // Warn if other mounting types found
  return_layer: 'return',            // Layer name for returns
  trim_layer: 'trimcap',             // Layer name for trim caps
  min_trim_spacing_inches: 0.15,     // Minimum clearance between trim cap letters (with miter)
};

/**
 * Front Lit Acrylic Face validation rules
 * Uses face layer instead of trim cap, with engraving path detection
 */
export const FRONT_LIT_ACRYLIC_FACE_RULES: ValidationRuleConfig = {
  file_scale: 0.1,
  face_layer: 'face',                         // Layer name for acrylic faces
  face_offset_min_mm: 0.3,                    // Face must be ≥0.3mm bigger per side
  min_face_spacing_inches: 0.10,              // 0.1" apart (less than trim cap's 0.15")
  engraving_offset_mm: 0.4,                   // Expected engraving inset per side
  engraving_offset_tolerance_mm: 0.15,        // Tolerance for engraving offset match
  min_mounting_holes: 2,
  mounting_holes_per_inch_perimeter: 0.05,
  mounting_holes_per_sq_inch_area: 0.0123,
  check_wire_holes: true,
  expected_mounting_names: ['Regular Mounting'],
  return_layer: 'return',
};

// Exact product type → validation spec type mapping
const VALIDATION_SPEC_TYPE_MAP: Record<string, string> = {
  'Front Lit': 'front_lit',
  'Front Lit Acrylic Face': 'front_lit_acrylic_face',
  'Dual Lit - Single Layer': 'front_lit',   // Same trim cap structure rules
  'Dual Lit - Double Layer': 'front_lit',   // Same trim cap structure rules
  // Future:
  // 'Halo Lit': 'halo_lit',
  // 'Front Lit Push Thru': 'front_lit_push_thru',
};

/**
 * Determine which spec types are present in order parts.
 * Uses exact name matching — no substring matching.
 */
export function detectSpecTypes(specsDisplayNames: string[]): Set<string> {
  const specTypes = new Set<string>();
  for (const name of specsDisplayNames) {
    const mapped = VALIDATION_SPEC_TYPE_MAP[name];
    if (mapped) specTypes.add(mapped);
  }
  return specTypes;
}

/**
 * Get human-readable validation rule descriptions for display in the UI
 */
export function getValidationRuleDescriptions(specTypes: Set<string>): ValidationRuleDisplay[] {
  const rules: ValidationRuleDisplay[] = [
    // Global rules (always applied)
    {
      rule_key: 'no_duplicate_overlapping',
      name: 'No Duplicate Paths',
      description: 'Detects duplicate or overlapping paths on same layer',
      category: 'Global',
    },
    {
      rule_key: 'stroke_requirements',
      name: 'Stroke Requirements',
      description: 'Paths must have stroke, no fill allowed',
      category: 'Global',
    },
  ];

  // Front Lit rules
  if (specTypes.has('front_lit')) {
    rules.push(
      {
        rule_key: 'front_lit_wire_holes',
        name: 'Wire Hole Check',
        description: 'Each letter requires 1 wire hole (9.7mm)',
        category: 'Front Lit Channel Letters',
      },
      {
        rule_key: 'front_lit_mounting_holes',
        name: 'Mounting Holes',
        description: 'Min 2 per letter; 1 per 20" perimeter; 1 per 81 sq in area',
        category: 'Front Lit Channel Letters',
      },
      {
        rule_key: 'front_lit_trim_offset',
        name: 'Trim Cap Offset',
        description: 'Trim must be 1.5\u20132.5mm larger than return per side',
        category: 'Front Lit Channel Letters',
      },
      {
        rule_key: 'front_lit_layer_matching',
        name: 'Layer Matching',
        description: 'Return and Trimcap layers must have same letter count',
        category: 'Front Lit Channel Letters',
      },
      {
        rule_key: 'front_lit_trim_spacing',
        name: 'Trim Cap Spacing',
        description: 'Trim cap letters must be at least 0.15" apart (with miter)',
        category: 'Front Lit Channel Letters',
      },
      {
        rule_key: 'front_lit_trim_missing',
        name: 'Trim Cap Layer Required',
        description: 'Working file must include a trimcap layer with letters',
        category: 'Front Lit Channel Letters',
      },
    );
  }

  // Front Lit Acrylic Face rules
  if (specTypes.has('front_lit_acrylic_face')) {
    rules.push(
      {
        rule_key: 'acrylic_face_wire_holes',
        name: 'Wire Hole Check',
        description: 'Each return letter requires 1 wire hole (9.7mm)',
        category: 'Front Lit Acrylic Face',
      },
      {
        rule_key: 'acrylic_face_mounting_holes',
        name: 'Mounting Holes',
        description: 'Min 2 per letter; 1 per 20" perimeter; 1 per 81 sq in area',
        category: 'Front Lit Acrylic Face',
      },
      {
        rule_key: 'acrylic_face_missing',
        name: 'Face Layer Required',
        description: 'Working file must include a face layer with letters',
        category: 'Front Lit Acrylic Face',
      },
      {
        rule_key: 'acrylic_face_spacing',
        name: 'Face Spacing',
        description: 'Face letters must be at least 0.10" apart',
        category: 'Front Lit Acrylic Face',
      },
      {
        rule_key: 'acrylic_face_count',
        name: 'Layer Matching',
        description: 'Face and Return layers must have same letter count',
        category: 'Front Lit Acrylic Face',
      },
      {
        rule_key: 'acrylic_face_offset',
        name: 'Face Offset',
        description: 'Face must be ≥0.3mm larger than return per side',
        category: 'Front Lit Acrylic Face',
      },
      {
        rule_key: 'acrylic_face_engraving_missing',
        name: 'Face Engraving',
        description: 'Each face letter should have an engraving path inset ~0.4mm',
        category: 'Front Lit Acrylic Face',
      },
    );
  }

  return rules;
}

/** Serialize StandardHoleSize[] for Python consumption */
function serializeHoleSizes(sizes: StandardHoleSize[]): Record<string, any>[] {
  return sizes.map(s => ({
    hole_size_id: s.hole_size_id,
    name: s.name,
    diameter_mm: s.diameter_mm,
    tolerance_mm: s.tolerance_mm,
    category: s.category,
  }));
}

/**
 * Build validation rules for Working Files based on detected spec types
 */
export function buildValidationRules(
  specTypes: Set<string>,
  standardHoleSizes: StandardHoleSize[] = []
): Record<string, ValidationRuleConfig> {
  const rules: Record<string, ValidationRuleConfig> = {
    // Base rules always applied
    no_duplicate_overlapping: {
      tolerance: 0.01
    },
    stroke_requirements: {
      allow_fill: false  // Only check for no fill; color and width not enforced
    },
    letter_hole_analysis: {
      file_scale: 0.1,  // Working files are 10% scale
      standard_hole_sizes: serializeHoleSizes(standardHoleSizes),
    },
  };

  // Add spec-type specific rules
  if (specTypes.has('front_lit')) {
    rules.front_lit_structure = { ...FRONT_LIT_STRUCTURE_RULES };
  }

  if (specTypes.has('front_lit_acrylic_face')) {
    rules.front_lit_acrylic_face_structure = { ...FRONT_LIT_ACRYLIC_FACE_RULES };
  }

  // Future: Add halo_lit, non_lit rules here

  return rules;
}

/**
 * Build validation rules for Cutting Files (100% scale, no spec-specific rules)
 * Runs base structural checks + letter/hole geometry analysis at full scale
 */
export function buildCuttingFileRules(
  standardHoleSizes: StandardHoleSize[] = []
): Record<string, ValidationRuleConfig> {
  return {
    no_duplicate_overlapping: { tolerance: 0.01 },
    stroke_requirements: { allow_fill: false },
    letter_hole_analysis: {
      file_scale: 1.0,
      standard_hole_sizes: serializeHoleSizes(standardHoleSizes),
    },
  };
}
