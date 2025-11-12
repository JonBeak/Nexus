/**
 * Specs Auto-Fill Service
 *
 * Intelligently auto-fills SPEC1, SPEC2, SPEC3 values during order conversion
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

// =====================================================
// TYPE DEFINITIONS
// =====================================================

/**
 * Component item from estimate calculation
 * (Subset of frontend ComponentItem type)
 */
interface ComponentItem {
  name: string;
  price: number;
  type: string;
  calculationDisplay?: string;
}

/**
 * Input data for auto-fill process
 */
export interface AutoFillInput {
  qbItemName: string;                    // e.g., "3\" Front Lit"
  specsDisplayName: string;              // e.g., "Front Lit", "Halo Lit", "LEDs"
  calculationDisplay: string;            // Multi-line text from estimate
  calculationComponents?: ComponentItem[]; // Structured component data (preferred source)
  currentSpecifications: any;            // Current specs JSON with templates
  isParentOrRegular: boolean;            // Whether this is a parent/regular row
  customerPreferences?: {                // Customer-specific defaults
    drain_holes_yes_or_no?: boolean;
  };
  connection?: any;                      // Database connection for lookups
  previousItems?: Array<{                // Array of previously processed items (for cross-item logic)
    specsDisplayName: string;
    calculationDisplay: string;
    specifications: any;
  }>;
}

/**
 * Output from auto-fill process
 */
export interface AutoFillOutput {
  specifications: any;                   // Updated specs JSON with filled values
  autoFilledFields: string[];           // List of fields that were auto-filled
  warnings: string[];                   // Any parsing warnings/errors
}

/**
 * Parsed data extracted from various sources
 */
interface ParsedData {
  depth?: string;           // "3\"", "5\"" from QB item name
  count?: number;           // 15, 105 from calculation display
  type?: string;            // "Interone 9K", "Pins + Spacer"
  hasPins?: boolean;        // Detected pins in calculation
  hasSpacers?: boolean;     // Detected spacers in calculation
  hasRivnut?: boolean;      // Detected rivnut in calculation
}

// =====================================================
// PARSING UTILITIES
// =====================================================

/**
 * Extract depth from QB item name
 * Pattern: "3\" Front Lit" → "3\""
 */
function extractDepth(qbItemName: string): string | null {
  try {
    const match = qbItemName.match(/^(\d+["'])/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('[Specs Auto-Fill] Error extracting depth:', error);
    return null;
  }
}

/**
 * Extract count from calculation display
 * Pattern: "105 @ $1.75" → 105
 * Pattern: "Pins + Spacer: 15 @ $2/each" → 15
 */
function extractCount(calculationDisplay: string, componentType?: string): number | null {
  try {
    // Check if calculationDisplay contains pins/spacers keywords
    const lowerCalc = calculationDisplay.toLowerCase();
    const hasPinsKeyword = /\bpins?\b/.test(lowerCalc) || /\bspacers?\b/.test(lowerCalc);

    // For pins/spacers, look for the pattern with colon (e.g., "Pins + Spacer: 15 @ $2/each")
    if (hasPinsKeyword || (componentType && (componentType.toLowerCase().includes('pin') || componentType.toLowerCase().includes('spacer')))) {
      const colonMatch = calculationDisplay.match(/:\s*(\d+)\s*@/);
      if (colonMatch) {
        return parseInt(colonMatch[1], 10);
      }
    }

    // For LEDs and other components, look at the start
    const match = calculationDisplay.match(/^(\d+)\s*@/);
    return match ? parseInt(match[1], 10) : null;
  } catch (error) {
    console.error('[Specs Auto-Fill] Error extracting count:', error);
    return null;
  }
}

/**
 * Extract LED type from calculation display
 * Pattern: "105 @ $1.75, Interone 9K" → "Interone 9K"
 */
function extractLedType(calculationDisplay: string): string | null {
  try {
    const match = calculationDisplay.match(/,\s*(.+)$/);
    return match ? match[1].trim() : null;
  } catch (error) {
    console.error('[Specs Auto-Fill] Error extracting LED type:', error);
    return null;
  }
}

/**
 * Detect if calculation display mentions pins, spacers, and rivnuts
 */
function detectPinsAndSpacers(calculationDisplay: string): {
  hasPins: boolean;
  hasSpacers: boolean;
  hasRivnut: boolean;
} {
  const lowerText = calculationDisplay.toLowerCase();
  return {
    hasPins: /\bpins?\b/.test(lowerText),
    hasSpacers: /\bspacers?\b/.test(lowerText),
    hasRivnut: /\b(rivnut|riv-nut|rivnuts)\b/.test(lowerText)
  };
}

/**
 * Parse all available data from input sources
 */
function parseSourceData(input: AutoFillInput): ParsedData {
  const parsed: ParsedData = {};

  // Extract depth from QB item name
  if (input.qbItemName) {
    parsed.depth = extractDepth(input.qbItemName) || undefined;
  }

  // Extract count and type from calculation display
  if (input.calculationDisplay) {
    parsed.count = extractCount(input.calculationDisplay, input.specsDisplayName) || undefined;

    // For LEDs, extract type
    if (input.specsDisplayName === 'LEDs') {
      parsed.type = extractLedType(input.calculationDisplay) || undefined;
    }

    // Detect pins, spacers, and rivnut
    const detection = detectPinsAndSpacers(input.calculationDisplay);
    parsed.hasPins = detection.hasPins;
    parsed.hasSpacers = detection.hasSpacers;
    parsed.hasRivnut = detection.hasRivnut;
  }

  console.log('[Specs Auto-Fill] Parsed data:', JSON.stringify(parsed, null, 2));
  return parsed;
}

// =====================================================
// BUSINESS RULES
// =====================================================

/**
 * Get default pin length based on specs display name
 */
function getDefaultPinLength(specsDisplayName: string): string {
  // 3D Print gets shorter pins
  if (specsDisplayName === '3D print') {
    return '2"';
  }

  // Most channel letters get 6" pins
  return '6"';
}

/**
 * Get default spacer length based on specs display name
 */
function getDefaultSpacerLength(specsDisplayName: string): string {
  // 3D Print gets shorter spacers
  if (specsDisplayName === '3D print') {
    return '0.5"';
  }

  // Standard spacer length for most products
  return '1.5"';
}

/**
 * Get default face material based on specs display name
 */
function getDefaultFaceMaterial(specsDisplayName: string): string | null {
  switch (specsDisplayName) {
    case 'Front Lit':
    case 'Dual Lit - Single Layer':
    case 'Dual Lit - Double Layer':
      return '2mm PC';

    case 'Halo Lit':
      return '1mm Aluminum';

    default:
      return null;
  }
}

/**
 * Get default face color based on specs display name
 */
function getDefaultFaceColor(specsDisplayName: string): string | null {
  switch (specsDisplayName) {
    case 'Front Lit':
    case 'Dual Lit - Single Layer':
    case 'Dual Lit - Double Layer':
      return 'White';

    case 'Halo Lit':
      return null; // No color for Halo Lit

    default:
      return null;
  }
}

/**
 * Get default drain holes setting based on specs display name and customer preference
 */
function getDefaultDrainHoles(specsDisplayName: string, customerPref?: boolean | number): string | null {
  switch (specsDisplayName) {
    case 'Halo Lit':
      return 'false';

    case 'Front Lit':
    case 'Dual Lit - Single Layer':
    case 'Dual Lit - Double Layer':
      // Database returns 1 or 0, convert to true/false strings
      return customerPref === 1 || customerPref === true ? 'true' : 'false';

    default:
      return null;
  }
}

// =====================================================
// AUTO-FILL RULES BY PRODUCT TYPE
// =====================================================

/**
 * Auto-fill specs for Channel Letters (Front Lit, Halo Lit, Dual Lit)
 */
function autoFillChannelLetters(
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
  let pinsRow: number | null = null;
  let drainHolesRow: number | null = null;

  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    if (templateName === 'Return') returnRow = i;
    if (templateName === 'Face') faceRow = i;
    if (templateName === 'Pins') pinsRow = i;
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

  // Auto-fill Pins count and defaults
  if (pinsRow && parsed.hasPins) {
    // Fill count if detected
    if (parsed.count) {
      const countField = `row${pinsRow}_count`;
      specs[countField] = parsed.count.toString();
      filledFields.push(countField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${countField} = "${parsed.count}"`);
    } else {
      warnings.push('Pins detected in calculation but could not extract count');
      console.warn('[Specs Auto-Fill] ⚠ Pins detected but count extraction failed');
    }

    // Fill default pin length (e.g., "6\" Pins")
    const defaultPinLength = getDefaultPinLength(input.specsDisplayName);
    const pinOption = `${defaultPinLength} Pins`;
    const pinsField = `row${pinsRow}_pins`;
    specs[pinsField] = pinOption;
    filledFields.push(pinsField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${pinsField} = "${pinOption}"`);

    // Fill default spacer option if spacers detected
    if (parsed.hasSpacers) {
      const defaultSpacerLength = getDefaultSpacerLength(input.specsDisplayName);

      // Build spacer option based on whether Rivnut is detected
      let spacerOption: string;
      if (parsed.hasRivnut) {
        // Use the spacer + Rivnut option
        spacerOption = `${defaultSpacerLength} Spacer + Rivnut`;
        console.log(`[Specs Auto-Fill] Rivnut detected, using "${spacerOption}"`);
      } else {
        // Use plain spacer option
        spacerOption = `${defaultSpacerLength} Spacer`;
        console.log(`[Specs Auto-Fill] No Rivnut detected, using "${spacerOption}"`);
      }

      const spacersField = `row${pinsRow}_spacers`;
      specs[spacersField] = spacerOption;
      filledFields.push(spacersField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${spacersField} = "${spacerOption}"`);
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

/**
 * Auto-fill specs for LEDs
 */
async function autoFillLeds(
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

/**
 * Parse multiple power supply entries from calculation display
 * Pattern: "1 @ $120, Speedbox 60W\n1 @ $180, Speedbox 180W"
 * Returns: [{ count: 1, type: "Speedbox 60W" }, { count: 1, type: "Speedbox 180W" }]
 */
function parsePowerSupplies(calculationDisplay: string): Array<{ count: number; type: string }> {
  const powerSupplies: Array<{ count: number; type: string }> = [];

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
async function autoFillPowerSupplies(
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

/**
 * Auto-fill specs for Push Thru products
 */
function autoFillPushThru(
  input: AutoFillInput,
  parsed: ParsedData,
  specs: any,
  warnings: string[],
  filledFields: string[]
): void {
  console.log('[Specs Auto-Fill] Processing Push Thru');

  // Find template positions
  let boxMaterialRow: number | null = null;
  let pushThruAcrylicRow: number | null = null;

  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    if (templateName === 'Box Material') boxMaterialRow = i;
    if (templateName === 'Push Thru Acrylic') pushThruAcrylicRow = i;
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

  // Auto-fill Push Thru Acrylic defaults
  if (pushThruAcrylicRow) {
    const thicknessField = `row${pushThruAcrylicRow}_thickness`;
    const colourField = `row${pushThruAcrylicRow}_colour`;

    specs[thicknessField] = '12mm';
    specs[colourField] = '2447 White';

    filledFields.push(thicknessField, colourField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${thicknessField} = "12mm"`);
    console.log(`[Specs Auto-Fill] ✓ Filled ${colourField} = "2447 White"`);
  }
}

/**
 * Auto-fill specs for UL
 */
async function autoFillUL(
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

/**
 * Extract wire length from calculationDisplay
 * Pattern: "5 pcs × 10ft = 50ft @ $0.50/ft" → 50
 * Pattern: "50ft @ $0.50/ft" → 50
 */
function extractWireLength(calculationDisplay: string): number | null {
  try {
    // Try format with brackets first (for "pcs" format): [24 pcs] x [12ft] x [$0.70/ft]
    const bracketMatch = calculationDisplay.match(/\[(\d+(?:\.\d+)?)\s*ft\]/);
    if (bracketMatch) {
      console.log(`[Specs Auto-Fill] Extracted wire length from bracket format: ${bracketMatch[1]}ft`);
      return parseFloat(bracketMatch[1]);
    }

    // Fall back to original format with "@": 50ft @ $0.70/ft
    const atMatch = calculationDisplay.match(/(\d+(?:\.\d+)?)\s*ft\s*@/);
    if (atMatch) {
      console.log(`[Specs Auto-Fill] Extracted wire length from @ format: ${atMatch[1]}ft`);
      return parseFloat(atMatch[1]);
    }

    return null;
  } catch (error) {
    console.error('[Specs Auto-Fill] Error extracting wire length:', error);
    return null;
  }
}

/**
 * Auto-fill specs for Extra Wire
 *
 * Logic:
 * 1. Check if calculationDisplay contains "pcs"
 * 2. IF "pcs" exists:
 *    - Look back through previousItems for the most recent LED
 *    - Check that no Extra Wire or Special Items exist between LED and this Extra Wire
 *    - If LED has Wire Length spec:
 *      - Extract LED's wire length and gauge
 *      - Remove LED's Wire Length spec
 *      - Parse Extra Wire's calculationDisplay for total length
 *      - Fill Extra Wire's Wire Length with: LED length + Extra Wire length
 *      - Fill wire gauge from LED
 * 3. IF "pcs" does NOT exist:
 *    - Parse calculationDisplay for total length
 *    - Fill Extra Wire's Wire Length with just that length
 *    - Leave wire gauge empty
 */
function autoFillExtraWire(
  input: AutoFillInput,
  specs: any,
  warnings: string[],
  filledFields: string[]
): void {
  console.log('[Specs Auto-Fill] Processing Extra Wire');

  // Find Wire Length template row
  let wireLengthRow: number | null = null;
  for (let i = 1; i <= 10; i++) {
    if (specs[`_template_${i}`] === 'Wire Length') {
      wireLengthRow = i;
      break;
    }
  }

  if (!wireLengthRow) {
    console.warn('[Specs Auto-Fill] ⚠ No Wire Length template found for Extra Wire');
    return;
  }

  // Extract wire length from calculationDisplay
  const extraWireLength = extractWireLength(input.calculationDisplay);

  if (!extraWireLength) {
    warnings.push('Could not extract wire length from Extra Wire calculation display');
    console.warn('[Specs Auto-Fill] ⚠ Failed to extract wire length from:', input.calculationDisplay);
    return;
  }

  // Check if calculationDisplay contains "pcs"
  const hasPcs = /\bpcs\b/i.test(input.calculationDisplay);
  console.log(`[Specs Auto-Fill] Extra Wire has "pcs": ${hasPcs}`);

  if (hasPcs && input.previousItems && input.previousItems.length > 0) {
    // Look back through previous items for the most recent LED
    // Reverse iterate to find the closest LED
    let ledFound = false;

    for (let i = input.previousItems.length - 1; i >= 0; i--) {
      const prevItem = input.previousItems[i];

      // Stop if we encounter another Extra Wire or a Special Item
      if (prevItem.specsDisplayName === 'Extra Wire' ||
          prevItem.specsDisplayName?.toLowerCase().includes('special')) {
        console.log(`[Specs Auto-Fill] Found intervening ${prevItem.specsDisplayName}, stopping LED search`);
        break;
      }

      // Check if this is an LED item
      if (prevItem.specsDisplayName === 'LEDs') {
        console.log('[Specs Auto-Fill] Found LED item in previous items');

        // Check if LED has Wire Length spec
        let ledWireLengthRow: number | null = null;
        for (let j = 1; j <= 10; j++) {
          if (prevItem.specifications[`_template_${j}`] === 'Wire Length') {
            ledWireLengthRow = j;
            break;
          }
        }

        if (ledWireLengthRow) {
          // Extract LED's wire length and gauge
          const ledLength = prevItem.specifications[`row${ledWireLengthRow}_length`];
          const ledGauge = prevItem.specifications[`row${ledWireLengthRow}_wire_gauge`];

          console.log(`[Specs Auto-Fill] LED has Wire Length: ${ledLength}, Gauge: ${ledGauge}`);

          // Parse LED length (e.g., "8ft" → 8)
          const ledLengthMatch = ledLength?.match(/(\d+(?:\.\d+)?)/);
          const ledLengthNum = ledLengthMatch ? parseFloat(ledLengthMatch[1]) : 0;

          // Calculate total wire length
          const totalLength = ledLengthNum + extraWireLength;

          // Fill Extra Wire's Wire Length
          const lengthField = `row${wireLengthRow}_length`;
          specs[lengthField] = `${totalLength}ft`;
          filledFields.push(lengthField);
          console.log(`[Specs Auto-Fill] ✓ Filled ${lengthField} = "${totalLength}ft" (${ledLengthNum}ft from LED + ${extraWireLength}ft extra)`);

          // Fill wire gauge from LED
          if (ledGauge) {
            const gaugeField = `row${wireLengthRow}_wire_gauge`;
            specs[gaugeField] = ledGauge;
            filledFields.push(gaugeField);
            console.log(`[Specs Auto-Fill] ✓ Filled ${gaugeField} = "${ledGauge}" (from LED)`);
          }

          // Remove LED's Wire Length spec by clearing all template rows and rebuilding without Wire Length
          console.log('[Specs Auto-Fill] Removing Wire Length spec from LED');
          const ledTemplates: string[] = [];
          for (let j = 1; j <= 10; j++) {
            const templateName = prevItem.specifications[`_template_${j}`];
            if (!templateName) break;
            if (templateName !== 'Wire Length') {
              ledTemplates.push(templateName);
            }
          }

          // Rebuild LED specs without Wire Length
          const newLedSpecs: any = {
            _qb_description: prevItem.specifications._qb_description,
            specs_qty: prevItem.specifications.specs_qty
          };

          // Re-add templates (excluding Wire Length)
          ledTemplates.forEach((templateName, index) => {
            const oldRowNum = index + 1;
            const newRowNum = index + 1;
            newLedSpecs[`_template_${newRowNum}`] = templateName;

            // Copy spec field values (but need to find original row number)
            let originalRowNum = 0;
            for (let k = 1; k <= 10; k++) {
              if (prevItem.specifications[`_template_${k}`] === templateName) {
                // Check if this is the Nth occurrence of this template
                let occurrenceCount = 0;
                for (let m = 1; m <= k; m++) {
                  if (prevItem.specifications[`_template_${m}`] === templateName) {
                    occurrenceCount++;
                  }
                }
                if (occurrenceCount === oldRowNum) {
                  originalRowNum = k;
                  break;
                }
              }
            }

            if (originalRowNum === 0) {
              // Simple case: just use sequential matching
              let templateCount = 0;
              for (let k = 1; k <= 10; k++) {
                if (prevItem.specifications[`_template_${k}`] === templateName) {
                  templateCount++;
                  if (templateCount === oldRowNum) {
                    originalRowNum = k;
                    break;
                  }
                }
              }
            }

            if (originalRowNum > 0) {
              // Copy all row fields
              for (const key in prevItem.specifications) {
                if (key.startsWith(`row${originalRowNum}_`)) {
                  const fieldName = key.replace(`row${originalRowNum}_`, `row${newRowNum}_`);
                  newLedSpecs[fieldName] = prevItem.specifications[key];
                }
              }
            }
          });

          // Update the previous item's specifications
          prevItem.specifications = newLedSpecs;
          console.log('[Specs Auto-Fill] ✓ Removed Wire Length from LED specifications');

          ledFound = true;
          break;
        } else {
          console.log('[Specs Auto-Fill] LED found but has no Wire Length spec, skipping consolidation');
          break;
        }
      }
    }

    if (!ledFound && hasPcs) {
      // No LED found, but has "pcs" - just fill length without gauge
      const lengthField = `row${wireLengthRow}_length`;
      specs[lengthField] = `${extraWireLength}ft`;
      filledFields.push(lengthField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${lengthField} = "${extraWireLength}ft" (no LED found)`);
    }
  } else {
    // No "pcs" in calculationDisplay - just fill length without gauge
    const lengthField = `row${wireLengthRow}_length`;
    specs[lengthField] = `${extraWireLength}ft`;
    filledFields.push(lengthField);
    console.log(`[Specs Auto-Fill] ✓ Filled ${lengthField} = "${extraWireLength}ft" (no pcs in calculation)`);
  }
}

/**
 * Parse vinyl/digital print components from calculation display
 * Strategy:
 * 1. Split by newlines
 * 2. For each line:
 *    - If contains "sqft" → Digital Print
 *    - If contains "application" (and no sqft) → Skip (application fee)
 *    - Otherwise → Vinyl list, split by " + "
 * Returns array of { isDigitalPrint, size, rawText }
 */
function parseVinylComponents(calculationDisplay: string): Array<{
  isDigitalPrint: boolean;
  size: string | null;
  rawText: string;
}> {
  const components: Array<{ isDigitalPrint: boolean; size: string | null; rawText: string }> = [];

  try {
    // Split by newlines to process each line independently
    const lines = calculationDisplay.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      // Check if this line contains sqft (Digital Print)
      if (lowerLine.includes('sqft')) {
        // Digital Print: Extract dimensions or sqft
        // Look for patterns like "3.8x3.8ft", "1x0.3ft"
        const dimensionMatch = line.match(/(\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?)\s*ft/i);
        // Look for sqft in brackets like "[14.1 sqft @ $8 + Application $60]" or "[3 sqft @ $8 + Application $60]"
        const sqftMatch = line.match(/\[?\s*(\d+(?:\.\d+)?)\s*sqft/i);

        let size: string | null = null;
        if (dimensionMatch) {
          size = dimensionMatch[1].replace(/\s+/g, '') + 'ft'; // e.g., "3.8x3.8ft"
          console.log(`[Specs Auto-Fill] Found digital print dimension: "${size}"`);
        } else if (sqftMatch) {
          size = `${sqftMatch[1]} sqft`;
          console.log(`[Specs Auto-Fill] Found digital print sqft: "${size}"`);
        }

        if (size) {
          components.push({
            isDigitalPrint: true,
            size,
            rawText: line
          });
          console.log(`[Specs Auto-Fill] Parsed Digital Print: size="${size}", raw="${line}"`);
        } else {
          console.warn(`[Specs Auto-Fill] ⚠ Could not extract size from digital print line: "${line}"`);
        }
      }
      // Check if this line is just an application fee (skip it)
      else if (lowerLine.includes('application') && line.includes('$')) {
        console.log(`[Specs Auto-Fill] Skipping application fee line: "${line}"`);
        continue;
      }
      // Otherwise, treat as vinyl list (split by " + ")
      else {
        const vinylParts = line.split(' + ').map(p => p.trim()).filter(p => p.length > 0);

        for (const part of vinylParts) {
          // Extract yards from vinyl part
          // Look for patterns like "2", "12", "2 perf", "1c perf"
          let size: string | null = null;

          // Try to match explicit yard notation first
          const yardMatch = part.match(/(\d+(?:\.\d+)?)\s*(?:yd|yard)s?/i);
          if (yardMatch) {
            size = `${yardMatch[1]}yd`;
            console.log(`[Specs Auto-Fill] Found explicit yards: "${size}"`);
          } else {
            // Try to extract a leading number (for patterns like "2 perf" or "12")
            const numberMatch = part.match(/^(\d+(?:\.\d+)?)/);
            if (numberMatch) {
              const numValue = numberMatch[1];
              size = `${numValue}yd`;
              console.log(`[Specs Auto-Fill] Inferred yards from number: "${size}" (from "${part}")`);
            }
          }

          if (size) {
            components.push({
              isDigitalPrint: false,
              size,
              rawText: part
            });
            console.log(`[Specs Auto-Fill] Parsed Vinyl: size="${size}", raw="${part}"`);
          } else {
            console.warn(`[Specs Auto-Fill] ⚠ Could not extract size from vinyl part: "${part}"`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Specs Auto-Fill] Error parsing vinyl components:', error);
  }

  return components;
}

/**
 * Auto-fill specs for Vinyl and Digital Print
 * Creates multiple specification rows for each component found in calculationDisplay
 */
function autoFillVinylAndDigitalPrint(
  input: AutoFillInput,
  specs: any,
  warnings: string[],
  filledFields: string[]
): void {
  console.log('[Specs Auto-Fill] Processing Vinyl/Digital Print');

  if (!input.calculationDisplay) {
    console.warn('[Specs Auto-Fill] ⚠ No calculation display available');
    return;
  }

  // Parse all vinyl/digital print components
  const components = parseVinylComponents(input.calculationDisplay);

  if (components.length === 0) {
    console.warn('[Specs Auto-Fill] ⚠ No vinyl/digital print components found');
    return;
  }

  // Remove any existing Vinyl/Digital Print template rows
  const templatesToKeep: any = {};
  let newRowNum = 1;
  for (let i = 1; i <= 10; i++) {
    const templateName = specs[`_template_${i}`];
    if (!templateName) break;

    // Skip Vinyl/Digital Print templates - we'll add our own
    if (templateName === 'Vinyl' || templateName === 'Digital Print') {
      console.log(`[Specs Auto-Fill] Removing pre-existing ${templateName} template at row ${i}`);
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

  // Add a new template row for each component
  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    const rowNum = existingRows + i + 1;
    const templateName = component.isDigitalPrint ? 'Digital Print' : 'Vinyl';

    // Add template
    specs[`_template_${rowNum}`] = templateName;
    console.log(`[Specs Auto-Fill] Added ${templateName} template at row ${rowNum}`);

    // Auto-fill size (spec3) only if we have one
    if (component.size) {
      const sizeField = `row${rowNum}_size`;
      specs[sizeField] = component.size;
      filledFields.push(sizeField);
      console.log(`[Specs Auto-Fill] ✓ Filled ${sizeField} = "${component.size}"`);
    } else {
      warnings.push(`Could not extract size from: "${component.rawText}"`);
      console.warn(`[Specs Auto-Fill] ⚠ No size found for component: "${component.rawText}"`);
    }
  }

  console.log(`[Specs Auto-Fill] Successfully added ${components.length} ${input.specsDisplayName} row(s)`);
}

// =====================================================
// MAIN AUTO-FILL FUNCTION
// =====================================================

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
    case 'Front Lit':
    case 'Halo Lit':
    case 'Front Lit Acrylic Face':
    case 'Dual Lit - Single Layer':
    case 'Dual Lit - Double Layer':
      autoFillChannelLetters(input, parsed, specs, warnings, filledFields);
      break;

    case 'LEDs':
      await autoFillLeds(input, parsed, specs, warnings, filledFields, input.connection);
      break;

    case 'Power Supplies':
      await autoFillPowerSupplies(input, parsed, specs, warnings, filledFields, input.connection);
      break;

    case '3D print':
      // 3D print uses same logic as channel letters but with different defaults
      autoFillChannelLetters(input, parsed, specs, warnings, filledFields);
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
