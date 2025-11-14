// File Clean up Finished: Nov 13, 2025
/**
 * Vinyl and Digital Print Product Handler
 *
 * Auto-fills specifications for Vinyl and Digital Print products:
 * - Parses vinyl/digital print components from calculation display
 * - Creates dynamic specification rows for each component
 * - Detects Digital Print (contains "sqft")
 * - Detects Vinyl (split by " + ")
 * - Auto-fills size for each component (yards for vinyl, sqft for digital print)
 */

import { AutoFillInput } from '../types';

/**
 * Vinyl component parsed data
 */
interface VinylComponentData {
  isDigitalPrint: boolean;
  size: string | null;
  rawText: string;
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
function parseVinylComponents(calculationDisplay: string): VinylComponentData[] {
  const components: VinylComponentData[] = [];

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
export function autoFillVinylAndDigitalPrint(
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
