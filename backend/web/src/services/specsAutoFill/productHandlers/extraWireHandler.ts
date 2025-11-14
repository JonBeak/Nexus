// File Clean up Finished: Nov 13, 2025
/**
 * Extra Wire Product Handler
 *
 * Auto-fills specifications for Extra Wire products with complex logic:
 * 1. If calculationDisplay contains "pcs":
 *    - Look back through previousItems for the most recent LED
 *    - Check that no Extra Wire or Special Items exist between LED and this Extra Wire
 *    - If LED has Wire Length spec:
 *      - Extract LED's wire length and gauge
 *      - Remove LED's Wire Length spec
 *      - Parse Extra Wire's calculationDisplay for total length
 *      - Fill Extra Wire's Wire Length with: LED length + Extra Wire length
 *      - Fill wire gauge from LED
 * 2. If "pcs" does NOT exist:
 *    - Parse calculationDisplay for total length
 *    - Fill Extra Wire's Wire Length with just that length
 *    - Leave wire gauge empty
 */

import { AutoFillInput } from '../types';

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
export function autoFillExtraWire(
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
  console.log(`\n🔍 [Extra Wire Debug] ====== STARTING EXTRA WIRE PROCESSING ======`);
  console.log(`🔍 [Extra Wire Debug] calculationDisplay: "${input.calculationDisplay}"`);
  console.log(`🔍 [Extra Wire Debug] Has "pcs": ${hasPcs}`);
  console.log(`🔍 [Extra Wire Debug] Number of previousItems: ${input.previousItems?.length || 0}`);

  if (hasPcs && input.previousItems && input.previousItems.length > 0) {
    // Look back through previous items for the most recent LED
    // Reverse iterate to find the closest LED
    let ledFound = false;

    console.log(`🔍 [Extra Wire Debug] Looking back through ${input.previousItems.length} previous items...`);

    for (let i = input.previousItems.length - 1; i >= 0; i--) {
      const prevItem = input.previousItems[i];
      console.log(`🔍 [Extra Wire Debug] Checking item ${i}: specsDisplayName="${prevItem.specsDisplayName}"`);

      // Stop if we encounter another Extra Wire or a Special Item
      if (prevItem.specsDisplayName === 'Extra Wire' ||
          prevItem.specsDisplayName?.toLowerCase().includes('special')) {
        console.log(`🔍 [Extra Wire Debug] ❌ Found intervening ${prevItem.specsDisplayName}, stopping LED search`);
        break;
      }

      // Check if this is an LED item
      if (prevItem.specsDisplayName === 'LEDs') {
        console.log(`🔍 [Extra Wire Debug] ✅ Found LED item in previous items!`);

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

          console.log(`🔍 [Extra Wire Debug] ✅ LED has Wire Length at row ${ledWireLengthRow}`);
          console.log(`🔍 [Extra Wire Debug]    - LED Length: ${ledLength}`);
          console.log(`🔍 [Extra Wire Debug]    - LED Gauge: ${ledGauge}`);

          // Parse LED length (e.g., "8ft" → 8)
          const ledLengthMatch = ledLength?.match(/(\d+(?:\.\d+)?)/);
          const ledLengthNum = ledLengthMatch ? parseFloat(ledLengthMatch[1]) : 0;

          // Calculate total wire length
          const totalLength = ledLengthNum + extraWireLength;

          console.log(`🔍 [Extra Wire Debug] Calculated total length: ${ledLengthNum}ft + ${extraWireLength}ft = ${totalLength}ft`);

          // Fill Extra Wire's Wire Length
          const lengthField = `row${wireLengthRow}_length`;
          specs[lengthField] = `${totalLength}ft`;
          filledFields.push(lengthField);
          console.log(`🔍 [Extra Wire Debug] ✓ Filled ${lengthField} = "${totalLength}ft"`);

          // Fill wire gauge from LED
          if (ledGauge) {
            const gaugeField = `row${wireLengthRow}_wire_gauge`;
            specs[gaugeField] = ledGauge;
            filledFields.push(gaugeField);
            console.log(`🔍 [Extra Wire Debug] ✓ Filled ${gaugeField} = "${ledGauge}"`);
          }

          // Remove LED's Wire Length spec by clearing all template rows and rebuilding without Wire Length
          console.log(`🔍 [Extra Wire Debug] 🗑️  Removing Wire Length spec from LED...`);
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
          console.log(`🔍 [Extra Wire Debug] ✓ Removed Wire Length from LED specifications`);
          console.log(`🔍 [Extra Wire Debug] LED templates after removal:`, ledTemplates);

          ledFound = true;
          break;
        } else {
          console.log(`🔍 [Extra Wire Debug] ❌ LED found but has NO Wire Length spec, skipping consolidation`);
          break;
        }
      }
    }

    if (!ledFound && hasPcs) {
      // No LED found, but has "pcs" - just fill length without gauge
      const lengthField = `row${wireLengthRow}_length`;
      specs[lengthField] = `${extraWireLength}ft`;
      filledFields.push(lengthField);
      console.log(`🔍 [Extra Wire Debug] ⚠️  No LED found - Filled ${lengthField} = "${extraWireLength}ft" (no LED to consolidate with)`);
    }
  } else {
    // No "pcs" in calculationDisplay - just fill length without gauge
    console.log(`🔍 [Extra Wire Debug] No "pcs" found or no previousItems - just filling length`);
    const lengthField = `row${wireLengthRow}_length`;
    specs[lengthField] = `${extraWireLength}ft`;
    filledFields.push(lengthField);
    console.log(`🔍 [Extra Wire Debug] ✓ Filled ${lengthField} = "${extraWireLength}ft" (standalone wire)`);
  }

  console.log(`🔍 [Extra Wire Debug] ====== FINISHED EXTRA WIRE PROCESSING ======\n`);
}
