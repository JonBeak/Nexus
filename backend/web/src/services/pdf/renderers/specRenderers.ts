// File Clean up Finished: 2025-11-15

/**
 * Spec Renderers Module
 * Handles spec processing and rendering logic for PDF generation
 *
 * Extracted from orderFormGenerator.ts as part of Phase 2 refactoring
 */

import { COLORS, FONT_SIZES, SPACING, FormType } from '../generators/pdfConstants';
import { debugLog, formatBooleanValue, cleanSpecValue, getStandardLabelWidth } from '../generators/pdfHelpers';
import {
  SPEC_ORDER,
  CRITICAL_SPECS,
  SPECS_EXEMPT_FROM_CRITICAL,
  formatSpecValues
} from '../formatters/specFormatters';

// ============================================
// DEFAULT VALUE SKIP RULES
// ============================================

/**
 * Default back materials by product type
 * When Back spec matches the default, it should be skipped (redundant info)
 */
const DEFAULT_BACK_MATERIALS: Record<string, string> = {
  // 2mm ACM back
  'Front Lit': '2mm ACM',
  'Front Lit Acrylic Face': '2mm ACM',
  'Blade Sign': '2mm ACM',
  'Marquee Bulb': '2mm ACM',
  'Return': '2mm ACM',
  // Note: Material Cut intentionally excluded - always show Back spec

  // 2mm White PC back
  'Halo Lit': '2mm White PC',
  'Dual Lit - Single Layer': '2mm White PC',
  'Dual Lit - Double Layer': '2mm White PC',
  '3D print': '2mm White PC',
};

/**
 * Check if the Back spec should be skipped because it matches the default value
 *
 * @param specsDisplayName - The product type (e.g., "Front Lit", "Halo Lit")
 * @param backSpecs - The Back spec values (contains 'material' field)
 * @returns true if the spec should be skipped, false otherwise
 */
function shouldSkipBackSpec(specsDisplayName: string | null, backSpecs: Record<string, any>): boolean {
  if (!specsDisplayName || !backSpecs) return false;

  const defaultBack = DEFAULT_BACK_MATERIALS[specsDisplayName];
  if (!defaultBack) return false;

  // Get the material value from the Back spec
  const backMaterial = backSpecs.material || '';

  // Skip if the Back material matches the default for this product type
  return backMaterial === defaultBack;
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TemplateRow {
  template: string;
  rowNum: string;
  specs: Record<string, any>;
}

// ============================================
// SPEC PROCESSING FUNCTIONS
// ============================================

/**
 * Pair information for keeping Box Type/Material + Cutting together
 */
interface SpecPair {
  firstIndex: number;
  secondIndex: number;
  firstTemplate: string;
  secondTemplate: string;
}

/**
 * Normalize Box Material to Box Type for consistent pairing and sorting
 */
function normalizeTemplateName(templateName: string): string {
  return templateName === 'Box Material' ? 'Box Type' : templateName;
}

/**
 * Detect adjacent pairs in the raw input (consecutive rowNum where second element is Cutting)
 */
function detectAdjacentPairs(
  templateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }>
): SpecPair[] {
  const pairs: SpecPair[] = [];

  for (let i = 0; i < templateRows.length - 1; i++) {
    const current = templateRows[i];
    const next = templateRows[i + 1];

    // Check if row numbers are strictly consecutive (N and N+1)
    const currentRowNum = parseInt(current.rowNum);
    const nextRowNum = parseInt(next.rowNum);

    if (nextRowNum === currentRowNum + 1) {
      // Normalize template names for comparison
      const normalizedCurrent = normalizeTemplateName(current.template);
      const normalizedNext = normalizeTemplateName(next.template);

      // Check if this is a valid pair: (Box Type OR Material) + Cutting
      if (
        (normalizedCurrent === 'Box Type' || normalizedCurrent === 'Material') &&
        normalizedNext === 'Cutting'
      ) {
        pairs.push({
          firstIndex: i,
          secondIndex: i + 1,
          firstTemplate: normalizedCurrent,
          secondTemplate: normalizedNext
        });

        debugLog(`[PAIR DETECTION] Found pair: ${normalizedCurrent} (row${current.rowNum}) + Cutting (row${next.rowNum})`);
      }
    }
  }

  return pairs;
}

/**
 * Build sorted template rows from parts (extracted for reuse in 2-column layout)
 *
 * PAIRING BEHAVIOR:
 * - Detects Box Type/Material + Cutting pairs based on consecutive rowNum (N and N+1)
 * - Keeps pairs together during sorting
 * - Sorts pairs by first element's position (Box Type or Material, NOT Cutting)
 * - Unpaired specs sort independently at their normal positions
 */
export function buildSortedTemplateRows(
  parts: any[],
  formType: FormType
): Array<{ template: string; rowNum: string; specs: Record<string, any> }> {
  // Determine if LEDs/PS/UL should be mandatory for this part
  const specsDisplayName = parts.length > 0 ? parts[0].specs_display_name : null;
  const isExemptFromCritical = specsDisplayName && SPECS_EXEMPT_FROM_CRITICAL.includes(specsDisplayName as any);

  // Extract template rows with their spec values from ALL parts
  const allTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }> = [];

  // Process each part (parent and sub-items)
  parts.forEach((part) => {
    if (!part.specifications) return;

    try {
      const specs = typeof part.specifications === 'string'
        ? JSON.parse(part.specifications)
        : part.specifications;

      if (!specs || Object.keys(specs).length === 0) return;

      // Find all template keys and collect their spec fields
      Object.keys(specs).forEach(key => {
        if (key.startsWith('_template_')) {
          const rowNum = key.replace('_template_', '');
          const templateName = specs[key];

          if (!templateName) return;

          // Collect all spec fields for this row (with named keys)
          const rowSpecs: Record<string, any> = {};

          Object.keys(specs).forEach(fieldKey => {
            if (fieldKey.startsWith(`row${rowNum}_`) && !fieldKey.startsWith('_')) {
              const fieldName = fieldKey.replace(`row${rowNum}_`, '');
              const value = specs[fieldKey];

              // Skip only empty/null/undefined values (but include boolean false)
              if (value !== null && value !== undefined && value !== '') {
                // First, format boolean values to Yes/No
                let formattedValue = formatBooleanValue(value);

                // Then clean up spec values (remove parenthetical details)
                const cleanedValue = cleanSpecValue(String(formattedValue).trim());

                if (cleanedValue) {
                  rowSpecs[fieldName] = cleanedValue;
                }
              }
            }
          });

          // Add as separate row (don't merge)
          allTemplateRows.push({
            template: templateName,
            rowNum: rowNum,
            specs: rowSpecs
          });
        }
      });
    } catch (e) {
      console.error(`Error processing part specifications:`, e);
    }
  });

  // Normalize Box Material → Box Type in all template rows
  allTemplateRows.forEach(row => {
    row.template = normalizeTemplateName(row.template);
  });

  // Detect adjacent pairs based on consecutive rowNum
  const pairs = detectAdjacentPairs(allTemplateRows);

  // Track which rows are part of pairs and which have been processed
  const pairedIndices = new Set<number>();
  pairs.forEach(pair => {
    pairedIndices.add(pair.firstIndex);
    pairedIndices.add(pair.secondIndex);
  });

  const processedIndices = new Set<number>();
  const sortedTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }> = [];

  // Sort with pair awareness: process rows in SPEC_ORDER, keeping pairs together
  for (const templateName of SPEC_ORDER) {
    // Normalize the template name from SPEC_ORDER for comparison
    const normalizedTemplateName = normalizeTemplateName(templateName);

    for (let i = 0; i < allTemplateRows.length; i++) {
      if (processedIndices.has(i)) continue;

      const row = allTemplateRows[i];

      if (row.template === normalizedTemplateName) {
        // Check if this row is the FIRST element of a pair
        const pair = pairs.find(p => p.firstIndex === i);

        if (pair) {
          // Add both rows together (pair stays intact)
          sortedTemplateRows.push(allTemplateRows[pair.firstIndex]);
          sortedTemplateRows.push(allTemplateRows[pair.secondIndex]);
          processedIndices.add(pair.firstIndex);
          processedIndices.add(pair.secondIndex);

          debugLog(`[PAIR SORTING] Added pair: ${pair.firstTemplate} + ${pair.secondTemplate} at position for ${normalizedTemplateName}`);
        } else if (!pairedIndices.has(i)) {
          // Single row (not part of any pair) - add it alone
          sortedTemplateRows.push(row);
          processedIndices.add(i);

          debugLog(`[SORTING] Added unpaired spec: ${row.template} (row${row.rowNum})`);
        }
        // If it's the second element of a pair (Cutting), skip it here - it was already added with its pair
      }
    }

    // Add critical specs even if not in data (unless this part is exempt)
    const isCritical = CRITICAL_SPECS.includes(normalizedTemplateName as any);
    const hasMatchingRows = sortedTemplateRows.some(row => row.template === normalizedTemplateName);

    if (!hasMatchingRows && isCritical && !isExemptFromCritical) {
      sortedTemplateRows.push({
        template: normalizedTemplateName,
        rowNum: '0',
        specs: {}
      });
    }
  }

  // Add any templates not in SPEC_ORDER at the end (unpaired only)
  for (let i = 0; i < allTemplateRows.length; i++) {
    if (processedIndices.has(i)) continue;

    const row = allTemplateRows[i];
    const normalizedTemplate = normalizeTemplateName(row.template);

    if (!SPEC_ORDER.includes(normalizedTemplate as any)) {
      sortedTemplateRows.push(row);
      processedIndices.add(i);

      debugLog(`[SORTING] Added non-standard spec: ${row.template} (row${row.rowNum})`);
    }
  }

  debugLog(`[SORTING COMPLETE] Total specs: ${sortedTemplateRows.length}, Pairs detected: ${pairs.length}`);

  return sortedTemplateRows;
}

/**
 * Calculate optimal split index for 2-column layout
 * Strategy 1: Split at LEDs component if within ±4 rows from midpoint
 * Strategy 2: If no LEDs or Strategy 1 fails, split at exact half with adjustments: down 1-3, then up 1
 */
export function calculateOptimalSplitIndex(
  sortedTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }>
): number {
  const totalSpecs = sortedTemplateRows.length;
  const midpoint = Math.floor(totalSpecs / 2);

  // Strategy 1: Look for LEDs component
  const ledsIndex = sortedTemplateRows.findIndex(row => row.template === 'LEDs');
  if (ledsIndex !== -1) {
    // Check if LEDs is within acceptable distance from midpoint
    const distanceFromMidpoint = ledsIndex - midpoint;
    const isWithinRange = distanceFromMidpoint >= -1 && distanceFromMidpoint <= 4;

    if (isWithinRange) {
      debugLog(`[SPLIT STRATEGY] Found LEDs at index ${ledsIndex} (${distanceFromMidpoint > 0 ? '+' : ''}${distanceFromMidpoint} from midpoint)`);

      // Check if this split point is valid (no same spec type on both sides)
      if (!shouldAdjustSplit(sortedTemplateRows, ledsIndex)) {
        debugLog(`[SPLIT STRATEGY] Using LEDs index ${ledsIndex} directly`);
        return ledsIndex;
      }

      debugLog(`[SPLIT STRATEGY] LEDs index ${ledsIndex} causes same-spec split, trying adjustments`);

      // Try adjustments: down 1, 2, 3, then up 1
      const adjustments = [1, 2, 3, -1]; // positive = down, negative = up
      for (const adjustment of adjustments) {
        const candidateIndex = ledsIndex + adjustment;

        // Ensure within bounds
        if (candidateIndex > 0 && candidateIndex < totalSpecs) {
          if (!shouldAdjustSplit(sortedTemplateRows, candidateIndex)) {
            debugLog(`[SPLIT STRATEGY] Adjusted from LEDs to index ${candidateIndex} (offset +${adjustment})`);
            return candidateIndex;
          }
        }
      }

      debugLog(`[SPLIT STRATEGY] No valid adjustment for LEDs found, falling back to Strategy 2`);
    } else {
      debugLog(`[SPLIT STRATEGY] LEDs at index ${ledsIndex} is too far from midpoint (${distanceFromMidpoint}), falling back to Strategy 2`);
    }
  }

  // Strategy 2: No LEDs or Strategy 1 failed - split at half, then adjust if needed
  let splitIndex = midpoint;

  // Check if split separates same spec type
  if (shouldAdjustSplit(sortedTemplateRows, splitIndex)) {
    debugLog(`[SPLIT STRATEGY] Split at ${splitIndex} separates same spec type, attempting adjustment`);

    // Try adjustments in order: down 1, 2, 3, then up 1
    const adjustments = [1, 2, 3, -1]; // positive = down, negative = up
    for (const adjustment of adjustments) {
      const candidateIndex = splitIndex + adjustment;

      // Ensure within bounds
      if (candidateIndex > 0 && candidateIndex < totalSpecs) {
        if (!shouldAdjustSplit(sortedTemplateRows, candidateIndex)) {
          debugLog(`[SPLIT STRATEGY] Adjusted to index ${candidateIndex} (offset +${adjustment})`);
          return candidateIndex;
        }
      }
    }

    debugLog(`[SPLIT STRATEGY] No valid adjustment found, using original midpoint ${splitIndex}`);
  } else {
    debugLog(`[SPLIT STRATEGY] Split at midpoint ${splitIndex} is valid`);
  }

  return splitIndex;
}

/**
 * Check if split would separate same spec type on both sides
 * Returns true if the spec type at (index-1) == spec type at (index)
 */
function shouldAdjustSplit(
  sortedTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }>,
  splitIndex: number
): boolean {
  if (splitIndex <= 0 || splitIndex >= sortedTemplateRows.length) {
    return false;
  }

  const lastLeftTemplate = sortedTemplateRows[splitIndex - 1].template;
  const firstRightTemplate = sortedTemplateRows[splitIndex].template;

  return lastLeftTemplate === firstRightTemplate;
}

// ============================================
// RENDERING FUNCTIONS
// ============================================

/**
 * Render specifications for parts (parent + sub-items combined)
 */
export function renderSpecifications(
  doc: any,
  parts: any[],
  x: number,
  startY: number,
  width: number,
  formType: FormType,
  specsToRender?: Array<{ template: string; rowNum: string; specs: Record<string, any> }>
): number {
  debugLog('[PDF RENDER] ========== START renderSpecifications ==========');
  debugLog(`[PDF RENDER] Processing ${parts.length} parts for ${formType} form`);

  let currentY = startY;

  // Use provided specs or build from parts
  const sortedTemplateRows = specsToRender || buildSortedTemplateRows(parts, formType);

  const specsDisplayName = parts.length > 0 ? parts[0].specs_display_name : null;
  const isExemptFromCritical = specsDisplayName && SPECS_EXEMPT_FROM_CRITICAL.includes(specsDisplayName as any);

  // Render each template row
  doc.fontSize(FONT_SIZES.SPEC_BODY);
  sortedTemplateRows.forEach(row => {
    const isCriticalSpec = CRITICAL_SPECS.includes(row.template as any) && !isExemptFromCritical;

    // Skip Back spec if it matches the default value for this product type
    if (row.template === 'Back' && shouldSkipBackSpec(specsDisplayName, row.specs)) {
      debugLog(`[PDF RENDER] Skipping Back spec - matches default value for ${specsDisplayName}`);
      return; // Skip to next row
    }

    // Critical specs: always show them (unless exempt)
    if (isCriticalSpec) {
      const valueStr = formatSpecValues(row.template, row.specs, formType) || 'No';
      currentY = renderSpecRow(doc, row.template, valueStr, x, currentY, width);
    } else if (Object.keys(row.specs).length > 0) {
      // Other specs: only show if there are values
      const valueStr = formatSpecValues(row.template, row.specs, formType);
      currentY = renderSpecRow(doc, row.template, valueStr, x, currentY, width);
    }
  });

  return currentY;
}

/**
 * Accurately calculate text height by counting wrapped lines
 * Handles both manual newlines (\n) and automatic word wrapping
 */
export function calculateAccurateTextHeight(
  doc: any,
  text: string,
  maxWidth: number,
  fontSize: number,
  fontStyle: string
): number {
  doc.fontSize(fontSize).font(fontStyle);
  const lineHeight = doc.currentLineHeight();

  // First split by manual newlines
  const manualLines = text.split('\n');
  let totalLineCount = 0;

  // Process each manual line segment for word wrapping
  for (const segment of manualLines) {
    if (!segment.trim()) {
      // Empty line from manual newline
      totalLineCount++;
      continue;
    }

    // Split segment into words and calculate wrapping
    // Use regex to split by one or more whitespace chars, filter empty strings
    const words = segment.split(/\s+/).filter(w => w.length > 0);
    let currentLine = '';
    let segmentLineCount = 0;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.widthOfString(testLine, { kerning: true });

      if (testWidth > maxWidth && currentLine) {
        // Line is too long, start a new line
        segmentLineCount++;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    // Count the last line of this segment
    if (currentLine) {
      segmentLineCount++;
    }

    totalLineCount += segmentLineCount;
  }

  // Add extra height buffer to account for line spacing and descenders
  const baseHeight = totalLineCount * lineHeight;
  const heightBuffer = totalLineCount > 1 ? (totalLineCount - 1) * 3 : 0; // 3px per line break

  // Debug logging for long text
  if (text.length > 100) {
    console.log(`[HEIGHT CALC] Text length: ${text.length}, Calculated lines: ${totalLineCount}, MaxWidth: ${maxWidth}, Total height: ${baseHeight + heightBuffer}`);
  }

  return baseHeight + heightBuffer;
}

/**
 * Render a single spec row with label and value
 */
function renderSpecRow(
  doc: any,
  label: string,
  value: string,
  x: number,
  currentY: number,
  width: number
): number {
  const labelText = label;
  const trimmedValue = value?.trim() || '';

  // === STEP 1: Calculate all dimensions first ===

  // Label dimensions (11pt font)
  doc.fontSize(11).font('Helvetica-Bold');
  const labelHeight = doc.currentLineHeight();

  // Get standardized label width
  const standardLabelWidth = getStandardLabelWidth(doc);

  // Calculate actual text width for horizontal centering
  const actualTextWidth = doc.widthOfString(labelText);
  const textLeftPadding = (standardLabelWidth - actualTextWidth) / 2;

  // Calculate value position and width
  const valueX = x - SPACING.LABEL_PADDING + standardLabelWidth + doc.widthOfString('  ');
  const availableValueWidth = width - (valueX - x);

  // Calculate value height based on content and font - ACCURATELY
  let valueHeight = 0;
  let valueLineHeight = 0;

  if (trimmedValue === 'No') {
    // "No" values use 12pt font
    doc.fontSize(12).font('Helvetica-Bold');
    valueLineHeight = doc.currentLineHeight();
    valueHeight = valueLineHeight;
  } else {
    // Normal values use 12pt font
    if (trimmedValue) {
      // Use accurate calculation for wrapped text
      valueHeight = calculateAccurateTextHeight(doc, trimmedValue, availableValueWidth, 12, 'Helvetica');
      doc.fontSize(12).font('Helvetica');
      valueLineHeight = doc.currentLineHeight();
    } else {
      doc.fontSize(12).font('Helvetica');
      valueLineHeight = doc.currentLineHeight();
      valueHeight = valueLineHeight;
    }
  }

  const effectiveValueHeight = Math.max(valueHeight, valueLineHeight);

  // Add padding above and below the value height
  const valuePadding = 1; // padding above and below the value text (reduced for compact layout)
  const paddedValueHeight = effectiveValueHeight + (valuePadding * 2);

  // Calculate label box height with padding for text positioning
  const topTextPadding = 3; // reduced from 3 for compact layout
  const bottomTextPadding = 1; // reduced from 2 for compact layout
  const maxContentHeight = Math.max(labelHeight, paddedValueHeight);
  const labelBoxHeight = maxContentHeight + topTextPadding + bottomTextPadding;

  // === STEP 2: Determine label background color ===

  let labelBgColor = COLORS.LABEL_BG_DEFAULT;
  if (['LEDs', 'Neon LED', 'Power Supply', 'Wire Length', 'UL'].includes(labelText)) {
    labelBgColor = COLORS.LABEL_BG_ELECTRICAL;
  } else if (['Vinyl', 'Digital Print'].includes(labelText)) {
    labelBgColor = COLORS.LABEL_BG_VINYL;
  } else if (labelText === 'Painting') {
    labelBgColor = COLORS.LABEL_BG_PAINTING;
  }

  // === STEP 3: Draw extended label box ===

  const labelBoxStartY = currentY;
  doc.fillColor(labelBgColor)
    .rect(
      x - SPACING.LABEL_PADDING,
      labelBoxStartY,
      standardLabelWidth,
      labelBoxHeight
    )
    .fill();

  // === STEP 4: Render label text (centered vertically in extended box) ===

  const labelTextY = labelBoxStartY + (labelBoxHeight - labelHeight) / 2;
  const centeredX = x - SPACING.LABEL_PADDING + textLeftPadding;

  doc.fillColor(COLORS.BLACK)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(labelText, centeredX, labelTextY, {
      continued: false,
      width: standardLabelWidth,
      lineBreak: false
    });

  // === STEP 5: Render value (with top padding + value padding) ===

  const valueY = labelBoxStartY + topTextPadding + valuePadding;

  if (trimmedValue === 'No') {
    // Special styling for "No" values - centered vertically in the box
    doc.fontSize(11).font('Helvetica-Bold');
    const noTextWidth = doc.widthOfString(value);
    const noLineHeight = doc.currentLineHeight();

    const leftPadding = 12;
    const rightPadding = 12;
    const highlightWidth = noTextWidth + leftPadding + rightPadding;

    // Position "No" with top padding + value padding (same as other text)
    const noY = labelBoxStartY + topTextPadding + valuePadding;
    const noBgStartY = noY - 2;
    const noBgHeight = noLineHeight + 3;
    const rectStartX = valueX - SPACING.LABEL_PADDING + 6;

    // Draw red background for "No"
    doc.fillColor(COLORS.NO_BG)
      .rect(
        rectStartX,
        noBgStartY,
        highlightWidth,
        noBgHeight
      )
      .fill();

    // Render "No" text in black
    const noTextX = rectStartX + leftPadding;
    doc.fillColor(COLORS.BLACK)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(value, noTextX, noY, {
        width: noTextWidth,
        lineBreak: false
      });
  } else {
    // Render normal value (12pt font, can wrap)
    doc.fillColor(COLORS.BLACK)
      .fontSize(12)
      .font('Helvetica')
      .text(value, valueX, valueY, {
        width: availableValueWidth,
        lineBreak: true
      });
  }

  // === STEP 6: Draw horizontal line at BOTTOM of label box ===

  const lineY = labelBoxStartY + labelBoxHeight;
  doc.fillColor(labelBgColor)
    .rect(
      x - SPACING.LABEL_PADDING,
      lineY-1,
      width,
      1
    )
    .fill();

  // === STEP 7: Return bottom of row + gap ===

  const rowBottom = labelBoxStartY + labelBoxHeight;
  return rowBottom + SPACING.SPEC_ROW_GAP;
}
