// File Clean up Finished: Nov 14, 2025
// Previous cleanup: Nov 13, 2025
// Current cleanup (Nov 14, 2025):
// - Migrated from direct database connection.execute() to LEDService layer
// - Now follows 3-layer architecture for LED lookups
// - Removed direct SQL queries in favor of service methods
/**
 * LEDs Product Handler
 *
 * Auto-fills specifications for LED products including:
 * - LED count (extracted from calculation display)
 * - LED type (with fuzzy database matching via LEDService)
 * - Wire length (default 8ft)
 * - Wire gauge (18 AWG for most LEDs, 22 AWG for Strip LEDs)
 */

import { AutoFillInput, ParsedData } from '../types';
import { LEDService } from '../../ledService';

const ledService = new LEDService();

/**
 * Auto-fill specs for LEDs
 */
export async function autoFillLeds(
  input: AutoFillInput,
  parsed: ParsedData,
  specs: any,
  warnings: string[],
  filledFields: string[],
  connection?: any
): Promise<void> {
  console.log('[Specs Auto-Fill] Processing LEDs');

  // Find LEDs template position
  let ledsRow: number | null = null;
  let wireLengthRow: number | null = null;

  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    if (templateName === 'LEDs') {
      ledsRow = i;
    }
    if (templateName === 'Wire Length') {
      wireLengthRow = i;
    }
  }

  if (!ledsRow) {
    console.warn('[Specs Auto-Fill] ⚠ No LEDs template found');
    return;
  }

  // Auto-fill count
  if (parsed.count) {
    const countField = `row${ledsRow}_count`;
    specs[countField] = parsed.count.toString();
    filledFields.push(countField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${countField} = "${parsed.count}"`);
  } else {
    warnings.push('Could not extract LED count from calculation display');
    console.warn('[Specs Auto-Fill] ⚠ Failed to extract LED count');
  }

  // Auto-fill type with fuzzy matching via LEDService
  if (parsed.type) {
    try {
      // Use LEDService for fuzzy matching instead of direct SQL
      const matchedType = await ledService.findLEDByFuzzyMatch(parsed.type);

      if (matchedType) {
        const typeField = `row${ledsRow}_led_type`;
        specs[typeField] = matchedType;
        filledFields.push(typeField);
        console.log(`[Specs Auto-Fill] ✓ Filled ${typeField} = "${matchedType}" (matched from "${parsed.type}")`);
      } else {
        // No match found, use extracted type as-is
        const typeField = `row${ledsRow}_led_type`;
        specs[typeField] = parsed.type;
        filledFields.push(typeField);
        warnings.push(`LED type "${parsed.type}" extracted but no exact match found in database`);
        console.warn(`[Specs Auto-Fill] ⚠ LED type "${parsed.type}" extracted but no match in DB`);
      }
    } catch (error) {
      console.error('[Specs Auto-Fill] Error matching LED type:', error);
      // Fall back to using extracted type
      const typeField = `row${ledsRow}_led_type`;
      specs[typeField] = parsed.type;
      filledFields.push(typeField);
    }
  } else {
    warnings.push('Could not extract LED type from calculation display');
    console.warn('[Specs Auto-Fill] ⚠ Failed to extract LED type');
  }

  // Auto-fill Wire Length if Wire Length template exists
  if (wireLengthRow) {
    // Default length: 8ft
    const lengthField = `row${wireLengthRow}_length`;
    specs[lengthField] = '8ft';
    filledFields.push(lengthField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${lengthField} = "8ft"`);

    // Wire gauge depends on LED type
    // Most LEDs are 18 AWG, only Strip LEDs are 22 AWG
    let wireGauge = '18 AWG';  // Default for most LEDs

    // Check if this is Strip LEDs
    if (parsed.type && parsed.type.toLowerCase().includes('strip')) {
      wireGauge = '22 AWG';
      console.log('[Specs Auto-Fill] Detected Strip LEDs, using 22 AWG wire gauge');
    }

    const gaugeField = `row${wireLengthRow}_wire_gauge`;
    specs[gaugeField] = wireGauge;
    filledFields.push(gaugeField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${gaugeField} = "${wireGauge}"`);
  }
}
