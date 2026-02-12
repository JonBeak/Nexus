/**
 * AI File Validation Rules
 * Spec-type detection, validation rule building, and rule descriptions
 *
 * Rule parameters are loaded from vector_validation_profiles DB table.
 * The profile map is passed in by the caller (aiFileValidationService).
 */

import { ValidationRuleConfig, ValidationRuleDisplay, StandardHoleSize } from '../types/aiFileValidation';
import { VectorValidationProfile } from '../repositories/vectorValidationProfileRepository';

/** Product names that map to Dual Lit (need order-aware mounting hole expectations) */
export const DUAL_LIT_PRODUCT_NAMES = ['Dual Lit - Single Layer'];

/** Product names that map to Halo Lit */
export const HALO_LIT_PRODUCT_NAMES = ['Halo Lit'];

// Exact product type → validation spec type mapping
const VALIDATION_SPEC_TYPE_MAP: Record<string, string> = {
  'Front Lit': 'front_lit',
  'Front Lit Acrylic Face': 'front_lit_acrylic_face',
  'Dual Lit - Single Layer': 'front_lit',   // Same structural rules, different mounting expectations
  'Halo Lit': 'halo_lit',
  'Push Thru': 'push_thru',
  // 'Dual Lit - Double Layer' — future: separate spec type
};

/** Spec type key → rule key in the rules dict sent to Python */
const SPEC_TYPE_RULE_KEY_MAP: Record<string, string> = {
  'front_lit': 'front_lit_structure',
  'front_lit_acrylic_face': 'front_lit_acrylic_face_structure',
  'halo_lit': 'halo_lit_structure',
  'push_thru': 'push_thru_structure',
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
  profileMap?: Map<string, VectorValidationProfile>,
  specsDisplayNames: string[] = [],
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

  // Front Lit / Dual Lit rules (Dual Lit maps to front_lit spec type)
  if (specTypes.has('front_lit')) {
    const p = profileMap?.get('front_lit')?.parameters;
    const trimMin = p?.trim_offset_min_mm ?? 1.5;
    const trimMax = p?.trim_offset_max_mm ?? 2.5;
    const trimSpacing = p?.min_trim_spacing_inches ?? 0.15;

    const hasDualLit = specsDisplayNames.some(n => DUAL_LIT_PRODUCT_NAMES.includes(n));
    const hasPureFrontLit = specsDisplayNames.some(n => n === 'Front Lit');
    const hasLEDs = specsDisplayNames.some(n => n === 'LEDs');
    // TODO: Mixed orders (Front Lit + Dual Lit) — currently we can't map individual
    // SVG letters to specific order parts, so we apply the stricter Dual Lit rules
    // to all letters. Future: associate letters with parts to apply per-letter rules.
    const category = hasDualLit
      ? 'Dual Lit - Single Layer'
      : 'Front Lit Channel Letters';
    const minMounting = hasDualLit ? 3 : 2;

    // Only show wire hole rule when LEDs spec is present
    if (hasLEDs) {
      rules.push({
        rule_key: 'front_lit_wire_holes',
        name: 'Wire Hole Check',
        description: 'Each letter requires 1 wire hole (9.7mm)',
        category,
      });
    }

    rules.push(
      {
        rule_key: 'front_lit_mounting_holes',
        name: 'Mounting Holes',
        description: `Min ${minMounting} per letter; 1 per 20" perimeter; 1 per 81 sq in area`,
        category,
      },
      {
        rule_key: 'front_lit_trim_offset',
        name: 'Trim Cap Offset',
        description: `Trim must be ${trimMin}\u2013${trimMax}mm larger than return per side`,
        category,
      },
      {
        rule_key: 'front_lit_layer_matching',
        name: 'Layer Matching',
        description: 'Return and Trimcap layers must have same letter count',
        category,
      },
      {
        rule_key: 'front_lit_trim_spacing',
        name: 'Trim Cap Spacing',
        description: `Trim cap letters must be at least ${trimSpacing}" apart (with miter)`,
        category,
      },
      {
        rule_key: 'front_lit_trim_missing',
        name: 'Trim Cap Layer Required',
        description: 'Working file must include a trimcap layer with letters',
        category,
      },
      {
        rule_key: 'hole_centering',
        name: 'Hole Centering',
        description: 'Pin thread and rivnut holes should be centered within the letter stroke',
        category,
      },
    );
  }

  // Front Lit Acrylic Face rules
  if (specTypes.has('front_lit_acrylic_face')) {
    const p = profileMap?.get('front_lit_acrylic_face')?.parameters;
    const faceSpacing = p?.min_face_spacing_inches ?? 0.10;
    const faceOffset = p?.face_offset_min_mm ?? 0.3;
    const engravingOffset = p?.engraving_offset_mm ?? 4.0;
    const hasLEDsAcrylic = specsDisplayNames.some(n => n === 'LEDs');

    // Only show wire hole rule when LEDs spec is present
    if (hasLEDsAcrylic) {
      rules.push({
        rule_key: 'acrylic_face_wire_holes',
        name: 'Wire Hole Check',
        description: 'Each return letter requires 1 wire hole (9.7mm)',
        category: 'Front Lit Acrylic Face',
      });
    }

    rules.push(
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

  // Halo Lit rules
  if (specTypes.has('halo_lit')) {
    const p = profileMap?.get('halo_lit')?.parameters;
    const backOffset = p?.back_offset_min_mm ?? 2.0;
    const faceOffset = p?.face_offset_min_mm ?? 1.2;
    const hasLEDsHalo = specsDisplayNames.some(n => n === 'LEDs');

    if (hasLEDsHalo) {
      rules.push({
        rule_key: 'halo_lit_back_wire_hole',
        name: 'Wire Holes (Back)',
        description: 'Each back letter requires 1 wire hole if LEDs exist',
        category: 'Halo Lit',
      });
    }

    rules.push(
      {
        rule_key: 'halo_lit_return_no_holes',
        name: 'Return No Holes',
        description: 'Return layer letters must have no holes',
        category: 'Halo Lit',
      },
      {
        rule_key: 'halo_lit_back_missing',
        name: 'Back Layer Required',
        description: 'Working file must include a back layer',
        category: 'Halo Lit',
      },
      {
        rule_key: 'halo_lit_back_offset',
        name: 'Back Offset',
        description: `Back must be ${backOffset}mm smaller than return per side`,
        category: 'Halo Lit',
      },
      {
        rule_key: 'halo_lit_back_mounting',
        name: 'Mounting Holes (Back)',
        description: 'Min 2 per back letter; same formula as Front Lit',
        category: 'Halo Lit',
      },
      {
        rule_key: 'halo_lit_face_missing',
        name: 'Face Layer Required',
        description: 'Working file must include a face layer',
        category: 'Halo Lit',
      },
      {
        rule_key: 'halo_lit_face_offset',
        name: 'Face Offset',
        description: `Face must be ${faceOffset}mm larger than return per side`,
        category: 'Halo Lit',
      },
      {
        rule_key: 'hole_centering',
        name: 'Hole Centering',
        description: 'Pin thread/rivnut holes centered in back layer stroke',
        category: 'Halo Lit',
      },
    );
  }

  // Push Thru rules
  if (specTypes.has('push_thru')) {
    const p = profileMap?.get('push_thru')?.parameters;
    const cutoutOffset = p?.cutout_offset_mm ?? 0.8;
    const acrylicInset = p?.min_acrylic_inset_from_box_inches ?? 3.0;
    const lexanInset = p?.lexan_inset_from_box_inches ?? 2.25;
    const acrylicConvex = p?.acrylic_convex_radius_inches ?? 0.028;
    const acrylicConcave = p?.acrylic_concave_radius_inches ?? 0.059;
    const cutoutConvex = p?.cutout_convex_radius_inches ?? 0.059;
    const cutoutConcave = p?.cutout_concave_radius_inches ?? 0.028;
    const ledBoxOffset = Math.abs(p?.led_box_offset_inches ?? 0.16);

    rules.push(
      {
        rule_key: 'push_thru_cutout_count',
        name: 'Cutout Count',
        description: 'Each acrylic letter must have a matching backer cutout',
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_cutout_offset',
        name: 'Cutout Offset',
        description: `Backer cutouts must be ${cutoutOffset}mm larger than acrylic (uniform rounded offset)`,
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_sharp_corners',
        name: 'No Sharp Corners',
        description: 'All corners on acrylic and cutouts must be rounded',
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_acrylic_corner_radius',
        name: 'Acrylic Corner Radii',
        description: `Acrylic convex \u2265${acrylicConvex}", concave \u2265${acrylicConcave}"`,
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_cutout_corner_radius',
        name: 'Cutout Corner Radii',
        description: `Cutout convex \u2265${cutoutConvex}", concave \u2265${cutoutConcave}"`,
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_acrylic_inset',
        name: 'Acrylic Inset',
        description: `Acrylic letters must be \u2265${acrylicInset}" from backer box edge`,
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_lexan_exists',
        name: 'Lexan Layer Required',
        description: 'A lexan layer must be present in the file',
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_lexan_simple',
        name: 'Lexan Simple Paths',
        description: 'Lexan paths must be simple (not compound)',
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_lexan_containment',
        name: 'Lexan Containment',
        description: 'Every backer cutout must be contained within a lexan path',
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_lexan_inset',
        name: 'Lexan Inset',
        description: `Lexan must be \u2265${lexanInset}" inside backer box`,
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_led_box_exists',
        name: 'LED Box',
        description: 'Each backer box should have a paired LED box',
        category: 'Push Thru',
      },
      {
        rule_key: 'push_thru_led_box_offset',
        name: 'LED Box Offset',
        description: `LED box must be ${ledBoxOffset}" smaller than backer per side`,
        category: 'Push Thru',
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
