// File Clean up Finished: Nov 13, 2025
/**
 * Specs Auto-Fill Service
 *
 * Main orchestrator for intelligently auto-filling SPEC1, SPEC2, SPEC3 values during order conversion
 * based on estimate data, QB item names, and business rules.
 *
 * Flow:
 * 1. Parse source data (qb_item_name, calculationDisplay, calculationComponents)
 * 2. Apply product-specific business rules
 * 3. Auto-fill spec field values
 * 4. Return updated specifications JSON with logging
 *
 * Behavior:
 * - Non-blocking: Failed parsing leaves fields empty (manual entry)
 * - Logged: All parsing attempts are logged for debugging
 * - Extensible: Easy to add new product type rules
 */

import { AutoFillInput, AutoFillOutput } from './types';
import { parseSourceData } from './parsers';
import {
  autoFillBacker,
  autoFillChannelLetters,
  autoFillLeds,
  autoFillPowerSupplies,
  autoFillPushThru,
  autoFillUL,
  autoFillExtraWire,
  autoFillVinylAndDigitalPrint,
  autoFillSubstrateCut
} from './productHandlers';

/**
 * Auto-fill specifications based on estimate data and business rules
 *
 * This is the main entry point for the auto-fill service.
 * It orchestrates parsing, rule application, and field population.
 */
export async function autoFillSpecifications(input: AutoFillInput): Promise<AutoFillOutput> {
  console.log('\n========================================');
  console.log('🔧 SPECS AUTO-FILL FUNCTION CALLED!!!');
  console.log('========================================\n');
  console.log('\n=== SPECS AUTO-FILL START ===');
  console.log('[Specs Auto-Fill] Input:', {
    qbItemName: input.qbItemName,
    specsDisplayName: input.specsDisplayName,
    calculationDisplay: input.calculationDisplay?.substring(0, 100) + '...',
    hasComponents: !!input.calculationComponents,
    isParentOrRegular: input.isParentOrRegular
  });

  const warnings: string[] = [];
  const filledFields: string[] = [];
  const specs = { ...input.currentSpecifications };

  // Parse source data
  const parsed = parseSourceData(input);

  // Apply product-specific rules
  switch (input.specsDisplayName) {
    // Channel Letters and similar products (have Return, Face, Back, etc.)
    case 'Front Lit':
    case 'Halo Lit':
    case 'Front Lit Acrylic Face':
    case 'Dual Lit - Single Layer':
    case 'Dual Lit - Double Layer':
    case '3D print':
    case 'Blade Sign':
    case 'Marquee Bulb':
    case 'Return':
    case 'Material Cut':
      autoFillChannelLetters(input, parsed, specs, warnings, filledFields);

      // Auto-fill Face Assembly spec for products that have it (Halo Lit, Front Lit Acrylic Face)
      if (input.specsDisplayName === 'Halo Lit' || input.specsDisplayName === 'Front Lit Acrylic Face') {
        for (let i = 1; i <= 10; i++) {
          const templateName = specs[`_template_${i}`];
          if (!templateName) break;
          if (templateName === 'Face Assembly') {
            const descField = `row${i}_description`;
            const defaultDesc = input.specsDisplayName === 'Halo Lit'
              ? 'Face to Return'
              : 'Acrylic Tabs on Face';
            specs[descField] = defaultDesc;
            filledFields.push(descField);
            console.log(`[Specs Auto-Fill] ✓ Filled ${descField} = "${defaultDesc}" for ${input.specsDisplayName}`);
            break;
          }
        }
      }

      // Front Lit Acrylic Face specific adjustments
      if (input.specsDisplayName === 'Front Lit Acrylic Face') {
        for (let i = 1; i <= 10; i++) {
          const templateName = specs[`_template_${i}`];
          if (!templateName) break;

          // Adjust depth: subtract 0.1" from estimate depth (e.g., 3" -> 2.9")
          if (templateName === 'Return') {
            const depthField = `row${i}_depth`;
            const currentDepth = specs[depthField];
            if (currentDepth && typeof currentDepth === 'string') {
              const depthMatch = currentDepth.match(/^(\d+(?:\.\d+)?)(["']?)$/);
              if (depthMatch) {
                const numericDepth = parseFloat(depthMatch[1]);
                const adjustedDepth = (numericDepth - 0.1).toFixed(1).replace(/\.0$/, '') + '"';
                specs[depthField] = adjustedDepth;
                console.log(`[Specs Auto-Fill] ✓ Adjusted ${depthField} from "${currentDepth}" to "${adjustedDepth}" for Front Lit Acrylic Face`);
              }
            }
          }

          // Auto-fill Additional Notes
          if (templateName === 'Notes') {
            const notesField = `row${i}_additional_notes`;
            specs[notesField] = 'USE SMALLER PIECES FOR GLUING RETURNS';
            filledFields.push(notesField);
            console.log(`[Specs Auto-Fill] ✓ Filled ${notesField} = "USE SMALLER PIECES FOR GLUING RETURNS" for Front Lit Acrylic Face`);
          }
        }
      }
      break;

    // Trim Cap - uses channel letters handler for Face defaults
    case 'Trim Cap':
      autoFillChannelLetters(input, parsed, specs, warnings, filledFields);
      break;

    case 'LEDs':
      await autoFillLeds(input, parsed, specs, warnings, filledFields, input.connection);
      break;

    case 'Power Supplies':
      await autoFillPowerSupplies(input, parsed, specs, warnings, filledFields, input.connection);
      break;

    case 'Push Thru':
    case 'Knockout Box':
      autoFillPushThru(input, parsed, specs, warnings, filledFields);
      break;

    case 'Vinyl':
    case 'Digital Print':
      autoFillVinylAndDigitalPrint(input, specs, warnings, filledFields);
      break;

    case 'UL':
      await autoFillUL(input, specs, warnings, filledFields, input.connection);
      break;

    case 'Extra Wire':
      autoFillExtraWire(input, specs, warnings, filledFields);
      break;

    case 'Backer':
      autoFillBacker(input, parsed, specs, warnings, filledFields);
      break;

    case 'Substrate Cut':
      autoFillSubstrateCut(input, parsed, specs, warnings, filledFields);
      break;

    case 'Assembly':
      // Assembly specs get default description
      for (let i = 1; i <= 10; i++) {
        const templateName = specs[`_template_${i}`];
        if (!templateName) break;
        if (templateName === 'Assembly') {
          const descField = `row${i}_description`;
          specs[descField] = 'Yes, ___';
          filledFields.push(descField);
          console.log(`[Specs Auto-Fill] ✓ Filled ${descField} = "Yes, ___"`);
          break;
        }
      }
      break;

    case 'Extrusion Raceway':
      // Extrusion Raceway specs are left empty (colour and assembly for manual entry)
      console.log('[Specs Auto-Fill] Extrusion Raceway - no auto-fill (for manual entry)');
      break;

    default:
      console.log('[Specs Auto-Fill] No auto-fill rules defined for:', input.specsDisplayName);
  }

  console.log('[Specs Auto-Fill] Summary:', {
    filledFields: filledFields.length,
    warnings: warnings.length
  });
  console.log('=== SPECS AUTO-FILL END ===\n');

  return {
    specifications: specs,
    autoFilledFields: filledFields,
    warnings
  };
}

// Re-export types for convenience
export type { AutoFillInput, AutoFillOutput } from './types';
