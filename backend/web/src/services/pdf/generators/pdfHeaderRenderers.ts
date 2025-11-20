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
 * Render a header label with black background (standardized width, centered text)
 */
export function renderHeaderLabel(doc: any, label: string, x: number, y: number): number {
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const labelHeight = doc.currentLineHeight();

  // Standardize label width based on longest header labels "Customer" and "Job Name"
  // Add extra padding to ensure they fit comfortably
  const maxLabelWidth = doc.widthOfString('Customer');
  const standardLabelWidth = maxLabelWidth + (SPACING.LABEL_PADDING * 2) + 8;

  // Calculate actual text width for centering
  const actualTextWidth = doc.widthOfString(label);
  const textLeftPadding = (standardLabelWidth - actualTextWidth) / 2;

  const boxHeight = labelHeight + 3;
  const boxY = y - 2;

  // Draw light gray background behind label (standardized width)
  doc.fillColor(COLORS.LABEL_BG_DEFAULT)
    .rect(
      x - SPACING.LABEL_PADDING,
      boxY,
      standardLabelWidth,
      boxHeight
    )
    .fill();

  // Render label text in black, centered
  const centeredX = x - SPACING.LABEL_PADDING + textLeftPadding;
  doc.fillColor(COLORS.BLACK)
    .text(label, centeredX, y);

  // Draw 1px bottom line (like spec rows)
  const lineY = boxY + boxHeight;
  doc.fillColor(COLORS.LABEL_BG_DEFAULT)
    .rect(
      x - SPACING.LABEL_PADDING,
      lineY - 1,
      standardLabelWidth,
      1
    )
    .fill();

  // Reset color
  doc.fillColor(COLORS.BLACK);

  // Return standardized width (for value positioning)
  return standardLabelWidth - SPACING.LABEL_PADDING;
}

/**
 * Draw 1px bottom line extending from label across value area
 * Includes small gap before next label box
 */
function drawHeaderRowBottomLine(doc: any, x: number, y: number, width: number): void {
  const GAP_BEFORE_NEXT_LABEL = 8; // Small gap between line end and next label box
  doc.fillColor(COLORS.LABEL_BG_DEFAULT)
    .rect(x, y, width - GAP_BEFORE_NEXT_LABEL, 1)
    .fill();
  doc.fillColor(COLORS.BLACK);
}

/**
 * Render due date label and value with optional time
 */
export function renderDueDate(doc: any, orderData: any, x: number, y: number, valueWidth?: number): void {
  if (!orderData.due_date) return;

  const dueDate = new Date(orderData.due_date);
  const dueDateStr = formatDueDateTime(dueDate, orderData.hard_due_date_time);
  const dueLabel = 'Due';

  // Always use black background label
  const dueLabelWidth = renderHeaderLabel(doc, dueLabel, x, y);

  // If hard deadline, make date value RED and BOLD
  if (orderData.hard_due_date_time) {
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica-Bold').fillColor(COLORS.URGENT_RED);
    doc.text(dueDateStr, x + dueLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, y - SPACING.HEADER_VALUE_RAISE);
    doc.fillColor(COLORS.BLACK);
  } else {
    // Normal due date - regular black text
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
    doc.text(dueDateStr, x + dueLabelWidth + SPACING.HEADER_LABEL_TO_VALUE, y - SPACING.HEADER_VALUE_RAISE);
  }

  // Draw bottom line if width provided - extending from label box to column end
  if (valueWidth) {
    doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
    const labelHeight = doc.currentLineHeight();
    const lineY = y - 2 + labelHeight + 3;
    drawHeaderRowBottomLine(doc, x - SPACING.LABEL_PADDING, lineY, valueWidth);
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

  // Style based on quantity
  const labelBgColor = isStandard ? COLORS.QTY_STANDARD_BG : COLORS.QTY_NONSTANDARD_BG;
  const labelTextColor = isStandard ? COLORS.QTY_STANDARD_TEXT : COLORS.QTY_NONSTANDARD_TEXT;
  const fontSize = isStandard ? FONT_SIZES.QTY_STANDARD : FONT_SIZES.QTY_NONSTANDARD;
  const boxHeight = isStandard ? 18 : 22;
  const bottomLineHeight = isStandard ? 2 : 3;

  // === STEP 1: Calculate label box width (same as spec labels) ===

  const standardLabelWidth = getStandardLabelWidth(doc);

  // Calculate label text width for centering
  const labelText = 'Quantity';
  doc.fontSize(fontSize).font('Helvetica-Bold');
  const labelTextWidth = doc.widthOfString(labelText);
  const textLeftPadding = (standardLabelWidth - labelTextWidth) / 2;

  // === STEP 2: Calculate value position and text ===

  const qtyUnit = qtyValue <= 1 ? 'set' : 'sets';
  const valueText = `${specsQty} ${qtyUnit}`;
  const valueX = partX - SPACING.LABEL_PADDING + standardLabelWidth + doc.widthOfString('  ');

  // === STEP 3: Draw label background box ===

  const labelBoxStartY = partY - 1;
  const boxX = partX - SPACING.LABEL_PADDING;

  doc.fillColor(labelBgColor)
    .rect(boxX, labelBoxStartY, standardLabelWidth, boxHeight)
    .fill();

  // === STEP 4: Render label text (centered in box, white/black based on standard) ===

  const labelTextY = labelBoxStartY + (boxHeight - doc.currentLineHeight()) / 2;
  const centeredX = boxX + textLeftPadding;

  doc.fillColor(labelTextColor)
    .fontSize(fontSize)
    .font('Helvetica-Bold')
    .text(labelText, centeredX, labelTextY, {
      continued: false,
      lineBreak: false
    });

  // === STEP 5: Render value text (black, aligned with spec values) ===

  const valueY = labelBoxStartY + (boxHeight - doc.currentLineHeight()) / 2;

  doc.fillColor(COLORS.BLACK)
    .fontSize(fontSize)
    .font('Helvetica-Bold')
    .text(valueText, valueX, valueY, {
      continued: false,
      lineBreak: false
    });

  // === STEP 6: Draw bottom line (2px for standard, 3px for non-standard) ===

  const lineY = labelBoxStartY + boxHeight;
  doc.fillColor(labelBgColor)
    .rect(
      boxX,
      lineY - bottomLineHeight,
      partColumnWidth + SPACING.LABEL_PADDING,
      bottomLineHeight
    )
    .fill();

  // Reset colors
  doc.fillColor(COLORS.BLACK).strokeColor(COLORS.BLACK);

  // Return updated Y position (add spacing after quantity box)
  return lineY + SPACING.SPEC_ROW_GAP;
}

// ============================================
// HEADER RENDERING FUNCTIONS
// ============================================

/**
 * Render master/customer form header info rows (3-row)
 * Row 1: Order # | Date | Customer
 * Row 2: Job # | PO# | Job Name
 * Row 3: (blank) | Due | Delivery
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
  let currentY = startY;

  // Calculate column widths for full-width bottom lines
  const col1Width = col2X - col1X;
  const col2Width = col3X - col2X;
  const col3Width = pageWidth && marginRight ? (pageWidth - marginRight - col3X + SPACING.LABEL_PADDING) : 150; // fallback width

  // Row 1: Order # | Date | Customer
  const rowStartY = currentY;

  let label = 'Order #';
  let labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const orderNumX = col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  doc.text(orderData.order_number, orderNumX, currentY - SPACING.HEADER_VALUE_RAISE);
  const orderNumWidth = doc.widthOfString(orderData.order_number.toString());

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  label = 'Date';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const dateX = col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  doc.text(orderDateStr, dateX, currentY - SPACING.HEADER_VALUE_RAISE);
  const dateWidth = doc.widthOfString(orderDateStr);

  label = 'Customer';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const customerX = col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  doc.text(orderData.company_name, customerX, currentY - SPACING.HEADER_VALUE_RAISE);
  const customerWidth = doc.widthOfString(orderData.company_name);

  // Draw 1px bottom lines for values - extending from label box to column end
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const labelHeight = doc.currentLineHeight();
  const lineY = rowStartY - 2 + labelHeight + 3;

  drawHeaderRowBottomLine(doc, col1X - SPACING.LABEL_PADDING, lineY, col1Width);
  drawHeaderRowBottomLine(doc, col2X - SPACING.LABEL_PADDING, lineY, col2Width);
  drawHeaderRowBottomLine(doc, col3X - SPACING.LABEL_PADDING, lineY, col3Width);

  currentY += SPACING.HEADER_ROW;

  // Row 2: Job # | PO# | Job Name
  const row2StartY = currentY;

  label = 'Job #';
  labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const jobNumX = col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  const jobNumValue = orderData.customer_job_number || '';
  doc.text(jobNumValue, jobNumX, currentY - SPACING.HEADER_VALUE_RAISE);
  const jobNumWidth = doc.widthOfString(jobNumValue);

  label = 'PO #';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const poX = col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  const poValue = orderData.customer_po || '';
  doc.text(poValue, poX, currentY - SPACING.HEADER_VALUE_RAISE);
  const poWidth = doc.widthOfString(poValue);

  label = 'Job Name';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  const jobNameX = col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;
  doc.text(orderData.order_name, jobNameX, currentY - SPACING.HEADER_VALUE_RAISE);
  const jobNameWidth = doc.widthOfString(orderData.order_name);

  // Draw 1px bottom lines for values - extending from label box to column end
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const labelHeight2 = doc.currentLineHeight();
  const lineY2 = row2StartY - 2 + labelHeight2 + 3;

  drawHeaderRowBottomLine(doc, col1X - SPACING.LABEL_PADDING, lineY2, col1Width);
  drawHeaderRowBottomLine(doc, col2X - SPACING.LABEL_PADDING, lineY2, col2Width);
  drawHeaderRowBottomLine(doc, col3X - SPACING.LABEL_PADDING, lineY2, col3Width);

  currentY += SPACING.HEADER_ROW;

  // Row 3: (blank) | Due | Delivery
  const row3StartY = currentY;

  if (showDueDate) {
    renderDueDate(doc, orderData, col2X, currentY, col2Width);
  }

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  label = 'Delivery';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  const deliveryX = col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE;

  // Render Delivery field (with optional background color for packing list)
  if (deliveryBgColor) {
    // Packing list style: draw background rectangle behind text (no bottom line)
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica');
    const deliveryTextY = currentY - SPACING.HEADER_VALUE_RAISE;
    const deliveryTextWidth = doc.widthOfString(shippingText);
    doc.rect(deliveryX, currentY - 4, deliveryTextWidth + 8, 16)
      .fillAndStroke(deliveryBgColor, COLORS.DIVIDER_DARK);
    doc.fillColor(COLORS.BLACK).font('Helvetica');
    doc.text(shippingText, deliveryX + 4, deliveryTextY);
  } else {
    // Order form style: plain text with bottom line
    doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
    doc.text(shippingText, deliveryX, currentY - SPACING.HEADER_VALUE_RAISE);

    // Draw bottom line for order forms (not packing lists)
    doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
    const labelHeight3 = doc.currentLineHeight();
    const lineY3 = row3StartY - 2 + labelHeight3 + 3;
    drawHeaderRowBottomLine(doc, col3X - SPACING.LABEL_PADDING, lineY3, col3Width);
  }

  currentY += SPACING.HEADER_ROW;

  return currentY;
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
 * Row 1: Order # | Date | Job
 * Row 2: (blank) | Due | Delivery
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
  let currentY = startY;

  // Calculate column widths for full-width bottom lines
  const col1Width = col2X - col1X;
  const col2Width = col3X - col2X;
  const col3Width = pageWidth && marginRight ? (pageWidth - marginRight - col3X + SPACING.LABEL_PADDING) : 150; // fallback width

  // Row 1: Order # | Date | Job
  const row1StartY = currentY;

  let label = 'Order #';
  let labelWidth = renderHeaderLabel(doc, label, col1X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_number, col1X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  const orderDateStr = new Date(orderData.order_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  label = 'Date';
  labelWidth = renderHeaderLabel(doc, label, col2X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderDateStr, col2X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  label = 'Job';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(orderData.order_name, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  // Draw 1px bottom lines for values - extending from label box to column end
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const labelHeight = doc.currentLineHeight();
  const lineY = row1StartY - 2 + labelHeight + 3;

  drawHeaderRowBottomLine(doc, col1X - SPACING.LABEL_PADDING, lineY, col1Width);
  drawHeaderRowBottomLine(doc, col2X - SPACING.LABEL_PADDING, lineY, col2Width);
  drawHeaderRowBottomLine(doc, col3X - SPACING.LABEL_PADDING, lineY, col3Width);

  currentY += SPACING.HEADER_ROW;

  // Row 2: (blank) | Due | Delivery
  const row2StartY = currentY;

  renderDueDate(doc, orderData, col2X, currentY, col2Width);

  const shippingText = orderData.shipping_required ? 'Shipping' : 'Pick Up';
  label = 'Delivery';
  labelWidth = renderHeaderLabel(doc, label, col3X, currentY);
  doc.fontSize(FONT_SIZES.HEADER_VALUE).font('Helvetica').fillColor(COLORS.BLACK);
  doc.text(shippingText, col3X + labelWidth + SPACING.HEADER_LABEL_TO_VALUE, currentY - SPACING.HEADER_VALUE_RAISE);

  // Draw bottom line for Delivery value in shop forms
  doc.fontSize(FONT_SIZES.HEADER_LABEL).font('Helvetica-Bold');
  const labelHeight2 = doc.currentLineHeight();
  const lineY2 = row2StartY - 2 + labelHeight2 + 3;
  drawHeaderRowBottomLine(doc, col3X - SPACING.LABEL_PADDING, lineY2, col3Width);

  currentY += SPACING.HEADER_ROW;

  return currentY;
}
