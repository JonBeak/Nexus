/**
 * Substrate Cut Product Handler
 * Auto-fill logic for Substrate Cut products (productTypeId=3)
 *
 * Templates typically include: Material, Cutting, Mounting, D-Tape
 */

import { AutoFillInput, ParsedData } from '../types';
import { extractSubstrateMaterial } from '../parsers/substrateParser';

/**
 * Auto-fill specs for Substrate Cut
 *
 * Extracts:
 * - Material substrate from calculationDisplay (e.g., "Acrylic 12mm [24x96]@$370" -> "Acrylic 12mm")
 * - Mounting count from pins info (e.g., "104 Pins + Rivnut + Spacer @ $3/ea: $312" -> 104)
 */
export function autoFillSubstrateCut(
  input: AutoFillInput,
  parsed: ParsedData,
  specs: any,
  warnings: string[],
  filledFields: string[]
): void {
  console.log('[Specs Auto-Fill] Processing Substrate Cut');

  // Find template row positions
  let materialRow: number | null = null;
  let mountingRow: number | null = null;
  let dTapeRow: number | null = null;

  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    if (templateName === 'Material') materialRow = i;
    if (templateName === 'Mounting') mountingRow = i;
    if (templateName === 'D-Tape') dTapeRow = i;
  }

  // Auto-fill Material substrate from calculation display
  // Format: "Acrylic 12mm [24x96]@$370: $281.25" -> "Acrylic 12mm"
  if (materialRow) {
    const substrateMaterial = extractSubstrateMaterial(input.calculationDisplay || '');
    if (substrateMaterial) {
      const substrateField = `row${materialRow}_substrate`;
      specs[substrateField] = substrateMaterial;
      filledFields.push(substrateField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${substrateField} = "${substrateMaterial}"`);
    } else {
      // Only warn if calculationDisplay exists but parsing failed
      if (input.calculationDisplay && input.calculationDisplay.trim()) {
        warnings.push('Could not extract substrate material from calculation display');
        console.warn('[Specs Auto-Fill] ⚠ Failed to extract substrate material from:', input.calculationDisplay?.substring(0, 50));
      }
    }
  }

  // Auto-fill Mounting count from parsed data
  // The parsed data already contains count extracted from patterns like:
  // "104 Pins + Rivnut + Spacer @ $3/ea: $312" -> count=104
  // "50 Stand Offs @ $3/ea: $150" -> count=50
  const hasMountingHardware = parsed.hasPins || parsed.hasStandOffs;
  if (mountingRow && hasMountingHardware) {
    if (parsed.count) {
      const countField = `row${mountingRow}_count`;
      specs[countField] = parsed.count.toString();
      filledFields.push(countField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${countField} = "${parsed.count}"`);
    } else {
      warnings.push('Mounting hardware detected but could not extract pin count');
      console.warn('[Specs Auto-Fill] ⚠ Mounting detected but count extraction failed');
    }
  }

  // Auto-fill D-Tape include only if D-Tape is detected in calculation
  if (dTapeRow) {
    const calculationText = input.calculationDisplay || '';
    const hasDTape = /d[- ]?tape/i.test(calculationText);

    if (hasDTape) {
      const includeField = `row${dTapeRow}_include`;
      specs[includeField] = 'true';
      filledFields.push(includeField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${includeField} = "true" (D-Tape detected)`);
    }
    // If D-Tape not found, leave empty for manual entry
  }
}
