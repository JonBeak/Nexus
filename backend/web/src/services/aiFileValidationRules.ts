/**
 * AI File Validation Rules
 * Spec-type detection, validation rule building, and rule descriptions
 *
 * Rule parameters are loaded from vector_validation_profiles DB table.
 * The profile map is passed in by the caller (aiFileValidationService).
 */

import { ValidationRuleConfig, ValidationRuleDisplay, StandardHoleSize } from '../types/aiFileValidation';
import { VectorValidationProfile } from '../repositories/vectorValidationProfileRepository';

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

/** Spec type key → rule key in the rules dict sent to Python */
const SPEC_TYPE_RULE_KEY_MAP: Record<string, string> = {
  'front_lit': 'front_lit_structure',
  'front_lit_acrylic_face': 'front_lit_acrylic_face_structure',
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
 * Get human-readable validation rule descriptions for display in the UI.
 * Uses profile parameters from DB for dynamic description values.
 */
export function getValidationRuleDescriptions(
  specTypes: Set<string>,
  profileMap?: Map<string, VectorValidationProfile>
): ValidationRuleDisplay[] {
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
    const p = profileMap?.get('front_lit')?.parameters;
    const trimMin = p?.trim_offset_min_mm ?? 1.5;
    const trimMax = p?.trim_offset_max_mm ?? 2.5;
    const trimSpacing = p?.min_trim_spacing_inches ?? 0.15;

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
        description: `Trim must be ${trimMin}\u2013${trimMax}mm larger than return per side`,
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
        description: `Trim cap letters must be at least ${trimSpacing}" apart (with miter)`,
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
    const p = profileMap?.get('front_lit_acrylic_face')?.parameters;
    const faceSpacing = p?.min_face_spacing_inches ?? 0.10;
    const faceOffset = p?.face_offset_min_mm ?? 0.3;
    const engravingOffset = p?.engraving_offset_mm ?? 4.0;

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
        description: `Face letters must be at least ${faceSpacing}" apart`,
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
        description: `Face must be \u2265${faceOffset}mm larger than return per side`,
        category: 'Front Lit Acrylic Face',
      },
      {
        rule_key: 'acrylic_face_engraving_missing',
        name: 'Face Engraving',
        description: `Each face letter should have an engraving path inset ~${engravingOffset}mm`,
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
 * Build validation rules for Working Files based on detected spec types.
 * Uses DB-loaded profiles for spec-type parameters.
 */
export function buildValidationRules(
  specTypes: Set<string>,
  standardHoleSizes: StandardHoleSize[] = [],
  profileMap?: Map<string, VectorValidationProfile>
): Record<string, ValidationRuleConfig> {
  const rules: Record<string, ValidationRuleConfig> = {
    // Base rules always applied
    no_duplicate_overlapping: {
      tolerance: 0.01
    },
    stroke_requirements: {
      allow_fill: false
    },
    letter_hole_analysis: {
      file_scale: 0.1,
      standard_hole_sizes: serializeHoleSizes(standardHoleSizes),
    },
  };

  // Add spec-type specific rules from DB profiles
  for (const specType of specTypes) {
    const ruleKey = SPEC_TYPE_RULE_KEY_MAP[specType];
    if (!ruleKey) continue;

    const profile = profileMap?.get(specType);
    if (profile) {
      // Use DB parameters
      rules[ruleKey] = { ...profile.parameters };
    }
  }

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
