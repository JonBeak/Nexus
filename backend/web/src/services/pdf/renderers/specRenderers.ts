// File Clean up Finished: 2025-11-15

/**
 * Spec Renderers Module
 * Handles spec processing and rendering logic for PDF generation
 *
 * Extracted from orderFormGenerator.ts as part of Phase 2 refactoring
 */

import { COLORS, FONT_SIZES, SPACING, FormType } from '../generators/pdfConstants';
import { debugLog, formatBooleanValue, cleanSpecValue } from '../generators/pdfHelpers';
import {
  SPEC_ORDER,
  CRITICAL_SPECS,
  SPECS_EXEMPT_FROM_CRITICAL,
  formatSpecValues
} from '../formatters/specFormatters';

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
 * Build sorted template rows from parts (extracted for reuse in 2-column layout)
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

  // Sort template rows by SPEC_ORDER, then by row number
  const sortedTemplateRows: Array<{ template: string; rowNum: string; specs: Record<string, any> }> = [];

  // First, add rows in SPEC_ORDER
  for (const templateName of SPEC_ORDER) {
    const matchingRows = allTemplateRows.filter(row => row.template === templateName);
    matchingRows.forEach(row => sortedTemplateRows.push(row));

    // Add critical specs even if not in data (unless this part is exempt)
    const isCritical = CRITICAL_SPECS.includes(templateName as any);
    if (matchingRows.length === 0 && isCritical && !isExemptFromCritical) {
      sortedTemplateRows.push({
        template: templateName,
        rowNum: '0',
        specs: {}
      });
    }
  }

  // Add any templates not in SPEC_ORDER at the end
  allTemplateRows.forEach(row => {
    if (!SPEC_ORDER.includes(row.template as any)) {
      sortedTemplateRows.push(row);
    }
  });

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

  // Label: 11pt (1pt smaller)
  doc.fontSize(11).font('Helvetica-Bold');
  const labelWidth = doc.widthOfString(labelText);
  const labelHeight = doc.currentLineHeight();

  // Calculate black background dimensions
  const grayBoxStartY = currentY - 2;
  const grayBoxHeight = labelHeight + 3;
  const grayBoxEndY = grayBoxStartY + grayBoxHeight; // = currentY + labelHeight + 1

  // Draw black background behind label
  doc.fillColor(COLORS.LABEL_BACKGROUND)
    .rect(
      x - SPACING.LABEL_PADDING,
      grayBoxStartY,
      labelWidth + (SPACING.LABEL_PADDING * 2),
      grayBoxHeight
    )
    .fill();

  // Render label (11pt) in white
  doc.fillColor(COLORS.WHITE)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(`${labelText}  `, x, currentY, {
      continued: false,
      width: width,
      lineBreak: false
    });

  // Calculate value position (after label, raised 1pt)
  const valueX = x + labelWidth + doc.widthOfString('  ');
  const valueY = currentY - 1;  // Raise value by 1pt

  // Calculate value height (13pt font, can wrap)
  doc.fontSize(13).font('Helvetica');
  const valueLineHeight = doc.currentLineHeight();

  let valueHeight = 0;
  if (value && value.trim()) {
    // Only calculate height if there's actual text
    valueHeight = doc.heightOfString(value, {
      width: width - (valueX - x),
      lineBreak: true
    });
  }

  // Use at least one line height for spacing (even if value is empty)
  const effectiveValueHeight = Math.max(valueHeight, valueLineHeight);

  // Draw gray background if value is "No"
  const trimmedValue = value?.trim() || '';
  const availableValueWidth = width - (valueX - x);

  if (trimmedValue === 'No') {
    const textWidth = doc.widthOfString(value);
    const extraPadding = 10; // Add space on each side
    const highlightWidth = textWidth + (extraPadding * 2);

    const grayBgStartY = valueY - 2;
    const grayBgHeight = valueLineHeight + 3;
    const rectStartX = valueX - SPACING.LABEL_PADDING;

    // Draw dark gray background with padding
    doc.fillColor('#999999')
      .rect(
        rectStartX,
        grayBgStartY,
        highlightWidth,
        grayBgHeight
      )
      .fill();

    // Render centered "No" text within the highlight
    const textX = rectStartX + extraPadding;
    doc.fillColor(COLORS.BLACK)
      .text(value, textX, valueY, {
        width: textWidth,
        lineBreak: false
      });
  } else {
    // Render value (even if empty) in black
    doc.fillColor(COLORS.BLACK)
      .text(value, valueX, valueY, {
        width: availableValueWidth,
        lineBreak: true
      });
  }

  // Calculate actual bottom positions
  // Gray box (label background) ends at: currentY + labelHeight + 1
  // Value ends at: (currentY - 1) + effectiveValueHeight = currentY + effectiveValueHeight - 1
  const labelVisualBottom = grayBoxEndY;
  const valueBottom = valueY + effectiveValueHeight;
  const rowBottom = Math.max(labelVisualBottom, valueBottom);

  return rowBottom + SPACING.SPEC_ROW_GAP;
}
