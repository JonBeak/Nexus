/**
 * Backer Product Handler
 *
 * Auto-fills specifications for Backer products:
 * - Cutting method (default Router for all Backer items)
 */

import { AutoFillInput, ParsedData } from '../types';

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

  // Find Cutting template position
  let cuttingRow: number | null = null;

  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    if (templateName === 'Cutting') cuttingRow = i;
  }

  // Auto-fill Cutting method to Router for all Backer items
  if (cuttingRow) {
    const methodField = `row${cuttingRow}_method`;
    specs[methodField] = 'Router';
    filledFields.push(methodField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${methodField} = "Router"`);
  }
}
