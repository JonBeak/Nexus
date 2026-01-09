// File Clean up Finished: 2025-11-15
/**
 * PDF Header Rendering Functions
 * Functions for rendering headers, labels, dates, and quantity boxes in PDFs
 *
 * Extracted from pdfCommonGenerator.ts as part of file size reduction refactoring
 * REFACTORED: Eliminated ~60 lines of code duplication between renderMasterCustomerPageHeader
 * and renderMasterCustomerInfoRows
 */

import { COLORS, FONT_SIZES, SPACING, LAYOUT, LINE_WIDTHS } from './pdfConstants';
import { formatDueDateTime, getStandardLabelWidth } from './pdfHelpers';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate text height considering wrapping
 * Returns single line height if text fits, or multi-line height if wrapping needed
 */
function calculateHeaderTextHeight(doc: any, text: string, maxWidth: number, fontSize: number): number {
  doc.fontSize(fontSize).font('Helvetica');
  const lineHeight = doc.currentLineHeight();

  if (!text) return lineHeight;

  const textWidth = doc.widthOfString(text);
  if (textWidth <= maxWidth) {
    return lineHeight;
  }

  // Text needs wrapping - calculate number of lines
  const words = text.split(/\s+/);
  let currentLine = '';
  let lineCount = 1;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = doc.widthOfString(testLine);

    if (testWidth > maxWidth && currentLine) {
      lineCount++;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  return lineCount * lineHeight;
}

/**
 * Calculate vertically centered Y position for value text within a box
 * @param boxY - Top of the box
 * @param boxHeight - Height of the box
 * @param textHeight - Height of the text to center
 * @returns Y position for the text
 */
function calculateCenteredValueY(boxY: number, boxHeight: number, textHeight: number): number {
  return boxY + (boxHeight - textHeight) / 2;
}

/**
 * Render a header label text only (background is drawn by drawHeaderValueBox compound path)
 */
export function renderHeaderLabel(doc: any, label: string, x: number, y: number, actualBoxHeight?: number): number {
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const labelHeight = doc.currentLineHeight();

  // Standardize label width based on longest header label "Cust. Job #"
  // Add extra padding to ensure they fit comfortably
  const maxLabelWidth = doc.widthOfString('Cust. Job #');
  const standardLabelWidth = maxLabelWidth + (SPACING.LABEL_PADDING * 2) + 8;

  // Calculate actual text width for centering
  const actualTextWidth = doc.widthOfString(label);
  const textLeftPadding = (standardLabelWidth - actualTextWidth) / 2;

  // Use actual box height if provided, otherwise fall back to base calculation
  const boxHeight = actualBoxHeight || (labelHeight + 8);
  const boxY = y - 4;  // Box starts 4pt above the row Y position

  // Render label text in black, centered horizontally and vertically
  // (Background is drawn separately by drawHeaderValueBox compound path)
  const centeredX = x - SPACING.LABEL_PADDING + textLeftPadding;
  const centeredY = boxY + (boxHeight - labelHeight) / 2;
  doc.fillColor(COLORS.BLACK)
    .text(label, centeredX, centeredY);

  // Reset color
  doc.fillColor(COLORS.BLACK);

  // Return standardized width (for value positioning)
  return standardLabelWidth - SPACING.LABEL_PADDING;
}

/**
 * Draw header label + value box using compound path with inset cutout
 * Creates label background and value borders in one fill operation
 */
function drawHeaderValueBox(
  doc: any,
  labelBoxX: number,
  labelBoxY: number,
  labelBoxHeight: number,
  standardLabelWidth: number,
  columnWidth: number
): void {
  const GAP_BEFORE_NEXT_LABEL = 8;
  const borderWidth = 1;

  // Value box starts where label box ends
  const valueBoxStartX = labelBoxX + standardLabelWidth;
  // Value box ends at column width minus gap
  const valueBoxEndX = labelBoxX + columnWidth - GAP_BEFORE_NEXT_LABEL;
  const valueBoxWidth = valueBoxEndX - valueBoxStartX;

  // Outer rect covers label + value area
  const outerWidth = standardLabelWidth + valueBoxWidth;

  // Cutout: inset by borderWidth on top/right/bottom, no inset on left (connects to label)
  const cutoutX = valueBoxStartX;
  const cutoutY = labelBoxY + borderWidth;
  const cutoutWidth = valueBoxWidth - borderWidth;
  const cutoutHeight = labelBoxHeight - (borderWidth * 2);

  // Create compound path and fill with evenOdd rule
  doc.rect(labelBoxX, labelBoxY, outerWidth, labelBoxHeight)  // Outer rect
    .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight);        // Inner cutout
  doc.fillColor(COLORS.LABEL_BG_DARKER).fill('evenodd');

  doc.fillColor(COLORS.BLACK);
}

/**
 * Draw header label + value box using compound path, then fill cutout with color
 * Same as drawHeaderValueBox but fills the value content area with a background color
 */
function drawHeaderValueBoxFilled(
  doc: any,
  labelBoxX: number,
  labelBoxY: number,
  labelBoxHeight: number,
  standardLabelWidth: number,
  columnWidth: number,
  fillColor: string
): void {
  const GAP_BEFORE_NEXT_LABEL = 8;
  const borderWidth = 1;

  // Value box starts where label box ends
  const valueBoxStartX = labelBoxX + standardLabelWidth;
  // Value box ends at column width minus gap
  const valueBoxEndX = labelBoxX + columnWidth - GAP_BEFORE_NEXT_LABEL;
  const valueBoxWidth = valueBoxEndX - valueBoxStartX;

  // Outer rect covers label + value area
  const outerWidth = standardLabelWidth + valueBoxWidth;

  // Cutout: inset by borderWidth on top/right/bottom, no inset on left (connects to label)
  const cutoutX = valueBoxStartX;
  const cutoutY = labelBoxY + borderWidth;
  const cutoutWidth = valueBoxWidth - borderWidth;
  const cutoutHeight = labelBoxHeight - (borderWidth * 2);

  // Create compound path and fill with evenOdd rule (label + borders)
  doc.rect(labelBoxX, labelBoxY, outerWidth, labelBoxHeight)  // Outer rect
    .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight);        // Inner cutout
  doc.fillColor(COLORS.LABEL_BG_DARKER).fill('evenodd');

  // Fill the cutout area with the specified color
  doc.fillColor(fillColor)
    .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight)
    .fill();

  doc.fillColor(COLORS.BLACK);
}

/**
 * Render due date label and value text only (background is drawn separately)
 */
export function renderDueDate(
  doc: any,
  orderData: any,
  x: number,
  y: number,
  actualBoxHeight?: number
): void {
  if (!orderData.due_date) return;

  const dueDate = new Date(orderData.due_date);
  const dueDateStr = formatDueDateTime(dueDate, orderData.hard_due_date_time);
  const dueLabel = 'Due Date';

  // Render label text (background already drawn by drawHeaderValueBox)
  const dueLabelWidth = renderHeaderLabel(doc, dueLabel, x, y, actualBoxHeight);

  // Calculate centered Y position for value
  const boxY = y - 4;  // Box starts 4pt above the row Y position
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica');
  const textHeight = doc.currentLineHeight();
  const boxHeight = actualBoxHeight || (textHeight + 8);
  const valueY = calculateCenteredValueY(boxY, boxHeight, textHeight);

  // If hard deadline, make date value RED and BOLD
  if (orderData.hard_due_date_time) {
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica-Bold').fillColor(COLORS.URGENT_RED);
    doc.text(dueDateStr, x + dueLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, valueY);
    doc.fillColor(COLORS.BLACK);
  } else {
    // Normal due date - regular black text
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
    doc.text(dueDateStr, x + dueLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, valueY);
  }
}

/**
 * Render quantity box with dynamic sizing based on standard vs non-standard quantities
 * Now follows spec row pattern: Label box on left, value on right, bottom line
 * @param doc - PDFKit document
 * @param specsQty - Quantity value
 * @param partX - X position for the box
 * @param partY - Y position for the box
 * @param partColumnWidth - Width of the column for text wrapping
 * @returns Updated Y position after the quantity box
 */
export function renderQuantityBox(
  doc: any,
  specsQty: number,
  partX: number,
  partY: number,
  partColumnWidth: number
): number {
  const qtyValue = Number(specsQty);
  const isStandard = qtyValue === 1 || qtyValue === 1.0;

  // Style based on quantity - same size for both, only color differs
  const labelBgColor = isStandard ? COLORS.QTY_STANDARD_BG : COLORS.QTY_NONSTANDARD_BG;
  const labelTextColor = COLORS.BLACK; // Always black text on label
  const fontSize = FONT_SIZES.QTY_STANDARD; // Same size for both (14pt)
  const boxHeight = 18; // Same height for both

  // === STEP 1: Calculate label box width (same as spec labels) ===

  const standardLabelWidth = getStandardLabelWidth(doc);

  // Calculate label text width for centering
  const labelText = 'Quantity';
  doc.fontSize(fontSize).font('Helvetica-Bold');
  const labelTextWidth = doc.widthOfString(labelText);
  const textLeftPadding = (standardLabelWidth - labelTextWidth) / 2;

  // === STEP 2: Calculate value text ===

  const qtyUnit = qtyValue <= 1 ? 'set' : 'sets';
  // Format as integer unless decimal is present
  const formattedQty = Number.isInteger(qtyValue) ? qtyValue.toString() : specsQty.toString();
  const valueText = `${formattedQty} ${qtyUnit}`;

  // === STEP 3: Calculate dimensions ===

  const labelBoxStartY = partY - 1;
  const boxX = partX - SPACING.LABEL_PADDING;
  const borderWidth = 1;

  // Value box starts immediately after label box (connected)
  const valueBoxStartX = boxX + standardLabelWidth;
  const valueBoxPaddingLeft = 6;  // Left padding inside value box
  const valueBoxPaddingRight = 6; // Equal right padding

  // Calculate value text width for dynamic box sizing
  doc.fontSize(fontSize).font('Helvetica-Bold');
  const valueTextWidth = doc.widthOfString(valueText);
  const valueBoxWidth = valueBoxPaddingLeft + valueTextWidth + valueBoxPaddingRight;

  // === STEP 4: Draw label + value using compound path with inset cutout ===

  // Outer rect covers label + value + borders
  const outerWidth = standardLabelWidth + valueBoxWidth;

  // Cutout: inset by borderWidth on top/right/bottom, no inset on left (connects to label)
  const cutoutX = valueBoxStartX;
  const cutoutY = labelBoxStartY + borderWidth;
  const cutoutWidth = valueBoxWidth - borderWidth;
  const cutoutHeight = boxHeight - (borderWidth * 2);

  // Create compound path and fill with evenOdd rule
  doc.rect(boxX, labelBoxStartY, outerWidth, boxHeight)  // Outer rect
    .rect(cutoutX, cutoutY, cutoutWidth, cutoutHeight);   // Inner cutout
  doc.fillColor(labelBgColor).fill('evenodd');

  // === STEP 5: Render label text (centered in box) ===

  const labelTextY = labelBoxStartY + (boxHeight - doc.currentLineHeight()) / 2 + 1; // +1 for optical centering
  const centeredX = boxX + textLeftPadding;

  doc.fillColor(labelTextColor)
    .fontSize(fontSize)
    .font('Helvetica-Bold')
    .text(labelText, centeredX, labelTextY, {
      continued: false,
      lineBreak: false
    });

  // === STEP 6: Render value text (vertically centered in box) ===

  const valueTextX = valueBoxStartX + valueBoxPaddingLeft;
  const valueY = labelBoxStartY + (boxHeight - doc.currentLineHeight()) / 2 + 1; // +1 for optical centering

  doc.fillColor(COLORS.BLACK)
    .fontSize(fontSize)
    .font('Helvetica-Bold')
    .text(valueText, valueTextX, valueY, {
      continued: false,
      lineBreak: false
    });

  // Reset colors
  doc.fillColor(COLORS.BLACK);

  const lineY = labelBoxStartY + boxHeight;

  // Return updated Y position (add spacing after quantity box)
  return lineY + SPACING.SPEC_ROW_GAP;
}

// ============================================
// HEADER RENDERING FUNCTIONS
// ============================================

/**
 * Render master/customer form header info rows (3-row)
 * Row 1: Order # | Start Date | Customer
 * Row 2: Job # | PO# | Job Name
 * Row 3: (blank) | Due Date | Delivery
 *
 * REFACTORED: Now accepts optional deliveryBgColor parameter to support packing list styling
 * This eliminates code duplication with renderMasterCustomerPageHeader
 *
 * @param showDueDate - Whether to show due date (false for customer forms)
 * @param deliveryBgColor - Optional background color for Delivery field (for packing list styling)
 * @returns Y position after rows
 */
export function renderMasterCustomerInfoRows(
  doc: any,
  orderData: any,
  col1X: number,
  col2X: number,
  col3X: number,
  startY: number,
  showDueDate: boolean = true,
  deliveryBgColor?: string,
  pageWidth?: number,
  marginRight?: number
): number {
  const GAP_BEFORE_NEXT_LABEL = 8;

  // Calculate column widths for value boxes
  const col1Width = col2X - col1X;
  const col2Width = col3X - col2X;
  const col3Width = pageWidth && marginRight ? (pageWidth - marginRight - col3X + SPACING.LABEL_PADDING) : 150;

  // Calculate standard label width (same as in renderHeaderLabel)
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const maxLabelWidth = doc.widthOfString('Cust. Job #');  // Updated for longer label
  const standardLabelWidth = maxLabelWidth + (SPACING.LABEL_PADDING * 2) + 8;
  const baseLabelHeight = doc.currentLineHeight();
  const baseBoxHeight = baseLabelHeight + 8;

  // Prepare row data
  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
  const jobNumValue = orderData.customer_job_number || '';
  const poValue = orderData.customer_po || '';
  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';

  // Calculate text widths for each column (same as rendering)
  const col1TextWidth = col1Width - (standardLabelWidth - SPACING.LABEL_PADDING) - SPACING.HEADER_LABEL_TO_VALUE - 10;
  const col2TextWidth = col2Width - (standardLabelWidth - SPACING.LABEL_PADDING) - SPACING.HEADER_LABEL_TO_VALUE - 10;
  const col3TextWidth = col3Width - (standardLabelWidth - SPACING.LABEL_PADDING) - SPACING.HEADER_LABEL_TO_VALUE - 10;

  // Calculate row heights based on content that might wrap
  // Row 1: Customer (col3)
  const row1Col3Height = calculateHeaderTextHeight(doc, orderData.company_name || '', col3TextWidth, FONT_SIZES.HEADER_VALUE);
  const row1BoxHeight = Math.max(baseBoxHeight, row1Col3Height + 8);

  // Row 2: Cust. Job # (col1), PO # (col2), Job Name (col3)
  const row2Col1Height = calculateHeaderTextHeight(doc, jobNumValue, col1TextWidth, FONT_SIZES.HEADER_VALUE);
  const row2Col2Height = calculateHeaderTextHeight(doc, poValue, col2TextWidth, FONT_SIZES.HEADER_VALUE);
  const row2Col3Height = calculateHeaderTextHeight(doc, orderData.order_name || '', col3TextWidth, FONT_SIZES.HEADER_VALUE);
  const row2BoxHeight = Math.max(baseBoxHeight, row2Col1Height + 8, row2Col2Height + 8, row2Col3Height + 8);

  const row3BoxHeight = baseBoxHeight;

  // Calculate row Y positions dynamically
  const row1BoxY = startY - 4;
  const row1Y = startY;
  const row2BoxY = row1BoxY + row1BoxHeight + 2;
  const row2Y = row2BoxY + 4;
  const row3BoxY = row2BoxY + row2BoxHeight + 2;
  const row3Y = row3BoxY + 4;

  // === STEP 1: Draw all backgrounds FIRST (compound paths) ===

  // Row 1 backgrounds
  drawHeaderValueBox(doc, col1X - SPACING.LABEL_PADDING, row1BoxY, row1BoxHeight, standardLabelWidth, col1Width);
  drawHeaderValueBox(doc, col2X - SPACING.LABEL_PADDING, row1BoxY, row1BoxHeight, standardLabelWidth, col2Width);
  drawHeaderValueBox(doc, col3X - SPACING.LABEL_PADDING, row1BoxY, row1BoxHeight, standardLabelWidth, col3Width);

  // Row 2 backgrounds
  drawHeaderValueBox(doc, col1X - SPACING.LABEL_PADDING, row2BoxY, row2BoxHeight, standardLabelWidth, col1Width);
  drawHeaderValueBox(doc, col2X - SPACING.LABEL_PADDING, row2BoxY, row2BoxHeight, standardLabelWidth, col2Width);
  drawHeaderValueBox(doc, col3X - SPACING.LABEL_PADDING, row2BoxY, row2BoxHeight, standardLabelWidth, col3Width);

  // Row 3 backgrounds (Due Date + Delivery)
  if (showDueDate) {
    drawHeaderValueBox(doc, col2X - SPACING.LABEL_PADDING, row3BoxY, row3BoxHeight, standardLabelWidth, col2Width);
  }
  if (deliveryBgColor) {
    drawHeaderValueBoxFilled(doc, col3X - SPACING.LABEL_PADDING, row3BoxY, row3BoxHeight, standardLabelWidth, col3Width, deliveryBgColor);
  } else {
    drawHeaderValueBox(doc, col3X - SPACING.LABEL_PADDING, row3BoxY, row3BoxHeight, standardLabelWidth, col3Width);
  }

  // === STEP 2: Render all text ON TOP of backgrounds ===

  // Get single line height for value text centering
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica');
  const singleLineHeight = doc.currentLineHeight();

  // Row 1: Order # | Date | Customer
  let label = 'Order #';
  let labelWidth = renderHeaderLabel(doc, label, col1X, row1Y, row1BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const orderNumX = col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  const row1ValueY = calculateCenteredValueY(row1BoxY, row1BoxHeight, singleLineHeight);
  doc.text(orderData.order_number, orderNumX, row1ValueY);

  label = 'Start Date';
  labelWidth = renderHeaderLabel(doc, label, col2X, row1Y, row1BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const dateX = col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  doc.text(orderDateStr, dateX, row1ValueY);

  label = 'Customer';
  labelWidth = renderHeaderLabel(doc, label, col3X, row1Y, row1BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const customerX = col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  // For wrapping text, center based on actual text height
  const row1CustomerValueY = calculateCenteredValueY(row1BoxY, row1BoxHeight, row1Col3Height);
  doc.text(orderData.company_name || '', customerX, row1CustomerValueY, {
    width: col3TextWidth,
    align: 'left',
    lineBreak: true,
    continued: false
  });

  // Row 2: Cust. Job # | PO# | Job Name
  label = 'Cust. Job #';
  labelWidth = renderHeaderLabel(doc, label, col1X, row2Y, row2BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const jobNumX = col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  const row2JobNumValueY = calculateCenteredValueY(row2BoxY, row2BoxHeight, row2Col1Height);
  doc.text(jobNumValue, jobNumX, row2JobNumValueY, {
    width: col1TextWidth,
    align: 'left',
    lineBreak: true,
    continued: false
  });

  label = 'PO #';
  labelWidth = renderHeaderLabel(doc, label, col2X, row2Y, row2BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const poX = col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  const row2PoValueY = calculateCenteredValueY(row2BoxY, row2BoxHeight, row2Col2Height);
  doc.text(poValue, poX, row2PoValueY, {
    width: col2TextWidth,
    align: 'left',
    lineBreak: true,
    continued: false
  });

  label = 'Job Name';
  labelWidth = renderHeaderLabel(doc, label, col3X, row2Y, row2BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const jobNameX = col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  const row2JobNameValueY = calculateCenteredValueY(row2BoxY, row2BoxHeight, row2Col3Height);
  doc.text(orderData.order_name || '', jobNameX, row2JobNameValueY, {
    width: col3TextWidth,
    align: 'left',
    lineBreak: true,
    continued: false
  });

  // Row 3: (blank) | Due | Delivery
  if (showDueDate) {
    renderDueDate(doc, orderData, col2X, row3Y, row3BoxHeight);
  }

  label = 'Delivery';
  labelWidth = renderHeaderLabel(doc, label, col3X, row3Y, row3BoxHeight);
  const deliveryX = col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const row3ValueY = calculateCenteredValueY(row3BoxY, row3BoxHeight, singleLineHeight);
  doc.text(shippingText, deliveryX, row3ValueY);

  // Return position at the bottom of the last row's box
  return row3BoxY + row3BoxHeight;
}

/**
 * Render master/customer header with title, info rows, and dividers
 * Returns Y position after header
 *
 * REFACTORED: Now calls renderMasterCustomerInfoRows instead of duplicating ~60 lines of code
 *
 * @param deliveryBgColor - Optional background color for Delivery field (for packing list styling)
 * @param pageTitle - Optional title text (default "Order Form")
 * @param showDueDate - Optional flag to show/hide due date (default true)
 */
export function renderMasterCustomerPageHeader(
  doc: any,
  orderData: any,
  marginLeft: number,
  contentWidth: number,
  pageWidth: number,
  marginRight: number,
  startY: number,
  deliveryBgColor?: string,
  pageTitle: string = 'Order Form',
  showDueDate: boolean = true
): number {
  const headerStartY = startY;
  let currentY = startY + SPACING.HEADER_START_OFFSET;

  // Right side info columns
  const infoStartX = marginLeft + LAYOUT.TITLE_WIDTH + LAYOUT.TITLE_INFO_GAP;
  const col1X = infoStartX;
  const col2X = infoStartX + (contentWidth - LAYOUT.TITLE_WIDTH - LAYOUT.TITLE_INFO_GAP) * LAYOUT.COL2_PERCENT;
  const col3X = infoStartX + (contentWidth - LAYOUT.TITLE_WIDTH - LAYOUT.TITLE_INFO_GAP) * LAYOUT.COL3_PERCENT;

  // REFACTORED: Call renderMasterCustomerInfoRows instead of duplicating code
  currentY = renderMasterCustomerInfoRows(
    doc,
    orderData,
    col1X,
    col2X,
    col3X,
    currentY,
    showDueDate,
    deliveryBgColor,
    pageWidth,
    marginRight
  );

  // Calculate total header content height
  const headerContentHeight = currentY - headerStartY;

  // Title text height: two lines (18pt + 12pt with spacing)
  const titleHeight = 42;

  // Calculate vertical center offset for title
  const titleVerticalOffset = (headerContentHeight - titleHeight) / 2;

  // Now render the left side title, vertically centered
  const titleY = headerStartY + titleVerticalOffset;
  const titleX = marginLeft + LAYOUT.TITLE_LEFT_MARGIN;

  // Page title (big, 18pt)
  doc.fontSize(18).font('Helvetica-Bold');
  doc.text(pageTitle, titleX, titleY);

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

  // Add spacing before divider
  currentY += SPACING.BEFORE_DIVIDER;

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
 * Render shop form header info rows (2-row)
 * Row 1: Order # | Start Date | Job Name
 * Row 2: (blank) | Due Date | Delivery
 *
 * @returns Y position after rows
 */
export function renderShopInfoRows(
  doc: any,
  orderData: any,
  col1X: number,
  col2X: number,
  col3X: number,
  startY: number,
  pageWidth?: number,
  marginRight?: number
): number {
  const GAP_BEFORE_NEXT_LABEL = 8;

  // Calculate column widths for value boxes
  const col1Width = col2X - col1X;
  const col2Width = col3X - col2X;
  const col3Width = pageWidth && marginRight ? (pageWidth - marginRight - col3X + SPACING.LABEL_PADDING) : 150;

  // Calculate standard label width (same as in renderHeaderLabel)
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const maxLabelWidth = doc.widthOfString('Cust. Job #');  // Match other headers
  const standardLabelWidth = maxLabelWidth + (SPACING.LABEL_PADDING * 2) + 8;
  const baseLabelHeight = doc.currentLineHeight();
  const baseBoxHeight = baseLabelHeight + 8;

  // Calculate text width for column 3 values (same as rendering)
  const col3TextWidth = col3Width - (standardLabelWidth - SPACING.LABEL_PADDING) - SPACING.HEADER_LABEL_TO_VALUE - 10;

  // Calculate row 1 height based on Job Name that might wrap
  const row1Col3Height = calculateHeaderTextHeight(doc, orderData.order_name || '', col3TextWidth, FONT_SIZES.HEADER_VALUE);
  const row1BoxHeight = Math.max(baseBoxHeight, row1Col3Height + 8);
  const row2BoxHeight = baseBoxHeight;

  // Calculate row Y positions dynamically
  const row1BoxY = startY - 4;
  const row1Y = startY;
  const row2BoxY = row1BoxY + row1BoxHeight + 2;
  const row2Y = row2BoxY + 4;

  // === STEP 1: Draw all backgrounds FIRST (compound paths) ===

  // Row 1 backgrounds
  drawHeaderValueBox(doc, col1X - SPACING.LABEL_PADDING, row1BoxY, row1BoxHeight, standardLabelWidth, col1Width);
  drawHeaderValueBox(doc, col2X - SPACING.LABEL_PADDING, row1BoxY, row1BoxHeight, standardLabelWidth, col2Width);
  drawHeaderValueBox(doc, col3X - SPACING.LABEL_PADDING, row1BoxY, row1BoxHeight, standardLabelWidth, col3Width);

  // Row 2 backgrounds (Due Date + Delivery)
  drawHeaderValueBox(doc, col2X - SPACING.LABEL_PADDING, row2BoxY, row2BoxHeight, standardLabelWidth, col2Width);
  drawHeaderValueBox(doc, col3X - SPACING.LABEL_PADDING, row2BoxY, row2BoxHeight, standardLabelWidth, col3Width);

  // === STEP 2: Render all text ON TOP of backgrounds ===

  // Get single line height for value text centering
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica');
  const singleLineHeight = doc.currentLineHeight();

  // Row 1: Order # | Date | Job Name
  let label = 'Order #';
  let labelWidth = renderHeaderLabel(doc, label, col1X, row1Y, row1BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const row1ValueY = calculateCenteredValueY(row1BoxY, row1BoxHeight, singleLineHeight);
  doc.text(orderData.order_number, col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, row1ValueY);

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
  label = 'Start Date';
  labelWidth = renderHeaderLabel(doc, label, col2X, row1Y, row1BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderDateStr, col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, row1ValueY);

  label = 'Job Name';
  labelWidth = renderHeaderLabel(doc, label, col3X, row1Y, row1BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const jobNameTextWidth = col3Width - labelWidth - SPACING.HEADER_LABEL_TO_VALUE - 10;
  // For wrapping text, center based on actual text height
  const row1JobNameValueY = calculateCenteredValueY(row1BoxY, row1BoxHeight, row1Col3Height);
  doc.text(orderData.order_name || '', col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, row1JobNameValueY, {
    width: jobNameTextWidth,
    align: 'left',
    lineBreak: true,
    continued: false
  });

  // Row 2: (blank) | Due | Delivery
  renderDueDate(doc, orderData, col2X, row2Y, row2BoxHeight);

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  label = 'Delivery';
  labelWidth = renderHeaderLabel(doc, label, col3X, row2Y, row2BoxHeight);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const row2ValueY = calculateCenteredValueY(row2BoxY, row2BoxHeight, singleLineHeight);
  doc.text(shippingText, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, row2ValueY);

  // Return position at the bottom of the last row's box
  return row2BoxY + row2BoxHeight;
}
