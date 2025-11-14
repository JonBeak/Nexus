// File Clean up Finished: Nov 13, 2025
/**
 * Power Supplies Product Handler
 *
 * Auto-fills specifications for power supply products:
 * - Parses multiple power supplies from calculation display
 * - Creates dynamic specification rows for each power supply
 * - Matches power supply types with database (with fuzzy matching)
 * - Auto-fills count and type for each power supply
 */

import { AutoFillInput, ParsedData, PowerSupplyData } from '../types';

/**
 * Parse multiple power supply entries from calculation display
 * Pattern: "1 @ $120, Speedbox 60W\n1 @ $180, Speedbox 180W"
 * Returns: [{ count: 1, type: "Speedbox 60W" }, { count: 1, type: "Speedbox 180W" }]
 */
function parsePowerSupplies(calculationDisplay: string): PowerSupplyData[] {
  const powerSupplies: PowerSupplyData[] = [];

  try {
    // Split by newlines to get individual power supply lines
    const lines = calculationDisplay.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Pattern: "1 @ $120, Speedbox 60W"
      const match = line.match(/^(\d+)\s*@\s*\$[\d.]+,\s*(.+)$/);
      if (match) {
        const count = parseInt(match[1], 10);
        const type = match[2].trim();
        powerSupplies.push({ count, type });
      }
    }

    console.log('[Specs Auto-Fill] Parsed power supplies:', powerSupplies);
  } catch (error) {
    console.error('[Specs Auto-Fill] Error parsing power supplies:', error);
  }

  return powerSupplies;
}

/**
 * Auto-fill specs for Power Supplies
 * Handles multiple power supplies by dynamically adding specification rows
 */
export async function autoFillPowerSupplies(
  input: AutoFillInput,
  parsed: ParsedData,
  specs: any,
  warnings: string[],
  filledFields: string[],
  connection?: any
): Promise<void> {
  console.log('[Specs Auto-Fill] Processing Power Supplies');

  // Parse all power supplies from calculation display
  const powerSupplies = parsePowerSupplies(input.calculationDisplay);

  if (powerSupplies.length === 0) {
    console.warn('[Specs Auto-Fill] ⚠ No power supplies found in calculation display');
    return;
  }

  // Remove any existing "Power Supply" template rows (they're pre-added but not used)
  const templatesToKeep: any = {};
  let newRowNum = 1;
  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    // Skip "Power Supply" templates - we'll add our own
    if (templateName === 'Power Supply') {
      console.log(`[Specs Auto-Fill] Removing pre-existing Power Supply template at row ${i}`);
      continue;
    }

    // Keep other templates and renumber them
    if (i !== newRowNum) {
      // Move template to new position
      templatesToKeep[`_template_${newRowNum}`] = templateName;
      // Copy all spec fields for this row
      for (const key in specs) {
        if (key.startsWith(`row${i}_`)) {
          const fieldName = key.replace(`row${i}_`, `row${newRowNum}_`);
          templatesToKeep[fieldName] = specs[key];
        }
      }
    } else {
      // Keep in same position
      templatesToKeep[`_template_${newRowNum}`] = templateName;
      for (const key in specs) {
        if (key.startsWith(`row${i}_`)) {
          templatesToKeep[key] = specs[key];
        }
      }
    }
    newRowNum++;
  }

  // Clear specs and restore only the kept templates
  for (const key in specs) {
    if (key.startsWith('_template_') || key.startsWith('row')) {
      delete specs[key];
    }
  }
  Object.assign(specs, templatesToKeep);

  const existingRows = newRowNum - 1;

  // Add a new "Power Supply" template row for each power supply
  for (let i = 0; i < powerSupplies.length; i++) {
    const ps = powerSupplies[i];
    const rowNum = existingRows + i + 1;

    // Add template
    specs[`_template_${rowNum}`] = 'Power Supply';
    console.log(`[Specs Auto-Fill] Added Power Supply template at row ${rowNum}`);

    // Fill count
    const countField = `row${rowNum}_count`;
    specs[countField] = ps.count.toString();
    filledFields.push(countField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${countField} = "${ps.count}"`);

    // Try to match power supply type with database if connection available
    if (connection) {
      try {
        // Query database for matching power supply
        // The extracted type might be "Speedbox 60W" and we need to match "Speedbox 60W (50W, 12V)"
        // So we add " (" and look for options that start with that pattern
        const searchPattern = `${ps.type} (%`;
        const [psRows] = await connection.execute(
          `SELECT CONCAT(transformer_type, ' (', watts, 'W, ', volts, 'V)') AS full_name
           FROM power_supplies
           WHERE is_active = 1
           AND CONCAT(transformer_type, ' (', watts, 'W, ', volts, 'V)') LIKE ?
           LIMIT 1`,
          [searchPattern]
        );

        if (psRows && psRows.length > 0) {
          const matchedType = psRows[0].full_name;
          const typeField = `row${rowNum}_ps_type`;
          specs[typeField] = matchedType;
          filledFields.push(typeField);
          console.log(`[Specs Auto-Fill] ✓ Filled ${typeField} = "${matchedType}" (matched from "${ps.type}")`);
        } else {
          // No match found, use extracted type as-is
          const typeField = `row${rowNum}_ps_type`;
          specs[typeField] = ps.type;
          filledFields.push(typeField);
          warnings.push(`Power supply type "${ps.type}" extracted but no exact match found in database`);
          console.warn(`[Specs Auto-Fill] ⚠ PS type "${ps.type}" extracted but no match in DB`);
        }
      } catch (error) {
        console.error('[Specs Auto-Fill] Error matching power supply type:', error);
        // Fall back to using extracted type
        const typeField = `row${rowNum}_ps_type`;
        specs[typeField] = ps.type;
        filledFields.push(typeField);
      }
    } else {
      // No connection available, use extracted type
      const typeField = `row${rowNum}_ps_type`;
      specs[typeField] = ps.type;
      filledFields.push(typeField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${typeField} = "${ps.type}"`);
    }
  }

  console.log(`[Specs Auto-Fill] Successfully added ${powerSupplies.length} Power Supply row(s)`);
}
