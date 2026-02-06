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
  formatSpecValues,
  TransformContext
} from '../formatters/specFormatters';

// Import StandardizedSpec type for painting metadata
import type { StandardizedSpec } from '../../orderSpecificationStandardizationService';

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

/**
 * Product types that should skip the Cutting spec on order forms
 * Backer products have Cutting method (Router) auto-filled but this is redundant on forms
 */
const SKIP_CUTTING_SPEC_PRODUCT_TYPES = ['Backer'];

/**
 * Check if the Cutting spec should be skipped for this product type
 */
function shouldSkipCuttingSpec(specsDisplayName: string | null): boolean {
  if (!specsDisplayName) return false;
  return SKIP_CUTTING_SPEC_PRODUCT_TYPES.includes(specsDisplayName);
}

/**
 * Default Face Assembly values by product type
 * When Face Assembly matches the default, it should be skipped (redundant info)
 * Note: Only Halo Lit has a default - Front Lit Acrylic Face always shows its Face Assembly
 */
const DEFAULT_FACE_ASSEMBLY: Record<string, string> = {
  'Halo Lit': 'Face to Return',
};

/**
 * Check if the Face Assembly spec should be skipped because it matches the default value
 *
 * @param specsDisplayName - The product type (e.g., "Halo Lit", "Front Lit Acrylic Face")
 * @param faceAssemblySpecs - The Face Assembly spec values (contains 'description' field)
 * @returns true if the spec should be skipped, false otherwise
 */
function shouldSkipFaceAssemblySpec(specsDisplayName: string | null, faceAssemblySpecs: Record<string, any>): boolean {
  if (!specsDisplayName || !faceAssemblySpecs) return false;

  const defaultFaceAssembly = DEFAULT_FACE_ASSEMBLY[specsDisplayName];
  if (!defaultFaceAssembly) return false;

  // Get the description value from the Face Assembly spec
  const faceAssemblyDescription = faceAssemblySpecs.description || '';

  // Skip if the Face Assembly description matches the default for this product type
  return faceAssemblyDescription === defaultFaceAssembly;
}

/**
 * Specs that should be hidden from all PDF order forms
 * Currently empty - Assembly specs now display on Master, Customer, and Shop forms
 * (Packing List uses a separate renderer and doesn't show specs)
 */
const HIDDEN_SPECS_FROM_PDF: string[] = [];

// ============================================
// SPEEDBOX CONSOLIDATION (Customer Forms Only)
// ============================================

/**
 * Speedbox normalization mappings for customer PDF
 * Maps specific wattage variants to their base name
 * Note: Database uses "SpdBox" abbreviation due to name length constraints
 */
const SPEEDBOX_CONSOLIDATION: Record<string, string> = {
  'Speedbox 60W': 'Speedbox',
  'Speedbox 180W': 'Speedbox',
  '24V SpdBox 96W': '24V Speedbox',
  '24V SpdBox 192W': '24V Speedbox'
};

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TemplateRow {
  template: string;
  rowNum: string;
  specs: Record<string, any>;
  // Painting transformation metadata (optional, added by paintingSpecTransformer)
  paintingApplied?: boolean;
  paintingColour?: string;
}

/**
 * Consolidate Speedbox power supplies for customer forms
 * - Renames variants to base name (Speedbox 60W → Speedbox)
 * - Merges duplicate entries (if both 60W and 180W exist, show one "Speedbox")
 *
 * Only applies to customer forms - master/shop forms keep original values
 */
function consolidateSpeedboxSpecs(
  specs: TemplateRow[],
  formType: FormType
): TemplateRow[] {
  if (formType !== 'customer') return specs;

  // Find Power Supply row indices
  const powerSupplyIndices: number[] = [];
  specs.forEach((s, i) => {
    if (s.template === 'Power Supply') powerSupplyIndices.push(i);
  });

  if (powerSupplyIndices.length === 0) return specs;

  // Track seen normalized Speedbox types to merge duplicates
  const seenSpeedboxTypes = new Map<string, TemplateRow>();
  const normalizedPowerSupplyRows: TemplateRow[] = [];

  for (const idx of powerSupplyIndices) {
    const row = specs[idx];
    const psType = row.specs.ps_type || '';

    // Extract base name from ps_type (remove parenthetical like "(60W, 24V)")
    const basePsType = psType.split(' (')[0].trim();

    // Check if this is a Speedbox variant that should be normalized
    const normalizedName = SPEEDBOX_CONSOLIDATION[basePsType];

    if (normalizedName) {
      // This is a Speedbox variant - check if we already have this base type
      if (!seenSpeedboxTypes.has(normalizedName)) {
        // First occurrence - normalize the type name
        const normalizedRow: TemplateRow = {
          template: row.template,
          rowNum: row.rowNum,
          specs: { ...row.specs, ps_type: normalizedName }
        };
        seenSpeedboxTypes.set(normalizedName, normalizedRow);
        normalizedPowerSupplyRows.push(normalizedRow);
      }
      // If we've seen it before, skip (merge by dropping duplicate)
    } else {
      // Not a Speedbox variant - keep as-is
      normalizedPowerSupplyRows.push(row);
    }
  }

  // Rebuild specs array: replace Power Supply rows with consolidated ones
  const result: TemplateRow[] = [];
  let psInserted = false;

  for (let i = 0; i < specs.length; i++) {
    if (specs[i].template === 'Power Supply') {
      if (!psInserted) {
        // Insert all consolidated Power Supply rows at the first PS position
        result.push(...normalizedPowerSupplyRows);
        psInserted = true;
      }
      // Skip original PS rows (they're replaced)
    } else {
      result.push(specs[i]);
    }
  }

  return result;
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

                // Only clean LED/PS type fields (remove parenthetical details)
                const isLedTypeField = templateName === 'LEDs' && ['type', 'led_type'].includes(fieldName);
                const isPsTypeField = templateName === 'Power Supply' && ['ps_type', 'model', 'power_supply'].includes(fieldName);

                let finalValue: string;
                if (isLedTypeField || isPsTypeField) {
                  finalValue = cleanSpecValue(String(formattedValue).trim());
                } else {
                  finalValue = String(formattedValue).trim();
                }

                if (finalValue) {
                  rowSpecs[fieldName] = finalValue;
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
 * @param measureOnly - If true, calculate positions but skip drawing (for space measurement)
 * @param specFontSize - Font size for spec values (default 12pt, can be reduced to 10pt)
 */
export function renderSpecifications(
  doc: any,
  parts: any[],
  x: number,
  startY: number,
  width: number,
  formType: FormType,
  specsToRender?: Array<{ template: string; rowNum: string; specs: Record<string, any> }>,
  measureOnly: boolean = false,
  specFontSize: number = FONT_SIZES.SPEC_BODY
): number {
  debugLog('[PDF RENDER] ========== START renderSpecifications ==========');
  debugLog(`[PDF RENDER] Processing ${parts.length} parts for ${formType} form, measureOnly=${measureOnly}, fontSize=${specFontSize}`);

  let currentY = startY;

  // Use provided specs or build from parts
  const sortedTemplateRows = specsToRender || buildSortedTemplateRows(parts, formType);

  // Consolidate Speedbox power supplies for customer forms
  const finalRows = consolidateSpeedboxSpecs(sortedTemplateRows, formType);

  const specsDisplayName = parts.length > 0 ? parts[0].specs_display_name : null;
  const isExemptFromCritical = specsDisplayName && SPECS_EXEMPT_FROM_CRITICAL.includes(specsDisplayName as any);

  // Render each template row
  doc.fontSize(specFontSize);
  finalRows.forEach(row => {
    const isCriticalSpec = CRITICAL_SPECS.includes(row.template as any) && !isExemptFromCritical;

    // Skip Back spec if it matches the default value for this product type
    if (row.template === 'Back' && shouldSkipBackSpec(specsDisplayName, row.specs)) {
      debugLog(`[PDF RENDER] Skipping Back spec - matches default value for ${specsDisplayName}`);
      return; // Skip to next row
    }

    // Skip Cutting spec for Backer products (redundant info)
    if (row.template === 'Cutting' && shouldSkipCuttingSpec(specsDisplayName)) {
      debugLog(`[PDF RENDER] Skipping Cutting spec for ${specsDisplayName}`);
      return; // Skip to next row
    }

    // Skip Face Assembly spec when it matches the default for this product type (e.g., Halo Lit "Face to Return")
    if (row.template === 'Face Assembly' && shouldSkipFaceAssemblySpec(specsDisplayName, row.specs)) {
      debugLog(`[PDF RENDER] Skipping Face Assembly spec - matches default value for ${specsDisplayName}`);
      return; // Skip to next row
    }

    // Skip specs that should be hidden from PDFs (e.g., Assembly - used for task generation only)
    if (HIDDEN_SPECS_FROM_PDF.includes(row.template)) {
      debugLog(`[PDF RENDER] Skipping hidden spec: ${row.template}`);
      return; // Skip to next row
    }

    // Build transform context if painting was applied to this spec
    const transformContext: TransformContext | undefined = row.paintingApplied && row.paintingColour
      ? { paintingColour: row.paintingColour }
      : undefined;

    // Build transform metadata for label coloring
    // Detect non-default drain hole sizes for alert highlighting
    const isDrainHolesAlert = row.template === 'Drain Holes' && row.specs.size && row.specs.size !== '1/4"';
    const transformMeta: TransformMeta | undefined = row.paintingApplied
      ? { paintingApplied: true }
      : isDrainHolesAlert
        ? { alertHighlight: true }
        : undefined;

    // Critical specs: always show them (unless exempt)
    if (isCriticalSpec) {
      const valueStr = formatSpecValues(row.template, row.specs, formType, transformContext) || 'None';
      currentY = renderSpecRow(doc, row.template, valueStr, x, currentY, width, measureOnly, specFontSize, transformMeta);
    } else if (Object.keys(row.specs).length > 0) {
      // Other specs: only show if there are values
      const valueStr = formatSpecValues(row.template, row.specs, formType, transformContext);
      currentY = renderSpecRow(doc, row.template, valueStr, x, currentY, width, measureOnly, specFontSize, transformMeta);
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
 * Transform metadata for rendering painted specs
 */
interface TransformMeta {
  paintingApplied?: boolean;
  alertHighlight?: boolean;
}

/**
 * Render a single spec row with label and value
 * @param measureOnly - If true, calculate positions but skip drawing (for space measurement)
 * @param specFontSize - Font size for spec values (default 12pt, can be reduced to 10pt)
 * @param transformMeta - Optional transform metadata (for painting applied specs)
 */
function renderSpecRow(
  doc: any,
  label: string,
  value: string,
  x: number,
  currentY: number,
  width: number,
  measureOnly: boolean = false,
  specFontSize: number = FONT_SIZES.SPEC_BODY,
  transformMeta?: TransformMeta
): number {
  const labelText = label;
  const trimmedValue = value?.trim() || '';

  // === STEP 1: Calculate all dimensions first ===

  // Label dimensions (11pt font)
  doc.fontSize(FONT_SIZES.SPEC_LABEL).font('Helvetica-Bold');
  const labelHeight = doc.currentLineHeight();

  // Get standardized label width
  const standardLabelWidth = getStandardLabelWidth(doc);

  // Calculate actual text width for horizontal centering
  const actualTextWidth = doc.widthOfString(labelText);
  const textLeftPadding = (standardLabelWidth - actualTextWidth) / 2;

  // Value box positioning - starts immediately after label box (connected)
  const valueBoxStartX = x - SPACING.LABEL_PADDING + standardLabelWidth;
  const valueBoxPaddingLeft = 6;  // Left padding inside value box
  const valueBoxPaddingRight = 6; // Equal right padding

  // Maximum available width for value box (from label end to column edge)
  const maxValueBoxWidth = width - standardLabelWidth + SPACING.LABEL_PADDING;
  // Maximum text width inside value box
  const maxTextWidth = maxValueBoxWidth - valueBoxPaddingLeft - valueBoxPaddingRight;

  // Calculate value height based on content and font - ACCURATELY
  let valueHeight = 0;
  let valueLineHeight = 0;

  if (trimmedValue === 'None') {
    // "None" values use 12pt regular font (matches other values)
    doc.fontSize(specFontSize).font('Helvetica');
    valueLineHeight = doc.currentLineHeight();
    valueHeight = valueLineHeight;
  } else {
    // Normal values use 12pt font
    if (trimmedValue) {
      // Use accurate calculation for wrapped text (using max text width for wrapping)
      valueHeight = calculateAccurateTextHeight(doc, trimmedValue, maxTextWidth, specFontSize, 'Helvetica');
      doc.fontSize(specFontSize).font('Helvetica');
      valueLineHeight = doc.currentLineHeight();
    } else {
      doc.fontSize(specFontSize).font('Helvetica');
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
  // Priority: 1) Painting applied (purple), 2) Electrical (yellow), 3) Vinyl (pink), 4) Painting spec (purple), 5) Default (gray)

  let labelBgColor = COLORS.LABEL_BG_DEFAULT;
  if (transformMeta?.alertHighlight) {
    // Non-default drain holes get red alert background
    labelBgColor = COLORS.LABEL_BG_ALERT;
  } else if (transformMeta?.paintingApplied) {
    // Specs that have been transformed by a painting get purple background
    labelBgColor = COLORS.LABEL_BG_PAINTING;
  } else if (['LEDs', 'Neon LED', 'Power Supply', 'Wire Length', 'UL'].includes(labelText)) {
    labelBgColor = COLORS.LABEL_BG_ELECTRICAL;
  } else if (['Vinyl', 'Digital Print'].includes(labelText)) {
    labelBgColor = COLORS.LABEL_BG_VINYL;
  } else if (labelText === 'Painting') {
    labelBgColor = COLORS.LABEL_BG_PAINTING;
  }

  // === STEP 3: Calculate positions ===

  const labelBoxStartY = currentY;
  const labelBoxStartX = x - SPACING.LABEL_PADDING;
  const borderWidth = 1;

  // Calculate value text X position (with left padding)
  const valueTextX = valueBoxStartX + valueBoxPaddingLeft;
  const valueY = labelBoxStartY + topTextPadding + valuePadding;

  // === STEP 4: Draw label + value box using compound path ===

  if (trimmedValue === 'None') {
    // Special styling for "None" values - same compound path structure, then fill cutout with NO_BG
    doc.fontSize(specFontSize).font('Helvetica');
    const noTextWidth = doc.widthOfString(value);

    // Value box width based on text + padding
    const valueBoxWidth = valueBoxPaddingLeft + noTextWidth + valueBoxPaddingRight;

    // Compound path: outer rect (label + value + borders) with inner cutout (value content)
    const outerWidth = standardLabelWidth + valueBoxWidth;

    // Cutout: inset by borderWidth on top/right/bottom, no inset on left (connects to label)
    const cutoutX = valueBoxStartX;
    const cutoutY = labelBoxStartY + borderWidth;
    const cutoutWidth = valueBoxWidth - borderWidth;
    const cutoutHeight = labelBoxHeight - (borderWidth * 2);

    // Only draw if not in measurement mode
    if (!measureOnly) {
      // Create compound path and fill with evenOdd rule (label + borders)
      doc.rect(labelBoxStartX, labelBoxStartY, outerWidth, labelBoxHeight)  // Outer rect
        .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight);                  // Inner cutout
      doc.fillColor(labelBgColor).fill('evenodd');

      // Fill the cutout area with NO_BG
      doc.fillColor(COLORS.NO_BG)
        .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight)
        .fill();

      // Render label text (centered vertically in box)
      const labelTextY = labelBoxStartY + (labelBoxHeight - labelHeight) / 2;
      const centeredX = labelBoxStartX + textLeftPadding;
      doc.fillColor(COLORS.BLACK)
        .fontSize(FONT_SIZES.SPEC_LABEL)
        .font('Helvetica-Bold')
        .text(labelText, centeredX, labelTextY, {
          continued: false,
          width: standardLabelWidth,
          lineBreak: false
        });

      // Render "None" text in black, vertically centered in cutout
      const noLineHeight = doc.currentLineHeight();
      const noY = cutoutY + (cutoutHeight - noLineHeight) / 2;
      doc.fillColor(COLORS.BLACK)
        .fontSize(specFontSize)
        .font('Helvetica')
        .text(value, valueTextX, noY, {
          width: noTextWidth,
          lineBreak: false
        });
    }
  } else {
    // Normal value: use compound path with inset cutout for borders
    doc.fontSize(specFontSize).font('Helvetica');

    // Calculate value text width for dynamic box sizing
    const valueTextWidth = doc.widthOfString(trimmedValue || '');
    const needsWrapping = valueTextWidth > maxTextWidth;

    let valueBoxWidth: number;
    if (needsWrapping || !trimmedValue) {
      // Multi-line or empty: use max available width
      valueBoxWidth = maxValueBoxWidth;
    } else {
      // Single line: dynamic width based on text
      valueBoxWidth = valueBoxPaddingLeft + valueTextWidth + valueBoxPaddingRight;
    }

    // Compound path: outer rect (label + value + borders) with inner cutout (value content)
    // The fill creates the label background AND the value borders in one shape
    const outerWidth = standardLabelWidth + valueBoxWidth;

    // Cutout: inset by borderWidth on top/right/bottom, no inset on left (connects to label)
    const cutoutX = valueBoxStartX;
    const cutoutY = labelBoxStartY + borderWidth;
    const cutoutWidth = valueBoxWidth - borderWidth;
    const cutoutHeight = labelBoxHeight - (borderWidth * 2);

    // Only draw if not in measurement mode
    if (!measureOnly) {
      // Create compound path and fill with evenOdd rule
      doc.rect(labelBoxStartX, labelBoxStartY, outerWidth, labelBoxHeight)  // Outer rect
        .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight);                  // Inner cutout
      doc.fillColor(labelBgColor).fill('evenodd');

      // Render label text (centered vertically in box)
      const labelTextY = labelBoxStartY + (labelBoxHeight - labelHeight) / 2;
      const centeredX = labelBoxStartX + textLeftPadding;
      doc.fillColor(COLORS.BLACK)
        .fontSize(FONT_SIZES.SPEC_LABEL)
        .font('Helvetica-Bold')
        .text(labelText, centeredX, labelTextY, {
          continued: false,
          width: standardLabelWidth,
          lineBreak: false
        });

      // Render value text (use maxTextWidth for consistent wrapping)
      // Alert highlighted specs (e.g., non-default drain holes) use red text
      const valueTextColor = transformMeta?.alertHighlight ? COLORS.URGENT_RED : COLORS.BLACK;
      doc.fillColor(valueTextColor)
        .fontSize(specFontSize)
        .font('Helvetica')
        .text(value, valueTextX, valueY, {
          width: maxTextWidth,
          lineBreak: true
        });
    }
  }

  // === STEP 6: Return bottom of row + gap ===

  const rowBottom = labelBoxStartY + labelBoxHeight;
  return rowBottom + SPACING.SPEC_ROW_GAP;
}

/**
 * Render a label/value box with configurable value font size
 * Used for Sign Type and Scope boxes which have larger/smaller fonts than spec rows
 * @param measureOnly - If true, calculate positions but skip drawing (for space measurement)
 * @param labelFontSize - Optional font size for label (defaults to SPEC_LABEL)
 */
function renderLabelValueBox(
  doc: any,
  label: string,
  value: string,
  x: number,
  currentY: number,
  width: number,
  valueFontSize: number,
  boldValue: boolean = false,
  measureOnly: boolean = false,
  labelFontSize: number = FONT_SIZES.SPEC_LABEL
): number {
  const labelText = label;
  const trimmedValue = value?.trim() || '';

  // === STEP 1: Calculate all dimensions first ===

  // Label dimensions (configurable font size)
  doc.fontSize(labelFontSize).font('Helvetica-Bold');
  const labelHeight = doc.currentLineHeight();

  // Get standardized label width (note: this changes font to SPEC_LABEL size)
  const standardLabelWidth = getStandardLabelWidth(doc);

  // Reset to actual label font size for text width measurement
  doc.fontSize(labelFontSize).font('Helvetica-Bold');
  const actualTextWidth = doc.widthOfString(labelText);
  const textLeftPadding = (standardLabelWidth - actualTextWidth) / 2;

  // Value box positioning - starts immediately after label box (connected)
  const valueBoxStartX = x - SPACING.LABEL_PADDING + standardLabelWidth;
  const valueBoxPaddingLeft = 6;  // Left padding inside value box
  const valueBoxPaddingRight = 6; // Equal right padding

  // Maximum available width for value box (from label end to column edge)
  const maxValueBoxWidth = width - standardLabelWidth + SPACING.LABEL_PADDING;
  // Maximum text width inside value box
  const maxTextWidth = maxValueBoxWidth - valueBoxPaddingLeft - valueBoxPaddingRight;

  // Calculate value height based on content and font - ACCURATELY
  let valueHeight = 0;
  let valueLineHeight = 0;
  const valueFont = boldValue ? 'Helvetica-Bold' : 'Helvetica';

  // Use configurable font size for value
  if (trimmedValue) {
    valueHeight = calculateAccurateTextHeight(doc, trimmedValue, maxTextWidth, valueFontSize, valueFont);
    doc.fontSize(valueFontSize).font(valueFont);
    valueLineHeight = doc.currentLineHeight();
  } else {
    doc.fontSize(valueFontSize).font(valueFont);
    valueLineHeight = doc.currentLineHeight();
    valueHeight = valueLineHeight;
  }

  const effectiveValueHeight = Math.max(valueHeight, valueLineHeight);

  // Add padding above and below the value height
  const valuePadding = 1;
  const paddedValueHeight = effectiveValueHeight + (valuePadding * 2);

  // Calculate label box height with padding for text positioning
  const topTextPadding = 3;
  const bottomTextPadding = 1;
  const maxContentHeight = Math.max(labelHeight, paddedValueHeight);
  const labelBoxHeight = maxContentHeight + topTextPadding + bottomTextPadding;

  // === STEP 2: Use darker label background color (for Sign Type/Scope boxes) ===
  const labelBgColor = COLORS.LABEL_BG_DARKER;

  // === STEP 3: Calculate positions ===
  const labelBoxStartY = currentY;
  const labelBoxStartX = x - SPACING.LABEL_PADDING;
  const borderWidth = 1;

  // Calculate value text X position (with left padding)
  const valueTextX = valueBoxStartX + valueBoxPaddingLeft;

  // === STEP 4: Draw label + value box using compound path ===
  doc.fontSize(valueFontSize).font(valueFont);

  // Calculate value text width for dynamic box sizing
  const valueTextWidth = doc.widthOfString(trimmedValue || '');
  const needsWrapping = valueTextWidth > maxTextWidth;

  let valueBoxWidth: number;
  if (needsWrapping || !trimmedValue) {
    // Multi-line or empty: use max available width
    valueBoxWidth = maxValueBoxWidth;
  } else {
    // Single line: dynamic width based on text
    valueBoxWidth = valueBoxPaddingLeft + valueTextWidth + valueBoxPaddingRight;
  }

  // Compound path: outer rect (label + value + borders) with inner cutout (value content)
  const outerWidth = standardLabelWidth + valueBoxWidth;

  // Cutout: inset by borderWidth on top/right/bottom, no inset on left (connects to label)
  const cutoutX = valueBoxStartX;
  const cutoutY = labelBoxStartY + borderWidth;
  const cutoutWidth = valueBoxWidth - borderWidth;
  const cutoutHeight = labelBoxHeight - (borderWidth * 2);

  // Only draw if not in measurement mode
  if (!measureOnly) {
    // Create compound path and fill with evenOdd rule
    doc.rect(labelBoxStartX, labelBoxStartY, outerWidth, labelBoxHeight)  // Outer rect
      .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight);                  // Inner cutout
    doc.fillColor(labelBgColor).fill('evenodd');

    // Render label text (centered vertically in box)
    const labelTextY = labelBoxStartY + (labelBoxHeight - labelHeight) / 2;
    const centeredX = labelBoxStartX + textLeftPadding;
    doc.fillColor(COLORS.BLACK)
      .fontSize(labelFontSize)
      .font('Helvetica-Bold')
      .text(labelText, centeredX, labelTextY, {
        continued: false,
        width: standardLabelWidth,
        lineBreak: false
      });

    // Calculate value Y position (centered vertically for single line, top-aligned for multi-line)
    let valueY: number;
    if (needsWrapping) {
      // Multi-line: start at top with padding
      valueY = labelBoxStartY + topTextPadding + valuePadding;
    } else {
      // Single line: center vertically in box
      valueY = labelBoxStartY + (labelBoxHeight - valueLineHeight) / 2;
    }

    // Render value text (use maxTextWidth for consistent wrapping)
    doc.fillColor(COLORS.BLACK)
      .fontSize(valueFontSize)
      .font(valueFont)
      .text(value, valueTextX, valueY, {
        width: maxTextWidth,
        lineBreak: true
      });
  }

  // === STEP 5: Return bottom of row + gap ===
  const rowBottom = labelBoxStartY + labelBoxHeight;
  return rowBottom + SPACING.SPEC_ROW_GAP;
}

/**
 * Render Sign Type and optional Scope label/value boxes
 * Replaces the plain text product name title with styled boxes
 *
 * @param doc - PDFKit document
 * @param displayName - Product type name (e.g., "Front Lit")
 * @param scope - Optional scope text (e.g., "Illuminated Box Sign")
 * @param x - X position for rendering
 * @param startY - Starting Y position
 * @param width - Available width for the boxes
 * @param measureOnly - If true, calculate positions but skip drawing (for space measurement)
 * @returns New Y position after rendering boxes
 */
export function renderSignTypeBox(
  doc: any,
  displayName: string,
  scope: string | null,
  x: number,
  startY: number,
  width: number,
  measureOnly: boolean = false
): number {
  let currentY = startY;

  // Render Product Type box (12pt bold value font, 12pt label font)
  currentY = renderLabelValueBox(doc, 'Product Type', displayName, x, currentY, width, FONT_SIZES.SIGN_TYPE_VALUE, true, measureOnly, FONT_SIZES.SIGN_TYPE_LABEL);

  // Render Scope box if scope exists (10pt value font with wrapping)
  if (scope) {
    currentY = renderLabelValueBox(doc, 'Scope', scope, x, currentY, width, FONT_SIZES.SCOPE_VALUE, false, measureOnly);
  }

  return currentY;
}
