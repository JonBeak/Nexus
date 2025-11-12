/**
 * Specification Formatters
 * Constants and functions for formatting specification values in PDFs
 */

import { FormType } from '../generators/pdfCommonGenerator';
import { formatBooleanValue } from '../generators/pdfCommonGenerator';

/**
 * Define spec ordering - templates will be rendered in this order
 */
export const SPEC_ORDER = [
  'Return',
  'Trim',
  'Face',
  'Vinyl',
  'Digital Print',
  'Material',
  'Cutting',
  'Box Material',
  'Extr. Colour',
  'Push Thru Acrylic',
  'Neon Base',
  'Neon LED',
  'Painting',
  'D-Tape',
  'Pins',
  'Mounting',
  'Cut',
  'Peel',
  'Mask',
  'Back',
  'LEDs',
  'Power Supply',
  'Wire Length',
  'UL',
  'Drain Holes',
  'Assembly',
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
  'Material Cut'
] as const;

/**
 * Format spec values based on template name using named keys
 */
export function formatSpecValues(templateName: string, specs: Record<string, any>, formType: FormType): string {
  if (!specs || Object.keys(specs).length === 0) return '';

  switch (templateName) {
    case 'Return':
      // Format: depth + " " + colour (e.g., "3" White")
      const depth = specs.depth || specs.return_depth || '';
      const colour = specs.colour || specs.color || '';
      return [depth, colour].filter(v => v).join(' ');

    case 'Face':
      // Format as {material} [{colour}] (swap order)
      const faceMaterial = specs.material || '';
      const faceColour = specs.colour || specs.color || '';
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
      const ledCount = specs.count || '';
      let ledType = specs.type || specs.led_type || '';

      // Shorten LED type: keep only part before " - "
      if (ledType && ledType.includes(' - ')) {
        ledType = ledType.split(' - ')[0].trim();
      }

      // Customer form: Replace count with "Yes" if it's a number > 0, but preserve type
      if (formType === 'customer') {
        const countNum = Number(ledCount);
        if (!isNaN(countNum) && countNum > 0) {
          // Count is a valid number > 0, show "Yes [type]"
          return ledType ? `Yes [${ledType}]` : 'Yes';
        } else if (ledType) {
          // No count, but has type
          return ledType;
        }
        return 'No';
      }

      // Master/Shop: Format as {count} [{led_type}]
      if (ledCount && ledType) {
        return `${ledCount} [${ledType}]`;
      } else if (ledCount) {
        return ledCount;
      } else if (ledType) {
        return ledType;
      }
      return '';

    case 'Wire Length':
      // Add " ft" unit if not already present
      const wireLength = specs.length || specs.wire_length || '';
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
      const psCount = specs.count || '';
      let psType = specs.ps_type || specs.model || specs.power_supply || '';

      // Shorten PS type: keep only part before " ("
      if (psType && psType.includes(' (')) {
        psType = psType.split(' (')[0].trim();
      }

      // Customer form: Replace count with "Yes" if it's a number > 0, but preserve type
      if (formType === 'customer') {
        const countNum = Number(psCount);
        if (!isNaN(countNum) && countNum > 0) {
          // Count is a valid number > 0, show "Yes [type]"
          return psType ? `Yes [${psType}]` : 'Yes';
        } else if (psType) {
          // No count, but has type
          return psType;
        }
        return 'No';
      }

      // Master/Shop: Format as {count} [{ps_type}]
      if (psCount && psType) {
        return `${psCount} [${psType}]`;
      } else if (psCount) {
        return psCount;
      } else if (psType) {
        return psType;
      }
      return '';

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
      const vinylCode = specs.colours || specs.vinyl_code || specs.code || '';
      const vinylApplication = specs.application || '';
      if (vinylCode && vinylApplication) {
        return `${vinylCode} [${vinylApplication}]`;
      }
      return vinylCode || '';

    case 'Digital Print':
      // Template stores: colour, type, application
      // Format as {colour} - {type} [{application}]
      const dpColour = specs.colour || specs.color || '';
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
      const paintColour = specs.colour || specs.color || '';
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
      const matColour = specs.colour || specs.color || '';
      const substrate = specs.substrate || '';
      if (matColour && substrate) {
        return `${matColour} - ${substrate}`;
      }
      return [matColour, substrate].filter(v => v).join(' ');

    case 'Box Material':
      // Template stores: material, colour
      // Format as {colour} - {material}
      const boxColour = specs.colour || specs.color || '';
      const boxMaterial = specs.material || '';
      if (boxColour && boxMaterial) {
        return `${boxColour} - ${boxMaterial}`;
      }
      return [boxColour, boxMaterial].filter(v => v).join(' ');

    case 'Push Thru Acrylic':
      // Template stores: thickness, colour
      // Format as {thickness} - {colour}
      const ptThickness = specs.thickness || '';
      const ptColour = specs.colour || specs.color || '';
      if (ptThickness && ptColour) {
        return `${ptThickness} - ${ptColour}`;
      }
      return [ptThickness, ptColour].filter(v => v).join(' ');

    case 'Neon Base':
      // Template stores: thickness, material, colour
      // Format as {thickness} {colour} {material}
      const neonBaseThickness = specs.thickness || '';
      const neonBaseMaterial = specs.material || '';
      const neonBaseColour = specs.colour || specs.color || '';
      return [neonBaseThickness, neonBaseColour, neonBaseMaterial].filter(v => v).join(' ');

    case 'Neon LED':
      // Template stores: stroke_width, colour
      // Format as {stroke_width} - {colour}
      const strokeWidth = specs.stroke_width || '';
      const neonColour = specs.colour || specs.color || '';
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
      // Template stores: count, pins, spacers
      // Format as [{count} pcs] {pins} + {spacers}
      // Pins or Spacers are optional
      const pinCount = specs.count || '';
      const pinType = specs.pins || '';
      const spacerType = specs.spacers || '';

      const pinsParts: string[] = [];
      if (pinCount) {
        pinsParts.push(`[${pinCount} pcs]`);
      }

      const components: string[] = [];
      if (pinType) components.push(pinType);
      if (spacerType) components.push(spacerType);

      if (components.length > 0) {
        pinsParts.push(components.join(' + '));
      }

      return pinsParts.join(' ');

    default:
      // Default: join all non-empty values with comma and space
      return Object.values(specs).filter(v => v !== null && v !== undefined && v !== '').join(', ');
  }
}
