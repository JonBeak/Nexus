// File Clean up Finished: Nov 13, 2025
/**
 * Push Thru Product Handler
 *
 * Auto-fills specifications for Push Thru and Knockout Box products:
 * - Box Material (1mm Aluminum or 3mm ACM based on calculation display)
 * - Acrylic thickness (default 12mm)
 * - Acrylic colour (default 2447 White)
 */

import { AutoFillInput, ParsedData } from '../types';

/**
 * Auto-fill specs for Push Thru products
 */
export function autoFillPushThru(
  input: AutoFillInput,
  parsed: ParsedData,
  specs: any,
  warnings: string[],
  filledFields: string[]
): void {
  console.log('[Specs Auto-Fill] Processing Push Thru');

  // Find template positions
  let boxMaterialRow: number | null = null;
  let acrylicRow: number | null = null;

  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    if (templateName === 'Box Material') boxMaterialRow = i;
    if (templateName === 'Acrylic') acrylicRow = i;
  }

  // Auto-fill Box Material based on calculationDisplay
  if (boxMaterialRow && input.calculationDisplay) {
    const calcDisplay = input.calculationDisplay;

    if (calcDisplay.includes('Aluminum')) {
      const materialField = `row${boxMaterialRow}_material`;
      specs[materialField] = '1mm Aluminum';
      filledFields.push(materialField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${materialField} = "1mm Aluminum"`);
    } else if (calcDisplay.includes('ACM')) {
      const materialField = `row${boxMaterialRow}_material`;
      specs[materialField] = '3mm ACM';
      filledFields.push(materialField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${materialField} = "3mm ACM"`);
    }
  }

  // Auto-fill Acrylic defaults
  if (acrylicRow) {
    const thicknessField = `row${acrylicRow}_thickness`;
    const colourField = `row${acrylicRow}_colour`;

    specs[thicknessField] = '12mm';
    specs[colourField] = '2447 White';

    filledFields.push(thicknessField, colourField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${thicknessField} = "12mm"`);
    console.log(`[Specs Auto-Fill] ✓ Filled ${colourField} = "2447 White"`);
  }
}
