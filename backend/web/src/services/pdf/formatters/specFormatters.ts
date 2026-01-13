// File Clean up Finished: 2025-11-15

/**
 * Specification Formatters
 * Constants and functions for formatting specification values in PDFs
 *
 * FUTURE IMPROVEMENT (Option C):
 * Consider extracting all format patterns into a declarative configuration object
 * using a formatting strategy pattern. This would make adding new spec types
 * trivial and move formatting rules from code to data. Trade-off: more abstraction
 * vs current explicit switch-case clarity. Evaluate after Option B proves stable.
 */

import { FormType } from '../generators/pdfConstants';
import { formatBooleanValue } from '../generators/pdfHelpers';

/**
 * Define spec ordering - templates will be rendered in this order
 *
 * NOTE: Box Material and Box Type are aliases (Box Type is the preferred name).
 * Both are included for backward compatibility. During sorting, Box Material is
 * normalized to Box Type. They share the same sort position.
 *
 * PAIRING BEHAVIOR: When Box Type/Material + Cutting or Material + Cutting appear
 * consecutively in the raw input (rowNum N and N+1), they are kept together as pairs
 * and sorted by the first element's position (Box Type/Material, NOT Cutting).
 */
export const SPEC_ORDER = [
  'Return',
  '3DP Return',
  '3DP Illumination',
  'Trim',
  'Face',
  'Back',
  'Material',
  'Neon Base',
  'Box Material',
  'Box Type',       // Alias for Box Material (preferred name)
  'Extr. Colour',
  'Cutting',
  'Acrylic',
  'Vinyl',
  'Digital Print',
  'Painting',
  'D-Tape',
  'Pins',
  'Mounting',
  'Cut',
  'Peel',
  'Mask',
  'Assembly',
  'LEDs',
  'Neon LED',
  'Power Supply',
  'Wire Length',
  'UL',
  'Drain Holes',
  'Notes'
] as const;

export const CRITICAL_SPECS = ['LEDs', 'Power Supply', 'UL'] as const;

// Specs display names that DO NOT require mandatory LEDs/PS/UL
export const SPECS_EXEMPT_FROM_CRITICAL = [
  'Trim Cap',
  'Vinyl Cut',
  'Vinyl',
  'Frame',
  'Custom',
  'Aluminum Raceway',
  'Extrusion Raceway',
  'Material Cut',
  'Painting'
] as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get colour value handling British/American spelling variants
 */
function getColourValue(specs: Record<string, any>): string {
  return specs.colour || specs.color || '';
}

/**
 * Get spec field value with fallback support
 * Tries each field name in order and returns the first non-empty value
 */
function getSpecField(specs: Record<string, any>, ...fieldNames: string[]): string {
  for (const field of fieldNames) {
    if (specs[field]) return specs[field];
  }
  return '';
}

/**
 * Format count/type specifications (used for LEDs and Power Supply)
 * Handles both customer form (Yes/No) and master/shop forms (count + type)
 *
 * @param specs - Specification object
 * @param countField - Field name for count value
 * @param typeFields - Array of possible field names for type (in priority order)
 * @param typeSplitPattern - Pattern to split type string (e.g., ' - ' or ' (')
 * @param formType - Form type (master, customer, shop)
 * @returns Formatted string
 */
function formatCountTypeSpec(
  specs: Record<string, any>,
  countField: string,
  typeFields: string[],
  typeSplitPattern: string,
  formType: FormType
): string {
  const count = specs[countField] || '';
  let type = getSpecField(specs, ...typeFields);

  // Shorten type: keep only part before split pattern
  if (type && type.includes(typeSplitPattern)) {
    type = type.split(typeSplitPattern)[0].trim();
  }

  // Customer form: Replace count with "Yes/No" but preserve type
  if (formType === 'customer') {
    const countNum = Number(count);
    if (!isNaN(countNum) && countNum > 0) {
      return type ? `Yes [${type}]` : 'Yes';
    } else if (type) {
      return type;
    }
    return 'No';
  }

  // Master/Shop: Format as {count} [{type}]
  if (count && type) {
    return `${count} [${type}]`;
  } else if (count) {
    return count;
  } else if (type) {
    return type;
  }
  return '';
}

/**
 * Compute illumination description from boolean values
 * Used for 3DP Illumination template
 *
 * Combinations:
 * - All three: "Face, Halo, Side Lit."
 * - Face + Side: "Face, Side Lit. No Halo"
 * - Face + Halo: "Face, Halo Lit. No Side"
 * - Side + Halo: "Side, Halo Lit. No Face"
 * - Face only: "Face Lit. No Side or Halo"
 * - Side only: "Side Lit. No Face or Halo"
 * - Halo only: "Halo Lit. No Face or Side"
 * - None: "No illumination"
 */
function computeIlluminationDescription(face: boolean, side: boolean, halo: boolean): string {
  const litParts: string[] = [];
  const notLitParts: string[] = [];

  if (face) litParts.push('Face');
  else notLitParts.push('Face');

  if (side) litParts.push('Side');
  else notLitParts.push('Side');

  if (halo) litParts.push('Halo');
  else notLitParts.push('Halo');

  if (litParts.length === 0) {
    return 'No illumination';
  }

  if (litParts.length === 3) {
    return 'Face, Halo, Side Lit.';
  }

  const litStr = litParts.join(', ') + ' Lit.';

  if (notLitParts.length === 1) {
    return `${litStr} No ${notLitParts[0]}`;
  }

  return `${litStr} No ${notLitParts[0]} or ${notLitParts[1]}`;
}

// ============================================
// MAIN FORMATTING FUNCTION
// ============================================

/**
 * Format spec values based on template name using named keys
 */
export function formatSpecValues(templateName: string, specs: Record<string, any>, formType: FormType): string {
  if (!specs || Object.keys(specs).length === 0) return '';

  switch (templateName) {
    case 'Return':
      // Format: depth + " " + colour (e.g., "3" White")
      const depth = getSpecField(specs, 'depth', 'return_depth');
      const colour = getColourValue(specs);
      return [depth, colour].filter(v => v).join(' ');

    case '3DP Return':
      // Format: depth - face_material (e.g., "1.5" - 4.5mm Acrylic")
      const tdpDepth = specs.depth || '';
      const tdpFaceMaterial = specs.face_material || '';
      if (tdpDepth && tdpFaceMaterial) {
        return `${tdpDepth} - ${tdpFaceMaterial}`;
      }
      return [tdpDepth, tdpFaceMaterial].filter(v => v).join(' ');

    case '3DP Illumination':
      // Compute illumination description from boolean values
      return computeIlluminationDescription(
        formatBooleanValue(specs.face_lit) === 'Yes',
        formatBooleanValue(specs.side_lit) === 'Yes',
        formatBooleanValue(specs.halo_lit) === 'Yes'
      );

    case 'Face':
      // Format as {material} [{colour}] (swap order)
      const faceMaterial = specs.material || '';
      const faceColour = getColourValue(specs);
      if (faceMaterial && faceColour) {
        return `${faceMaterial} [${faceColour}]`;
      }
      return [faceMaterial, faceColour].filter(v => v).join(' ');

    case 'Drain Holes':
      // Template stores: include (boolean), size (combobox)
      // Format as Yes/No, or Yes [size] if size is specified
      const drainInclude = formatBooleanValue(specs.include);
      const drainSize = specs.size || '';
      if (drainInclude === 'Yes' && drainSize) {
        return `${drainInclude} [${drainSize}]`;
      }
      return drainInclude || '';

    case 'LEDs':
      // Template stores: count, led_type (full string), note
      return formatCountTypeSpec(specs, 'count', ['type', 'led_type'], ' - ', formType);

    case 'Wire Length':
      // Add " ft" unit if not already present
      const wireLength = getSpecField(specs, 'length', 'wire_length');
      const wireGauge = specs.wire_gauge || '';
      const wireLengthWithUnit = wireLength && !String(wireLength).toLowerCase().includes('ft')
        ? `${wireLength} ft`
        : wireLength;

      if (wireLengthWithUnit && wireGauge) {
        return `${wireLengthWithUnit} [${wireGauge}]`;
      }
      return wireLengthWithUnit || '';

    case 'Power Supply':
      // Template stores: count, ps_type (full string), note
      return formatCountTypeSpec(specs, 'count', ['ps_type', 'model', 'power_supply'], ' (', formType);

    case 'UL':
      // Template stores: include (boolean), note (textbox)
      // Format as Yes/No, or Yes - note if note is specified
      const ulInclude = formatBooleanValue(specs.include);
      const ulNote = specs.note || '';
      if (ulInclude === 'Yes' && ulNote) {
        return `${ulInclude} - ${ulNote}`;
      }
      return ulInclude || '';

    case 'Vinyl':
      // Format as {colours/vinyl_code} [{application}] (don't show size/yardage)
      const vinylCode = getSpecField(specs, 'colours', 'vinyl_code', 'code');
      const vinylApplication = specs.application || '';
      if (vinylCode && vinylApplication) {
        return `${vinylCode} [${vinylApplication}]`;
      }
      return vinylCode || '';

    case 'Digital Print':
      // Template stores: colour, type, application
      // Format as {colour} - {type} [{application}]
      const dpColour = getColourValue(specs);
      const dpType = specs.type || '';
      const dpApplication = specs.application || '';

      if (dpColour && dpType && dpApplication) {
        return `${dpColour} - ${dpType} [${dpApplication}]`;
      } else if (dpColour && dpType) {
        return `${dpColour} - ${dpType}`;
      } else if (dpColour) {
        return dpColour;
      }
      return [dpType, dpApplication].filter(v => v).join(' ');

    case 'Painting':
      // Template stores: colour, component, timing
      // Format as {colour} [{component}] (ignore timing)
      const paintColour = getColourValue(specs);
      const paintComponent = specs.component || '';
      if (paintColour && paintComponent) {
        return `${paintColour} [${paintComponent}]`;
      } else if (paintColour) {
        return paintColour;
      }
      return '';

    case 'Material':
      // Template stores: substrate, colour
      // Format as {colour} - {substrate}
      const matColour = getColourValue(specs);
      const substrate = specs.substrate || '';
      if (matColour && substrate) {
        return `${matColour} - ${substrate}`;
      }
      return [matColour, substrate].filter(v => v).join(' ');

    case 'Box Material':
      // Template stores: material, colour
      // Format as {colour} - {material}
      const boxColour = getColourValue(specs);
      const boxMaterial = specs.material || '';
      if (boxColour && boxMaterial) {
        return `${boxColour} - ${boxMaterial}`;
      }
      return [boxColour, boxMaterial].filter(v => v).join(' ');

    case 'Acrylic':
      // Template stores: thickness, colour
      // Format as {thickness} - {colour}
      const ptThickness = specs.thickness || '';
      const ptColour = getColourValue(specs);
      if (ptThickness && ptColour) {
        return `${ptThickness} - ${ptColour}`;
      }
      return [ptThickness, ptColour].filter(v => v).join(' ');

    case 'Neon Base':
      // Template stores: thickness, material, colour
      // Format as {thickness} {colour} {material}
      const neonBaseThickness = specs.thickness || '';
      const neonBaseMaterial = specs.material || '';
      const neonBaseColour = getColourValue(specs);
      return [neonBaseThickness, neonBaseColour, neonBaseMaterial].filter(v => v).join(' ');

    case 'Neon LED':
      // Template stores: stroke_width, colour
      // Format as {stroke_width} - {colour}
      const strokeWidth = specs.stroke_width || '';
      const neonColour = getColourValue(specs);
      if (strokeWidth && neonColour) {
        return `${strokeWidth} - ${neonColour}`;
      }
      return [strokeWidth, neonColour].filter(v => v).join(' ');

    case 'D-Tape':
      // Template stores: include (boolean), thickness
      // Format as {include} - {thickness}
      const dtInclude = formatBooleanValue(specs.include);
      const dtThickness = specs.thickness || '';
      if (dtInclude && dtThickness) {
        return `${dtInclude} - ${dtThickness}`;
      }
      return dtInclude || '';

    case 'Pins':
    case 'Mounting':
      // Template stores: count, pins, spacers
      // Format as {pins} + {spacers} (no count shown)
      // Pins or Spacers are optional
      const pinType = specs.pins || '';
      const spacerType = specs.spacers || '';

      const components: string[] = [];
      if (pinType) components.push(pinType);
      if (spacerType) components.push(spacerType);

      return components.join(' + ');

    default:
      // Default: join all non-empty values with comma and space
      return Object.values(specs).filter(v => v !== null && v !== undefined && v !== '').join(', ');
  }
}
