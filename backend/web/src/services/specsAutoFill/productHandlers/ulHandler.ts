// File Clean up Finished: Nov 13, 2025
/**
 * UL Product Handler
 *
 * Auto-fills specifications for UL (Underwriters Laboratories) certification:
 * - Detects if UL is mentioned in QB item name or calculation display
 * - Sets UL include field to 'true' when UL items are detected
 */

import { AutoFillInput } from '../types';

/**
 * Auto-fill specs for UL
 */
export async function autoFillUL(
  input: AutoFillInput,
  specs: any,
  warnings: string[],
  filledFields: string[],
  connection?: any
): Promise<void> {
  console.log('[Specs Auto-Fill] Processing UL');

  // Find UL template row
  let ulRow: number | null = null;
  for (let i = 1; i <= 10; i++) {
    if (specs[`_template_${i}`] === 'UL') {
      ulRow = i;
      break;
    }
  }

  if (!ulRow) {
    console.log('[Specs Auto-Fill] No UL template found');
    return;
  }

  // Check if there are any UL-related power supplies in the order
  // The research indicated UL should be set to Yes when UL items exist
  // For now, we'll check if the QB item name or calculation display mentions UL
  const hasUL = input.qbItemName?.includes('UL') ||
                input.calculationDisplay?.includes('UL') ||
                false;

  if (hasUL) {
    const ulField = `row${ulRow}_include`;
    specs[ulField] = 'true';
    filledFields.push(ulField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${ulField} = "true" (UL item detected)`);
  }
}
