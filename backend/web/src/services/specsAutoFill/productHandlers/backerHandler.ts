/**
 * Backer Product Handler
 *
 * Auto-fills specifications for Backer products:
 * - Box Type: Material and Fabrication based on backer type
 * - Cutting method (default Router for all Backer items)
 * - Assembly: Left empty
 */

import { AutoFillInput, ParsedData } from '../types';

/**
 * Backer type configuration
 * Maps QB item names to their Box Type spec values
 */
const BACKER_TYPE_CONFIG: Record<string, { material: string; fabrication: string }> = {
  'aluminum backer': {
    material: '1mm Aluminum',
    fabrication: 'Folded'
  },
  'acm backer': {
    material: '3mm ACM',
    fabrication: '2" Angle Return'
  }
};

/**
 * Auto-fill specs for Backer products
 */
export function autoFillBacker(
  input: AutoFillInput,
  parsed: ParsedData,
  specs: any,
  warnings: string[],
  filledFields: string[]
): void {
  console.log('[Specs Auto-Fill] Processing Backer');
  console.log(`[Specs Auto-Fill] QB Item Name: "${input.qbItemName}"`);

  // Find template positions
  let boxTypeRow: number | null = null;
  let cuttingRow: number | null = null;

  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    if (templateName === 'Box Type') boxTypeRow = i;
    if (templateName === 'Cutting') cuttingRow = i;
  }

  // Determine backer type from QB item name
  const normalizedQbItemName = (input.qbItemName || '').toLowerCase().trim();
  const backerConfig = BACKER_TYPE_CONFIG[normalizedQbItemName];

  // Auto-fill Box Type specs based on backer type
  if (boxTypeRow && backerConfig) {
    const materialField = `row${boxTypeRow}_material`;
    const fabricationField = `row${boxTypeRow}_fabrication`;

    specs[materialField] = backerConfig.material;
    filledFields.push(materialField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${materialField} = "${backerConfig.material}"`);

    specs[fabricationField] = backerConfig.fabrication;
    filledFields.push(fabricationField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${fabricationField} = "${backerConfig.fabrication}"`);
  } else if (boxTypeRow && !backerConfig) {
    console.log(`[Specs Auto-Fill] ⚠ Unknown backer type: "${input.qbItemName}" - Box Type not auto-filled`);
  }

  // Auto-fill Cutting method to Router for all Backer items
  if (cuttingRow) {
    const methodField = `row${cuttingRow}_method`;
    specs[methodField] = 'Router';
    filledFields.push(methodField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${methodField} = "Router"`);
  }

  // Assembly spec is left empty (no auto-fill needed)
}
