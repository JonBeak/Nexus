// File Clean up Finished: Nov 13, 2025
/**
 * Channel Letters Handler
 * Auto-fill logic for Front Lit, Halo Lit, Dual Lit products
 */

import { AutoFillInput, ParsedData } from '../types';
import {
  getDefaultFaceMaterial,
  getDefaultFaceColor,
  getDefaultDrainHoles,
  getDefaultBackMaterial,
  getDefaultFrameColour
} from '../defaults';

/**
 * Auto-fill specs for Channel Letters (Front Lit, Halo Lit, Dual Lit)
 */
export function autoFillChannelLetters(
  input: AutoFillInput,
  parsed: ParsedData,
  specs: any,
  warnings: string[],
  filledFields: string[]
): void {
  console.log('[Specs Auto-Fill] Processing channel letters:', input.specsDisplayName);

  // Find template positions
  let returnRow: number | null = null;
  let faceRow: number | null = null;
  let backRow: number | null = null;
  let frameRow: number | null = null;
  let mountingRow: number | null = null;
  let drainHolesRow: number | null = null;

  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    if (templateName === 'Return') returnRow = i;
    if (templateName === 'Face') faceRow = i;
    if (templateName === 'Back') backRow = i;
    if (templateName === 'Frame') frameRow = i;
    if (templateName === 'Mounting') mountingRow = i;
    if (templateName === 'Drain Holes') drainHolesRow = i;
  }

  // Auto-fill Return depth
  if (returnRow && parsed.depth) {
    const depthField = `row${returnRow}_depth`;
    specs[depthField] = parsed.depth;
    filledFields.push(depthField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${depthField} = "${parsed.depth}"`);
  } else if (returnRow && !parsed.depth) {
    warnings.push('Could not extract depth from QB item name for Return spec');
    console.warn('[Specs Auto-Fill] ⚠ Failed to extract depth for Return');
  }

  // Auto-fill Face material and color
  if (faceRow) {
    const material = getDefaultFaceMaterial(input.specsDisplayName);
    const color = getDefaultFaceColor(input.specsDisplayName);

    if (material) {
      const materialField = `row${faceRow}_material`;
      specs[materialField] = material;
      filledFields.push(materialField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${materialField} = "${material}"`);
    }

    if (color) {
      const colorField = `row${faceRow}_colour`;
      specs[colorField] = color;
      filledFields.push(colorField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${colorField} = "${color}"`);
    }
  }

  // Auto-fill Back material
  if (backRow) {
    const backMaterial = getDefaultBackMaterial(input.specsDisplayName);

    if (backMaterial) {
      const backMaterialField = `row${backRow}_material`;
      specs[backMaterialField] = backMaterial;
      filledFields.push(backMaterialField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${backMaterialField} = "${backMaterial}"`);
    }
  }

  // Auto-fill Frame colour
  if (frameRow) {
    const frameColour = getDefaultFrameColour();
    const frameColourField = `row${frameRow}_colour`;
    specs[frameColourField] = frameColour;
    filledFields.push(frameColourField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${frameColourField} = "${frameColour}"`);
  }

  // Auto-fill Mounting count only (Pin Type and Spacer Type left for manual selection)
  if (mountingRow && parsed.hasPins) {
    if (parsed.count) {
      const countField = `row${mountingRow}_count`;
      specs[countField] = parsed.count.toString();
      filledFields.push(countField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${countField} = "${parsed.count}"`);
    } else {
      warnings.push('Mounting hardware detected in calculation but could not extract count');
      console.warn('[Specs Auto-Fill] ⚠ Mounting detected but count extraction failed');
    }
  }

  // Auto-fill Drain Holes
  if (drainHolesRow) {
    console.log(`[Specs Auto-Fill] Found Drain Holes at row ${drainHolesRow}`);
    console.log(`[Specs Auto-Fill] Customer pref for drain holes:`, input.customerPreferences?.drain_holes_yes_or_no);

    const drainHoles = getDefaultDrainHoles(
      input.specsDisplayName,
      input.customerPreferences?.drain_holes_yes_or_no
    );

    console.log(`[Specs Auto-Fill] getDefaultDrainHoles returned: "${drainHoles}"`);

    if (drainHoles) {
      const drainHolesField = `row${drainHolesRow}_include`;
      specs[drainHolesField] = drainHoles;
      filledFields.push(drainHolesField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${drainHolesField} = "${drainHoles}"`);

      // If drain holes are included, auto-fill size with default 1/4"
      if (drainHoles === 'true') {
        const sizeField = `row${drainHolesRow}_size`;
        specs[sizeField] = '1/4"';
        filledFields.push(sizeField);
        console.log(`[Specs Auto-Fill] ✓ Filled ${sizeField} = "1/4""`);
      }
    } else {
      console.log(`[Specs Auto-Fill] ⚠ getDefaultDrainHoles returned null, skipping drain holes auto-fill`);
    }
  } else {
    console.log(`[Specs Auto-Fill] No Drain Holes template found in specs`);
  }
}
