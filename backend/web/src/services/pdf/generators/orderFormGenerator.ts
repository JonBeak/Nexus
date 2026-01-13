// File Clean up Finished: 2025-11-15

/**
 * Unified Order Form Generator
 * Generates Master, Customer, and Shop order forms from a single template
 *
 * Form Types:
 * - master: Complete internal form with all details (includes internal note)
 * - customer: Customer-facing form (also referred to as "Specs" - removes internal notes, simplifies LED/Power Supply)
 * - shop: Production floor form (removes customer details, 2-row header; includes internal note)
 *
 * Layout: Landscape Letter (11" x 8.5")
 * Design: Minimal padding, compact info, large image area
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import type { OrderDataForPDF } from '../../../types/orders';
import { checkFileWritable, FileBusyError } from '../utils/safeFileWriter';
import {
  FormType,
  COLORS,
  FONT_SIZES,
  SPACING,
  LAYOUT,
  LINE_WIDTHS,
  SMB_PATHS
} from './pdfConstants';
import {
  debugLog,
  formatBooleanValue,
  cleanSpecValue,
  formatDueDateTime,
  getImageFullPath,
  shouldIncludePart,
  shouldStartNewColumn,
  getSpecsQuantity
} from './pdfHelpers';
import {
  renderHeaderLabel,
  renderDueDate,
  renderQuantityBox,
  renderMasterCustomerInfoRows,
  renderShopInfoRows
} from './pdfHeaderRenderers';
import { renderNotesAndImage } from '../utils/imageProcessing';
import { SPEC_ORDER, CRITICAL_SPECS, SPECS_EXEMPT_FROM_CRITICAL, formatSpecValues } from '../formatters/specFormatters';
import {
  buildSortedTemplateRows,
  renderSpecifications,
  calculateOptimalSplitIndex,
  TemplateRow,
  renderSignTypeBox
} from '../renderers/specRenderers';
import { buildPartColumns, PartColumn } from '../utils/partColumnBuilder';
import { standardizeOrderParts, PartColumnStandardized } from '../../orderSpecificationStandardizationService';

// ============================================
// HELPER FUNCTIONS - Header Rendering
// ============================================

/**
 * Render compact header with order information
 */
function renderCompactHeader(
  doc: any,
  orderData: OrderDataForPDF,
  formType: FormType,
  marginLeft: number,
  contentWidth: number,
  pageWidth: number,
  marginRight: number,
  startY: number
): number {
  const headerStartY = startY;
  let currentY = startY + SPACING.HEADER_START_OFFSET;

  // Right side info columns
  const infoStartX = marginLeft + LAYOUT.TITLE_WIDTH + LAYOUT.TITLE_INFO_GAP;
  const col1X = infoStartX;
  const col2X = infoStartX + (contentWidth - LAYOUT.TITLE_WIDTH - LAYOUT.TITLE_INFO_GAP) * LAYOUT.COL2_PERCENT;
  const col3X = infoStartX + (contentWidth - LAYOUT.TITLE_WIDTH - LAYOUT.TITLE_INFO_GAP) * LAYOUT.COL3_PERCENT;

  // Calculate baseline alignment offset - raise larger font up 2pts
  const baselineOffset = 0; // Labels and values now aligned at top, with values raised 2pts below

  // Render header rows first to get the total height
  if (formType === 'shop') {
    currentY = renderShopInfoRows(doc, orderData, col1X, col2X, col3X, currentY, pageWidth, marginRight);
  } else {
    const showDueDate = formType !== 'customer';
    currentY = renderMasterCustomerInfoRows(doc, orderData, col1X, col2X, col3X, currentY, showDueDate, undefined, pageWidth, marginRight);
  }

  currentY += SPACING.BEFORE_DIVIDER;

  // Calculate total header content height
  const headerContentHeight = currentY - headerStartY;

  // Title text height: two lines (18pt + 12pt with spacing)
  const titleHeight = 42;

  // Calculate vertical center offset for title
  const titleVerticalOffset = (headerContentHeight - titleHeight) / 2;

  // Now render the left side title, vertically centered
  const titleY = headerStartY + titleVerticalOffset;
  const titleX = marginLeft + LAYOUT.TITLE_LEFT_MARGIN;

  // Order Form (big, 18pt)
  doc.fontSize(18).font('Helvetica-Bold');
  doc.text('Order Form', titleX, titleY);

  // Sign House Inc. (smaller, 12pt)
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('Sign House Inc.', titleX, titleY + 22);

  // Draw vertical divider between title and info columns
  const dividerX = marginLeft + LAYOUT.TITLE_WIDTH + LAYOUT.TITLE_DIVIDER_OFFSET;
  doc.strokeColor(COLORS.DIVIDER_DARK)
    .lineWidth(LINE_WIDTHS.VERTICAL_DIVIDER)
    .moveTo(dividerX, headerStartY)
    .lineTo(dividerX, currentY)
    .stroke();

  // Horizontal divider - thicker line
  doc.strokeColor(COLORS.DIVIDER_DARK)
    .lineWidth(LINE_WIDTHS.DIVIDER_MAIN)
    .moveTo(marginLeft, currentY)
    .lineTo(pageWidth - marginRight, currentY)
    .stroke();

  doc.strokeColor(COLORS.BLACK);

  return currentY + SPACING.SECTION_GAP;
}

/**
 * Render a single part with specs split into 2 horizontal columns (for 9+ specs)
 * Used when there's only 1 part and it has many specs
 * @param measureOnly - If true, calculate positions but skip drawing (for space measurement)
 * @param specFontSize - Font size for spec values (default 12pt, can be reduced to 10pt)
 */
function renderSpecsInTwoColumns(
  doc: any,
  column: PartColumnStandardized,
  marginLeft: number,
  contentWidth: number,
  contentStartY: number,
  pageWidth: number,
  marginRight: number,
  formType: FormType,
  measureOnly: boolean = false,
  specFontSize: number = FONT_SIZES.SPEC_BODY
): number {
  const parent = column.parent;
  const allParts = column.allParts;

  // Get specs_qty from specifications (using shared utility)
  const specsQty = getSpecsQuantity(parent);

  let currentY = contentStartY;

  // Display name
  const displayName = parent.specs_display_name || parent.product_type;

  // Calculate column width for Sign Type box (same as spec columns)
  const signTypeX = marginLeft + LAYOUT.PART_COLUMN_INNER_PADDING;
  const signTypeWidth = contentWidth / 2 - (LAYOUT.PART_COLUMN_INNER_PADDING * 2);

  // Render Sign Type box (and Scope box if scope exists)
  currentY = renderSignTypeBox(doc, displayName, parent.part_scope || null, signTypeX, currentY, signTypeWidth, measureOnly);

  // Add padding above the separator line
  const separatorPadding = 4;
  currentY += separatorPadding;

  // Draw FULL-WIDTH horizontal separator line (thicker line under Sign Type/Scope)
  if (!measureOnly) {
    doc.strokeColor(COLORS.DIVIDER_DARK)
      .lineWidth(LINE_WIDTHS.DIVIDER_MAIN)
      .moveTo(marginLeft, currentY)
      .lineTo(pageWidth - marginRight, currentY)
      .stroke();
    doc.strokeColor(COLORS.BLACK);
  }

  // Equal padding below the separator line
  currentY += separatorPadding;

  // Use pre-computed sorted specs from standardization service
  const sortedTemplateRows = column.allSpecs;

  // Determine split point for 2-column layout
  let splitIndex = calculateOptimalSplitIndex(sortedTemplateRows);

  const leftSpecs = sortedTemplateRows.slice(0, splitIndex);
  const rightSpecs = sortedTemplateRows.slice(splitIndex);

  // Calculate column widths for 2-column layout
  const leftColumnX = marginLeft + LAYOUT.PART_COLUMN_INNER_PADDING;
  const rightColumnX = marginLeft + contentWidth / 2 + LAYOUT.PART_COLUMN_INNER_PADDING;
  const columnWidth = contentWidth / 2 - (LAYOUT.PART_COLUMN_INNER_PADDING * 2);

  // Render left column specs (pass pre-computed specs to avoid rebuilding)
  let leftY = renderSpecifications(doc, allParts, leftColumnX, currentY, columnWidth, formType, leftSpecs, measureOnly, specFontSize);

  // Render right column specs (pass pre-computed specs to avoid rebuilding)
  let rightY = renderSpecifications(doc, allParts, rightColumnX, currentY, columnWidth, formType, rightSpecs, measureOnly, specFontSize);

  // Determine where to place quantity box (under the taller column)
  const maxSpecsY = Math.max(leftY, rightY);
  let finalY = maxSpecsY + 5; // Add gap before quantity box

  // Render quantity box under the left column (position it under lowest spec row)
  if (!measureOnly) {
    finalY = renderQuantityBox(doc, specsQty, leftColumnX, finalY, columnWidth);
  } else {
    // Still need to account for quantity box height in measurement mode
    finalY += 25; // Approximate quantity box height
  }

  return finalY;
}

/**
 * Render all part columns
 * @param measureOnly - If true, calculate positions but skip drawing (for space measurement)
 * @param specFontSize - Font size for spec values (default 12pt, can be reduced to 10pt)
 */
function renderPartColumns(
  doc: any,
  partColumns: PartColumnStandardized[],
  marginLeft: number,
  contentWidth: number,
  contentStartY: number,
  pageWidth: number,
  marginRight: number,
  formType: FormType,
  measureOnly: boolean = false,
  specFontSize: number = FONT_SIZES.SPEC_BODY
): number {
  // Check if this is a single-part order with 9+ specs (use 2-column layout)
  if (partColumns.length === 1) {
    const singleColumn = partColumns[0];
    // Use pre-computed specs from standardization service
    const sortedSpecs = singleColumn.allSpecs;

    if (sortedSpecs.length >= 9) {
      if (!measureOnly) {
        console.log(`[SINGLE PART 2-COLUMN] Order has ${sortedSpecs.length} specs - using 2-column layout`);
      }
      debugLog(`[SINGLE PART 2-COLUMN] Using 2-column layout for ${sortedSpecs.length} specs`);
      return renderSpecsInTwoColumns(doc, singleColumn, marginLeft, contentWidth, contentStartY, pageWidth, marginRight, formType, measureOnly, specFontSize);
    }
  }

  // Multi-part or single-part with <9 specs: use normal column layout
  const numColumns = Math.min(partColumns.length, LAYOUT.MAX_COLUMNS);
  const columnWidth = contentWidth / numColumns;

  let maxPartY = contentStartY;

  // Render each column
  partColumns.forEach((column, columnIndex) => {
    if (columnIndex >= LAYOUT.MAX_COLUMNS) return;

    const partX = marginLeft + (columnIndex * columnWidth) + LAYOUT.PART_COLUMN_INNER_PADDING;
    const partColumnWidth = columnWidth - (LAYOUT.PART_COLUMN_INNER_PADDING * 2);
    let partY = contentStartY;

    const parent = column.parent;

    // Get specs_qty from specifications (using shared utility)
    const specsQty = getSpecsQuantity(parent);

    // Display name
    const displayName = parent.specs_display_name || parent.product_type;

    // Render Sign Type box (and Scope box if scope exists)
    partY = renderSignTypeBox(doc, displayName, parent.part_scope || null, partX, partY, partColumnWidth, measureOnly);

    // Add padding above the separator line
    const separatorPadding = 4;
    partY += separatorPadding;

    // Draw horizontal separator line (thicker line under Sign Type/Scope)
    if (!measureOnly) {
      doc.strokeColor(COLORS.DIVIDER_DARK)
        .lineWidth(LINE_WIDTHS.DIVIDER_MAIN)
        .moveTo(partX, partY)
        .lineTo(partX + partColumnWidth, partY)
        .stroke();
      doc.strokeColor(COLORS.BLACK);
    }

    // Equal padding below the separator line
    partY += separatorPadding;

    // Use pre-computed parts and specs from standardization service
    const allParts = column.allParts;
    debugLog(`[CALL RENDER] Calling renderSpecifications for column with ${allParts.length} parts`);

    // Render all specifications using pre-computed sorted specs
    partY = renderSpecifications(doc, allParts, partX, partY, partColumnWidth, formType, column.allSpecs, measureOnly, specFontSize);

    // Add gap before quantity box
    partY += 5;

    // Render quantity box (shared utility function)
    if (!measureOnly) {
      partY = renderQuantityBox(doc, specsQty, partX, partY, partColumnWidth);
    } else {
      // Still need to account for quantity box height in measurement mode
      partY += 25; // Approximate quantity box height
    }

    // Track the maximum Y position
    if (partY > maxPartY) {
      maxPartY = partY;
    }
  });

  debugLog(`[LAYOUT] Actual parts ended at Y: ${maxPartY}`);

  // Draw vertical dividers between columns (only if multiple parts)
  if (!measureOnly && numColumns > 1) {
    for (let i = 0; i < numColumns - 1; i++) {
      // Calculate divider X position (between columns)
      const dividerX = marginLeft + ((i + 1) * columnWidth);

      // Draw vertical line from top to bottom of parts section
      doc.strokeColor(COLORS.DIVIDER_LIGHT)
        .lineWidth(LINE_WIDTHS.DIVIDER_LIGHT)
        .moveTo(dividerX, contentStartY)
        .lineTo(dividerX, maxPartY)
        .stroke();
    }
    // Reset stroke color
    doc.strokeColor(COLORS.BLACK);
  }

  return maxPartY;
}


// ============================================
// MAIN GENERATION FUNCTION
// ============================================

/**
 * Generate Order Form (Master, Customer, or Shop variant)
 */
export async function generateOrderForm(
  orderData: OrderDataForPDF,
  outputPath: string,
  formType: FormType = 'master'
): Promise<string> {
  // Debug trace
  fs.writeFileSync('/tmp/pdf-generation-test.txt', `${formType.toUpperCase()} FORM CALLED at ${new Date().toISOString()} for order ${orderData.order_number}\n`, { flag: 'a' });

  console.log(`>>>>>>>>>>> ${formType.toUpperCase()} FORM GENERATION STARTED <<<<<<<<<<<<`);
  console.log(`Order Number: ${orderData.order_number}`);
  console.log(`Total Parts: ${orderData.parts.length}`);
  debugLog(`[${formType.toUpperCase()} FORM] Starting generation for order ${orderData.order_number}`);
  debugLog(`[${formType.toUpperCase()} FORM] Total parts: ${orderData.parts.length}`);

  return new Promise(async (resolve, reject) => {
    try {
      // Check if file is writable before attempting generation
      await checkFileWritable(outputPath);

      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: {
          top: SPACING.PAGE_MARGIN,
          bottom: SPACING.PAGE_MARGIN,
          left: SPACING.PAGE_MARGIN,
          right: SPACING.PAGE_MARGIN
        }
      });

      const stream = fs.createWriteStream(outputPath);

      // Attach error handler immediately to catch EBUSY during write
      stream.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EBUSY') {
          reject(new FileBusyError(outputPath));
        } else {
          reject(error);
        }
      });

      doc.pipe(stream);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginLeft = SPACING.PAGE_MARGIN;
      const marginRight = SPACING.PAGE_MARGIN;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // Render header
      let currentY = SPACING.PAGE_MARGIN;
      currentY = renderCompactHeader(doc, orderData, formType, marginLeft, contentWidth, pageWidth, marginRight, currentY);

      // Main content area
      const contentStartY = currentY;
      const availableHeight = pageHeight - contentStartY - 15;

      debugLog(`[LAYOUT] Page dimensions: ${pageWidth} x ${pageHeight}`);
      debugLog(`[LAYOUT] contentStartY: ${contentStartY}, availableHeight: ${availableHeight}`);

      // Standardize specifications upfront (single call, reused throughout rendering)
      console.log(`[STANDARDIZATION] Calling standardizeOrderParts for ${formType} form`);
      const standardizedSpecs = standardizeOrderParts(orderData.parts, formType);
      console.log(`[STANDARDIZATION] Generated ${standardizedSpecs.partColumns.length} columns with ${standardizedSpecs.flattenedSpecs.length} total specs`);

      // ============================================
      // DYNAMIC FONT SIZING - Measure before rendering
      // ============================================

      // Estimate notes height (rough estimate - notes are relatively consistent)
      const notesHeight = formType === 'master' ? 60 : 40;

      // Measure at 12pt first (measureOnly=true)
      const maxPartY12pt = renderPartColumns(
        doc, standardizedSpecs.partColumns, marginLeft, contentWidth, contentStartY,
        pageWidth, marginRight, formType, true, 12
      );

      // Calculate available space for image at 12pt
      const availableSpace12pt = pageHeight - maxPartY12pt - SPACING.IMAGE_AFTER_PARTS
        - notesHeight - SPACING.ITEM_GAP - SPACING.IMAGE_BOTTOM_MARGIN;

      console.log(`[FONT SIZE CHECK] ${formType.toUpperCase()}: maxPartY@12pt=${Math.round(maxPartY12pt)}, availableImageSpace=${Math.round(availableSpace12pt)}pt, required=${LAYOUT.MIN_IMAGE_HEIGHT}pt`);

      let specFontSize = 12;

      if (availableSpace12pt < LAYOUT.MIN_IMAGE_HEIGHT) {
        // Not enough space at 12pt - try 10pt
        const maxPartY10pt = renderPartColumns(
          doc, standardizedSpecs.partColumns, marginLeft, contentWidth, contentStartY,
          pageWidth, marginRight, formType, true, 10
        );

        const availableSpace10pt = pageHeight - maxPartY10pt - SPACING.IMAGE_AFTER_PARTS
          - notesHeight - SPACING.ITEM_GAP - SPACING.IMAGE_BOTTOM_MARGIN;

        console.log(`[FONT SIZE CHECK] ${formType.toUpperCase()}: maxPartY@10pt=${Math.round(maxPartY10pt)}, availableImageSpace=${Math.round(availableSpace10pt)}pt`);

        if (availableSpace10pt >= LAYOUT.MIN_IMAGE_HEIGHT) {
          specFontSize = 10;
          console.log(`[FONT SIZE] ${formType.toUpperCase()} form: Using 10pt font to fit image`);
        } else {
          // Even 10pt won't fit - throw error
          throw new Error(
            `Cannot generate ${formType} form for order ${orderData.order_number}: Too many specifications.\n` +
            `Available image space: ${Math.round(availableSpace10pt)}pt (need ${LAYOUT.MIN_IMAGE_HEIGHT}pt minimum).\n` +
            `Consider reducing specifications or splitting into multiple line items.`
          );
        }
      }

      // ============================================
      // RENDER - Now render for real with chosen font size
      // ============================================

      // Render part columns using pre-computed standardized specs (measureOnly=false)
      const maxPartY = renderPartColumns(
        doc, standardizedSpecs.partColumns, marginLeft, contentWidth, contentStartY,
        pageWidth, marginRight, formType, false, specFontSize
      );

      // Render notes and image section
      await renderNotesAndImage(doc, orderData, maxPartY, marginLeft, contentWidth, pageWidth, marginRight, pageHeight, {
        includeInternalNote: formType === 'master' || formType === 'shop'
      });

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================
// LEGACY EXPORTS
// ============================================

export const generateMasterForm = (orderData: OrderDataForPDF, outputPath: string) =>
  generateOrderForm(orderData, outputPath, 'master');

export const generateCustomerForm = (orderData: OrderDataForPDF, outputPath: string) =>
  generateOrderForm(orderData, outputPath, 'customer');

export const generateShopForm = (orderData: OrderDataForPDF, outputPath: string) =>
  generateOrderForm(orderData, outputPath, 'shop');
