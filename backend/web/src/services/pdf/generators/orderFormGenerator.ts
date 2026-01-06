// File Clean up Finished: 2025-11-15

/**
 * Unified Order Form Generator
 * Generates Master, Customer, and Shop order forms from a single template
 *
 * Form Types:
 * - master: Complete internal form with all details
 * - customer: Customer-facing form (also referred to as "Specs" - removes internal notes, simplifies LED/Power Supply)
 * - shop: Production floor form (removes customer details, 2-row header; "Specs" refers to customer form)
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
  TemplateRow
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
 */
function renderSpecsInTwoColumns(
  doc: any,
  column: PartColumnStandardized,
  marginLeft: number,
  contentWidth: number,
  contentStartY: number,
  pageWidth: number,
  marginRight: number,
  formType: FormType
): number {
  const parent = column.parent;
  const allParts = column.allParts;

  // Get specs_qty from specifications (using shared utility)
  const specsQty = getSpecsQuantity(parent);

  let currentY = contentStartY;

  // Display name (left aligned, no duplicate for right column)
  const displayName = parent.specs_display_name || parent.product_type;
  doc.fontSize(FONT_SIZES.TITLE).font('Helvetica-Bold');
  const titleLineHeight = doc.currentLineHeight();

  // Render product name + colon in bold
  const titleText = parent.part_scope ? `${displayName}: ` : displayName;
  doc.text(titleText, marginLeft, currentY, {
    width: contentWidth * LAYOUT.PART_NAME_WIDTH_PERCENT,
    lineBreak: false,
    continued: false
  });

  // Append scope inline with smaller, non-bold font, bottom-aligned
  if (parent.part_scope) {
    // Calculate X position after product type + colon
    const titleTextWidth = doc.widthOfString(titleText, { kerning: true });
    const scopeX = marginLeft + titleTextWidth;

    // Calculate Y offset to bottom-align (move scope text DOWN)
    doc.fontSize(12).font('Helvetica'); // 12pt, not bold
    const scopeLineHeight = doc.currentLineHeight();
    const scopeY = currentY + (titleLineHeight - scopeLineHeight);

    doc.text(parent.part_scope, scopeX, scopeY, {
      lineBreak: false
    });
  }

  currentY += titleLineHeight + 2; // Title height + small gap

  // Draw FULL-WIDTH horizontal separator line (not split)
  doc.strokeColor(COLORS.DIVIDER_LIGHT)
    .lineWidth(LINE_WIDTHS.DIVIDER_LIGHT)
    .moveTo(marginLeft, currentY)
    .lineTo(pageWidth - marginRight, currentY)
    .stroke();
  doc.strokeColor(COLORS.BLACK);

  currentY += SPACING.AFTER_SEPARATOR;

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
  let leftY = renderSpecifications(doc, allParts, leftColumnX, currentY, columnWidth, formType, leftSpecs);

  // Render right column specs (pass pre-computed specs to avoid rebuilding)
  let rightY = renderSpecifications(doc, allParts, rightColumnX, currentY, columnWidth, formType, rightSpecs);

  // Determine where to place quantity box (under the taller column)
  const maxSpecsY = Math.max(leftY, rightY);
  let finalY = maxSpecsY + 5; // Add gap before quantity box

  // Render quantity box under the left column (position it under lowest spec row)
  finalY = renderQuantityBox(doc, specsQty, leftColumnX, finalY, columnWidth);

  return finalY;
}

/**
 * Render all part columns
 */
function renderPartColumns(
  doc: any,
  partColumns: PartColumnStandardized[],
  marginLeft: number,
  contentWidth: number,
  contentStartY: number,
  pageWidth: number,
  marginRight: number,
  formType: FormType
): number {
  // Check if this is a single-part order with 9+ specs (use 2-column layout)
  if (partColumns.length === 1) {
    const singleColumn = partColumns[0];
    // Use pre-computed specs from standardization service
    const sortedSpecs = singleColumn.allSpecs;

    if (sortedSpecs.length >= 9) {
      console.log(`[SINGLE PART 2-COLUMN] Order has ${sortedSpecs.length} specs - using 2-column layout`);
      debugLog(`[SINGLE PART 2-COLUMN] Using 2-column layout for ${sortedSpecs.length} specs`);
      return renderSpecsInTwoColumns(doc, singleColumn, marginLeft, contentWidth, contentStartY, pageWidth, marginRight, formType);
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
    doc.fontSize(FONT_SIZES.TITLE).font('Helvetica-Bold');
    const titleLineHeight = doc.currentLineHeight();

    // Product name + colon in bold
    const titleText = parent.part_scope ? `${displayName}: ` : displayName;
    doc.text(titleText, partX, partY, {
      width: partColumnWidth * LAYOUT.PART_NAME_WIDTH_PERCENT,
      lineBreak: false,
      continued: false
    });

    // Append scope inline with smaller, non-bold font, bottom-aligned
    if (parent.part_scope) {
      // Calculate X position after product type + colon
      const titleTextWidth = doc.widthOfString(titleText, { kerning: true });
      const scopeX = partX + titleTextWidth;

      // Calculate Y offset to bottom-align (move scope text DOWN)
      doc.fontSize(12).font('Helvetica'); // 12pt, not bold
      const scopeLineHeight = doc.currentLineHeight();
      const scopeY = partY + (titleLineHeight - scopeLineHeight);

      doc.text(parent.part_scope, scopeX, scopeY, {
        lineBreak: false
      });
    }

    // Update partY manually (don't use doc.y in multi-column layout)
    partY += titleLineHeight + 2; // Title height + small gap

    // Draw horizontal separator line (split for multi-part, full-width for single with <9)
    doc.strokeColor(COLORS.DIVIDER_LIGHT)
      .lineWidth(LINE_WIDTHS.DIVIDER_LIGHT)
      .moveTo(partX, partY)
      .lineTo(partX + partColumnWidth, partY)
      .stroke();
    doc.strokeColor(COLORS.BLACK);

    partY += SPACING.AFTER_SEPARATOR;

    // Use pre-computed parts and specs from standardization service
    const allParts = column.allParts;
    debugLog(`[CALL RENDER] Calling renderSpecifications for column with ${allParts.length} parts`);

    // Render all specifications using pre-computed sorted specs
    partY = renderSpecifications(doc, allParts, partX, partY, partColumnWidth, formType, column.allSpecs);

    // Add gap before quantity box
    partY += 5;

    // Render quantity box (shared utility function)
    partY = renderQuantityBox(doc, specsQty, partX, partY, partColumnWidth);

    // Track the maximum Y position
    if (partY > maxPartY) {
      maxPartY = partY;
    }
  });

  debugLog(`[LAYOUT] Actual parts ended at Y: ${maxPartY}`);

  // Draw vertical dividers between columns (only if multiple parts)
  if (numColumns > 1) {
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

      // Render part columns using pre-computed standardized specs
      const maxPartY = renderPartColumns(doc, standardizedSpecs.partColumns, marginLeft, contentWidth, contentStartY, pageWidth, marginRight, formType);

      // Render notes and image section
      await renderNotesAndImage(doc, orderData, maxPartY, marginLeft, contentWidth, pageWidth, marginRight, pageHeight, {
        includeInternalNote: formType === 'master'
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
