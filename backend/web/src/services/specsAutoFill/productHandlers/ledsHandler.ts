// File Clean up Finished: Nov 13, 2025
/**
 * LEDs Product Handler
 *
 * Auto-fills specifications for LED products including:
 * - LED count (extracted from calculation display)
 * - LED type (with fuzzy database matching)
 * - Wire length (default 8ft)
 * - Wire gauge (18 AWG for most LEDs, 22 AWG for Strip LEDs)
 */

import { AutoFillInput, ParsedData } from '../types';

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

  // Auto-fill type with fuzzy matching
  if (parsed.type && connection) {
    try {
      // Try to find matching LED type from database
      // The extracted type might be "Interone 9K" and we need to match "Interone 9K - 9000K (0.80W, 12V)"
      // The dropdown format uses product_code - colour (watts, volts)
      // So we add " - " and look for options that start with that pattern
      const searchPattern = `${parsed.type} - %`;
      const [ledRows] = await connection.execute(
        `SELECT CONCAT(product_code, ' - ', colour, ' (', watts, 'W, ', volts, 'V)') AS full_name
         FROM leds
         WHERE is_active = 1
         AND CONCAT(product_code, ' - ', colour, ' (', watts, 'W, ', volts, 'V)') LIKE ?
         LIMIT 1`,
        [searchPattern]
      );

      if (ledRows && ledRows.length > 0) {
        const matchedType = ledRows[0].full_name;
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
  } else if (parsed.type) {
    // No connection available, use extracted type
    const typeField = `row${ledsRow}_led_type`;
    specs[typeField] = parsed.type;
    filledFields.push(typeField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${typeField} = "${parsed.type}"`);
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
